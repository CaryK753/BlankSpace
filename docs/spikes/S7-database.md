# S7：数据库访问层与 Migration Runner

## 状态

Matrix frozen。`A1-S7-01` 已冻结 PostgreSQL 镜像、三种访问层候选、fixture、deadline、migration ownership/locking/transaction/recovery 语义和诊断结构，但尚未安装数据库 package、拉取镜像、启动容器或执行 SQL。只有后续真实 runner 和目标平台证据可以把本状态推进为 Provisional pass 或 Pass。

## 要回答的问题

Kysely、Drizzle 或 direct SQL + typed adapter 中，哪一种最能在共享 PostgreSQL 上保持 Kit 数据所有权、可检查 SQL、显式事务和确定性 migration，同时不把 ORM schema 或 transaction handle 变成跨 Kit Contract？

## 决策上下文与约束

RFC-0013 已选 PostgreSQL，但没有选择访问层。Blankspace 必须统一拥有 migration 排序、identity、content hash、advisory lock、checkpoint 和恢复策略；候选只能负责连接、参数绑定、typed query 和导出 SQL，不能再拥有一套隐藏的 migration lifecycle。

- 每个 fixture owner 只访问自己的 PostgreSQL schema；共享数据库不等于共享数据所有权。
- migration SQL 是受审查的 source artifact，不能由运行时隐式 diff 或 `push` 生成。
- 公共 Service/Event Contract 不接收 query builder、client、pool 或 transaction handle。
- migration runner 使用一个专用连接持有 session-level advisory lock；每个 transactional migration 的全部语句和 history write 使用同一个 client。
- remove 只停止加载 owner，不自动执行 `DROP SCHEMA`、删除历史或清理数据。
- production apply、备份与恢复不在 S7 spike 范围；runner 只生成可审计的 conformance evidence。

PostgreSQL 的 session advisory lock 会保持到显式释放或 session 结束，`pg_try_advisory_lock` 可以无等待地返回竞争结果；这适合用单一专用连接证明并发 runner 排他性。[PostgreSQL advisory-lock reference](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS) Node-postgres 也明确要求 transaction 的所有语句使用同一个 client，不能混用 `pool.query`。[node-postgres transaction reference](https://node-postgres.com/features/transactions)

## 工具与版本决策

| 能力 | 冻结选择 | 结论 |
| --- | --- | --- |
| Runtime | Node.js `v24.20.0` | 与 S2～S6 和仓库 CI 相同 |
| Package manager | pnpm `10.32.1` | 未来安装必须 exact、frozen lock、`--ignore-scripts` |
| Database | PostgreSQL `18.6` | 当前受支持稳定 major 的最新 patch；不使用 beta/RC |
| Container | `postgres:18.6-bookworm@sha256:1c59e2c3c818eaa0f0628f695b36e7c9e362d6b219b36a54a32df645cbd7e1af` | 明确 Debian base 与多架构 index，不依赖浮动 tag |
| Common driver | `pg@8.23.0` + `@types/pg@8.23.1` | 三候选共用同一 pool/client 行为，减少 driver 变量 |
| Candidate A | `kysely@0.29.5` | typed SQL builder，无 runtime dependencies；不使用其 Migrator |
| Candidate B | `drizzle-orm@0.45.2` | typed schema/query；只用 node-postgres adapter，不安装 Drizzle Kit |
| Candidate C | direct SQL typed adapter | 只使用 `pg` 与本地显式 row codec；作为最小能力基线 |
| Test/schema | `node:test`、JSON Schema 2020-12 | 沿用现有 conformance 模式，不增加 runner framework |

选择 `bookworm` 而不是默认浮动 Debian tag 或 Alpine，是为了冻结 libc/base 变体并避免 musl/extension 行为成为本轮变量；这不是长期生产 base 选择。PostgreSQL 18+ 的官方镜像把 version-specific `PGDATA` 放在 `/var/lib/postgresql/18/docker`，持久 volume mount 点是 `/var/lib/postgresql`；runner 必须按该布局创建一次性 volume。[Docker Official Image](https://hub.docker.com/_/postgres)

候选版本、解析树、许可证、完整性、安全与镜像 provenance 见 [S7 候选与镜像审查](./s7-database/supply-chain-review.md)。本记录只授权后续 spike；不构成 production dependency/image baseline。

## Runner 环境与容器边界

| 项目 | 冻结值 |
| --- | --- |
| core runner | `ubuntu-24.04`；本地 macOS/Windows 只可提供补充 evidence |
| container platform | CI 固定 `linux/amd64` manifest `sha256:a10c981235b4f635e65df0cfb66a5598064628128505dbc6a3ed4ca303717521` |
| local arm64 | 可用同一 index 的 `linux/arm64/v8` manifest `sha256:4d155aa3f2c2cc1838bb70e81396f76373ec7275ec9ce9cf32873cd677c9a992`；平台字段置于 hash 外 |
| network | 只绑定 `127.0.0.1` 随机 host port；实际端口不进入 canonical 内容 |
| database/user | `blankspace_s7` / `blankspace_runner` |
| password | fixture secret file，容器用 `POSTGRES_PASSWORD_FILE`；值、路径和 DSN 不记录 |
| data | 每个 scenario 使用新的 disposable volume；禁止复用开发或 production volume |
| readiness | 容器 running 后仍必须通过 `pg_isready`，再由 driver 执行 `SELECT 1` |
| locale/timezone | `C.UTF-8` / `UTC`；canonical seed 不使用 `now()` |
| pool | `max: 4`、`connectionTimeoutMillis: 5000`、`idleTimeoutMillis: 1000`、`allowExitOnIdle: true` |

容器启动命令、Docker/Compose 版本、container ID、端口、实际 elapsed 和 host 路径属于 environment evidence，不进入 matrix hash。runner 启动前验证 image reference 同时包含 exact version tag 与 digest；digest 不匹配时失败且不启动容器。

## 固定 schema、seed 与 migration descriptor

本 corpus 使用无业务含义的 `kit_alpha` 和 `kit_beta`，避免提前实现 Identity/Workspace schema：

```sql
CREATE SCHEMA kit_alpha;
CREATE SCHEMA kit_beta;
CREATE SCHEMA blankspace_migrations;

CREATE TABLE kit_alpha.items (
  item_id uuid PRIMARY KEY,
  label text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0)
);

CREATE TABLE kit_beta.links (
  link_id uuid PRIMARY KEY,
  alpha_item_id uuid NOT NULL,
  kind text NOT NULL
);
```

`kit_beta.links.alpha_item_id` 是逻辑引用，不创建跨 owner foreign key，也不允许 beta 直接 join alpha 表；fixture 用公开 service-equivalent 输入模拟跨 Kit 协作。seed 固定为两个 alpha item 与两个 beta link，UUID、文本、revision 和排序键均写死；所有候选返回相同的 JSON wire rows，字段顺序由 canonical serializer 决定。

runner history 表固定为 `blankspace_migrations.applied_migrations`：

```text
owner_id, migration_id, content_sha256, mode,
state, checkpoint_id, applied_at
```

其中 canonical evidence 排除数据库生成的 `applied_at`。descriptor V1 固定字段为：

```ts
interface MigrationDescriptorV1 {
  ownerId: string;
  migrationId: string;
  dependsOn: string[];
  mode: 'transactional' | 'checkpointed' | 'manual';
  contentSha256: string;
  sql: string[];
  checkpoints?: { id: string; sql: string[] }[];
  recoveryOwner: string;
  runbookRef: string;
  compatibleAppRange: string;
  backupEvidenceRef?: string;
}
```

`contentSha256` 覆盖 UTF-8 canonical descriptor bytes，但排除该字段自身；`dependsOn` 和 checkpoints 先按 ID 验证唯一性，执行顺序使用显式依赖的稳定拓扑排序，再以 `ownerId/migrationId` 打破同层 tie。已应用记录的 hash 不一致时，不执行任何 SQL。

## Lock、transaction 与 recovery 协议

- runner 在专用 client 上调用 `pg_try_advisory_lock(1112755527, 1)`；第一项是固定 namespace `BSMG`，第二项是 contract version。返回 `false` 立即产生 lock diagnostic，不在数据库内无界等待。
- 拿锁后创建/读取 history，并在 `finally` 中调用一次 `pg_advisory_unlock`；连接丢失由 PostgreSQL session cleanup 释放。lock owner 的 client 不进入普通 query pool。
- `transactional`：同一 client 执行 `BEGIN`，用 `SET LOCAL statement_timeout`、`lock_timeout` 和 `transaction_timeout`，依次执行 SQL 与 history insert，任一步失败执行 `ROLLBACK`。
- `checkpointed`：descriptor 自己声明幂等 checkpoint；每个 checkpoint 单独 transaction，成功后和 checkpoint marker 原子提交。重入只跳过 hash 相同且已提交的 checkpoint。
- `manual`：永不执行 SQL；缺少 `recoveryOwner`、`runbookRef`、compatible range 或所需 backup evidence 时在 plan 阶段失败。
- PostgreSQL 支持用 `BEGIN`/`COMMIT` 形成原子 transaction，并用 `ROLLBACK` 丢弃本 transaction 的更新。[transaction reference](https://www.postgresql.org/docs/18/tutorial-transactions.html) deadline 通过 session/local 参数设置，不修改全局 `postgresql.conf`。[client timeout reference](https://www.postgresql.org/docs/18/runtime-config-client.html)

删除 owner 时只返回 `retained` 计划，列出 schema、history 和 row count evidence；永久 purge 必须是后续独立、可审计且有备份/恢复证据的操作。

## 固定时间预算

| Budget | 毫秒 | 适用范围 |
| --- | ---: | --- |
| `containerStartupDeadlineMs` | 60000 | 从 create/start 到 `pg_isready` 与 `SELECT 1` |
| `connectionDeadlineMs` | 5000 | pool/client 建连与 checkout |
| `statementDeadlineMs` | 2000 | 单条 fixture SQL；对应 `statement_timeout` |
| `lockDeadlineMs` | 2000 | 普通 relation/object lock；advisory lock 本身使用 try/no-wait |
| `migrationDeadlineMs` | 15000 | 单个 migration 或 checkpoint transaction |
| `harnessDeadlineMs` | 120000 | 单 scenario 子进程的最终保险 |

timeout fixture 用数据库 `pg_sleep`、显式 barrier 与竞争连接，不用赌 wall-clock 固定 sleep。canonical transcript 记录配置值与 timeout classification，不记录实测耗时。

## 稳定 diagnostic 结构

```ts
interface S7Diagnostic {
  code: 'E_DB_CONNECT' | 'E_DB_STATEMENT' | 'E_DB_STATEMENT_TIMEOUT' |
    'E_MIGRATION_DUPLICATE_ID' | 'E_MIGRATION_DEPENDENCY' |
    'E_MIGRATION_HASH_MISMATCH' | 'E_MIGRATION_LOCK_UNAVAILABLE' |
    'E_MIGRATION_TRANSACTION_FAILED' | 'E_MIGRATION_CHECKPOINT_INVALID' |
    'E_MIGRATION_MANUAL_REQUIRED' | 'E_MIGRATION_OWNER_SCOPE' |
    'E_MIGRATION_DEADLINE';
  severity: 'error';
  phase: 'connect' | 'plan' | 'lock' | 'apply' | 'verify' | 'remove';
  ownerId: string;
  operation: string;
  message: string;
  migrationId?: string;
  checkpointId?: string;
  schema?: string;
  causeCode?: string;
  deadlineMs?: number;
  pendingOwners?: string[];
}
```

`pendingOwners`、dependency IDs 和 descriptor IDs 都按 UTF-16 code-unit order 排序。`causeCode` 只保留 allowlist 中的 PostgreSQL SQLSTATE `23505`、`42P01`、`42501`、`55P03`、`57014`，以及 transport `ECONNREFUSED`、`ECONNRESET`。DSN、credential、SQL 参数值、raw SQL、端口、PID、timestamp、elapsed、绝对路径、stack 和第三方原始 message 禁止进入 diagnostic。transaction failure 保留 primary，rollback/unlock/close failure 作为排序后的 additive diagnostics。

## Frozen core matrix

| ID | 固定输入 | 预期结果 |
| --- | --- | --- |
| `typed-query-equivalence` | 同一 schema/seed、三候选的 insert/select/update | wire rows 与参数化 SQL intent 等价；无跨 owner 访问 |
| `stable-two-owner-order` | alpha 与依赖 alpha 的 beta migrations，正序/反序枚举 | 相同拓扑、history 和 canonical hash |
| `duplicate-migration-id` | 同 owner 两个相同 ID | plan 阶段 `E_MIGRATION_DUPLICATE_ID`；SQL count `0` |
| `dependency-failure` | 缺失依赖与依赖 cycle 子例 | `E_MIGRATION_DEPENDENCY`；SQL count `0` |
| `applied-hash-mismatch` | history hash 与 descriptor 不同 | `E_MIGRATION_HASH_MISMATCH`；SQL count `0` |
| `concurrent-runners` | runner A 持有专用 session lock，B 同时 try | A 独占；B `E_MIGRATION_LOCK_UNAVAILABLE`；B SQL count `0` |
| `transactional-rollback` | 建表/insert 后执行固定失败 SQL | 本 migration 与 history 均不存在；后续不执行；primary 不被 cleanup 覆盖 |
| `checkpoint-resume` | checkpoint 2 首次失败，修复 fixture 后重入 | checkpoint 1 不重复，2/3 各提交一次，处理范围准确 |
| `manual-plan-block` | manual descriptor 依次缺恢复字段 | 每个缺口产生 `E_MIGRATION_MANUAL_REQUIRED`；永不执行 SQL |
| `owner-scope-rejection` | beta SQL 目标为 `kit_alpha`/`public` | apply 前 `E_MIGRATION_OWNER_SCOPE`；不依赖数据库权限碰运气 |
| `removal-retains-data` | 停用 beta owner | schema、rows、history 保留；drop count `0` |
| `bounded-failures` | refused connection、`pg_sleep`、relation lock、migration hang | 分别归一化 connect/statement/lock/migration deadline，子进程有界退出 |
| `explain-index-evidence` | 固定 filter/order query 与 index | 三候选导出 SQL；normalized plan 包含期望 relation/index/node，不比较 cost/timing |
| `client-import-boundary` | web/shared entry import 数据库候选或 `node:net` | 复用 S2 Compiler boundary，在启动数据库前失败 |

每个数据库场景以正序与反序执行。matrix hash 只覆盖场景 ID、canonical rows、迁移计划/history、normalized SQL intent/plan、diagnostics、resource ledger 与 exit classification。环境、image platform、container/volume ID、实际端口和 timing 置于 hash 外。

## 候选选择规则

三候选必须通过同一 runner，且 Kysely/Drizzle 不得使用自带 migrator 绕过统一语义。先比较边界正确性，再比较 ergonomics 和相对性能：

1. 任一候选若要求全局业务 schema、隐藏 SQL、跨 owner relation 或跨 Kit transaction handle，直接淘汰。
2. 通过者必须能导出参数化 SQL、使用调用方提供的同一 `pg` client，并在 connection close 后资源余额为零。
3. Kysely 与 Drizzle 都通过时，优先选择依赖/生成物更小、Kit-local types 更易维护者；性能只有在结果和计划语义一致后参与判断。
4. 两个 builder 都破坏边界或明显扩大供应链/编译成本时，选择 direct SQL typed adapter。

Drizzle 文档把 TypeScript schema 视作 query/migration source of truth，但也明确支持外部 migration 或直接 SQL；S7 只评估其 query layer，不采用 `drizzle-kit push` 或 Drizzle migration history。[Drizzle migration approaches](https://orm.drizzle.team/docs/migrations)

## 后果、回滚与未解决边界

正面后果是三候选共享 driver、seed、SQL 和 migration owner，因此比较的是访问层能力而不是不同数据库行为；负面后果是统一 runner 需要自己维护 descriptor/history/recovery 语义，无法直接继承 ORM CLI convenience。

后续 `A1-S7-02` 只能安装上述 exact spike dependencies、逐项对账 pnpm lock、拉取上述 digest，并实现本地 runner；Ubuntu evidence 由 `A1-S7-03` 独立负责。任一版本、digest、解析树、license、install script、advisory、Node patch、PostgreSQL patch/base、schema 或 deadline 变化都使本矩阵失效并触发复审。

本阶段没有 production adapter、备份验证、PITR、HA/failover、connection proxy、tenant schema、业务 Kit schema、zero-downtime DDL 或 production migration apply。S7 通过也不能把这些能力标记为可用。
