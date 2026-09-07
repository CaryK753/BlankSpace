# S7 Database 候选与镜像审查

## 状态与有效期

2026-09-08 完成预安装审查，仅批准 `A1-S7-02` 用 exact package 和 exact image digest 实现 conformance runner。审查于 2026-12-07 或任一版本、digest、解析树、安全公告、license、install script 或 provenance 发生变化时失效，以先到者为准。

本记录不是 `security/dependencies.json` 的生产基线，不解除根许可证、SBOM、provenance、签名、备份、恢复或公开发布门禁。审查期间没有修改仓库 package/lock，没有下载 image layer、拉取镜像或启动容器。

## 决策驱动

- 三候选必须使用同一 PostgreSQL patch、driver 与 migration runner，避免把 driver 或 ORM migrator 差异误判为 query layer 差异。
- source、version、integrity、license、scripts、解析树、维护和已知漏洞必须在仓库/daemon 变更前冻结。
- database package 只进入 server-side spike；web/shared import 必须继续被 Compiler 拒绝。
- migration SQL、owner、hash、lock、checkpoint 与 recovery 由 Blankspace 管理，不引入第二个 migration CLI/lifecycle。

## npm 候选快照

| Package | 版本与用途 | 许可证 | Registry integrity | 供应链结论 |
| --- | --- | --- | --- | --- |
| `pg` | `8.23.0`；共同 driver/pool | MIT | `sha512-Ip2EQCngowJLGOfCwkFhPXU7/ljlhn6Rxlmy4XYfL2Y+vyRM59+8uR2xqRWKdYmbXmxCFOAmKxBuSUCdF34qLg==` | Node `>=16`；npm `gitHead` `df274d1ba9ad9d11a8f1079314faeafde7208207`；6 个直接依赖 |
| `@types/pg` | `8.23.1`；driver types | MIT | `sha512-fKVHpikPdg4GKks3JuLEhvwSyvwzF23hnabPy6DD8ljVbC7+6J5dQzdv4arV6jqq57djnMgs1HKBxX4P8aBI3A==` | `@types/node: *` 是 lock 漂移风险，未来必须保持仓库 Node 24 types |
| `kysely` | `0.29.5`；Candidate A | MIT | `sha512-ooa+eSbBNPTo3MycPEuW5jdrxQdQwdtB3LC3h43FiXQbIry5tR0C5lDG7eealK0E4D7XjrnOP5DIUg/LyjRMYQ==` | Node `>=22`；0 runtime dependency；不用 `kysely/migration` |
| `drizzle-orm` | `0.45.2`；Candidate B | Apache-2.0 | `sha512-kY0BSaTNYWnoDMVoyY8uxmyHjpJW1geOmBMdSSicKo9CIIWkSxMIj2rkeSR51b8KAPB7m+qysjuHme5nKP+E5Q==` | 0 direct runtime dependency；有大量 optional peers，只允许解析 `pg`/`@types/pg` |

这些版本是审查时 registry 的 stable `latest`。Kysely `0.30.0-beta.1` 和 Drizzle `1.0.0-rc.4` 都是 prerelease，不进入稳定 corpus。Kysely、Drizzle 与 `@types/pg` 的 registry metadata 未提供 `gitHead`；`pg` 虽提供 source revision，也仍缺 package signature。未来安装必须以 registry integrity、lock resolution、tarball identity 和官方 release/source 对账，不能声称已建立 source-to-package cryptographic provenance。[Kysely repository](https://github.com/kysely-org/kysely) [Drizzle repository](https://github.com/drizzle-team/drizzle-orm) [node-postgres repository](https://github.com/brianc/node-postgres)

`drizzle-orm` 声明多种数据库/telemetry 的 optional peers，但 S7 不批准它们。`drizzle-kit`、`kysely-ctl`、dotenv、tsx、Postgres.js、native driver、telemetry 与 serverless driver 都不在允许解析集合；实际 pnpm lock 多出任一节点都必须停止并复审。

## 解析树、脚本与 audit

使用 npm `11.19.0` 在一次性临时目录执行 exact、package-lock-only、`--ignore-scripts` 解析。临时 `package-lock.json` SHA-256：

```text
d7c5fc791be22555888071e4a361d08f68c4991c8f35757a4469e9df2b8d256d
```

解析集合共 19 个 package：

```text
@types/node@26.5.0
@types/pg@8.23.1
drizzle-orm@0.45.2
kysely@0.29.5
pg@8.23.0
pg-cloudflare@1.4.0
pg-connection-string@2.14.0
pg-int8@1.0.1
pg-pool@3.14.0
pg-protocol@1.16.0
pg-types@2.2.0
pgpass@1.0.5
postgres-array@2.0.0
postgres-bytea@1.0.1
postgres-date@1.0.7
postgres-interval@1.2.0
split2@4.2.0
undici-types@8.9.0
xtend@4.0.2
```

许可证集合为 MIT、Apache-2.0 与 ISC。lock metadata 中 19 个 package 均没有 install script；发布包中的 test/build/publish 脚本不是 consumer install hook。`npm audit --package-lock-only --ignore-scripts --audit-level=low --json` 在审查时报告 0 low/moderate/high/critical；这是时间点快照，不等于没有未知漏洞。

临时 npm 解析因 `@types/pg` 的 wildcard dependency 选择了 `@types/node@26.5.0`。仓库直接约束 Node 24 types，因此 `A1-S7-02` 的硬门禁是 pnpm lock 不引入 Node 26 types；若无法复用/解析到仓库批准的 Node 24 line，则停止并单独决定 types 策略，不用 `skipLibCheck` 掩盖。

`pg-cloudflare` 是 `pg` 的 optional dependency，但 npm 默认解析快照包含它。后续 pnpm tree 可以包含该已审查节点，但 S7 Node runner 不得使用 Cloudflare transport；若实际 lock 因 package-manager 语义不同而省略它，记录差异即可，不能扩展到其他 optional peers。

## PostgreSQL image identity

冻结引用：

```text
postgres:18.6-bookworm@sha256:1c59e2c3c818eaa0f0628f695b36e7c9e362d6b219b36a54a32df645cbd7e1af
```

2026-09-08 只通过 Docker Registry V2 manifest API 查询 metadata，没有下载 layer。index 是 OCI image index，支持：

| Platform | Image manifest digest |
| --- | --- |
| `linux/amd64` | `sha256:a10c981235b4f635e65df0cfb66a5598064628128505dbc6a3ed4ca303717521` |
| `linux/arm/v7` | `sha256:1a8f0998759f94a7720bcb32ebf0ecf9da33d572d83e6e663bdf2238d3d2425d` |
| `linux/arm64/v8` | `sha256:4d155aa3f2c2cc1838bb70e81396f76373ec7275ec9ce9cf32873cd677c9a992` |
| `linux/386` | `sha256:8d752209dccbade2f3e801f751f5a38191f004acef2abf2e83cc20430415cf0d` |
| `linux/ppc64le` | `sha256:ec59016e5ab065835168147316b031bd0e99d3a226844f9c57cb7a74b7fd7235` |

Docker Official Images 的 `library/postgres` entry 在 verified commit `62e3678b4b5f889cc5d36fe0fc4599c277e1f875` 中把 `18.6-bookworm` 映射到 `docker-library/postgres` commit `e00e1bd34ec5c8a8e7ad89b273b3d42efaf6d5bc`、目录 `18/bookworm` 和五种架构。[official-images entry](https://github.com/docker-library/official-images/blob/62e3678b4b5f889cc5d36fe0fc4599c277e1f875/library/postgres) [image source commit](https://github.com/docker-library/postgres/commit/e00e1bd34ec5c8a8e7ad89b273b3d42efaf6d5bc)

OCI annotations 对 amd64/arm64 都记录相同 source revision；每个平台 image 还关联两个 `attestation-manifest` layer，predicate 分别为 SPDX Document 与 SLSA provenance v0.2。该 metadata 能证明 registry 附带 SBOM/provenance artifact，但本次没有拉取并验证 attestation 内容，也没有验证 Cosign/Notary 独立签名；source commit 本身为 unsigned。因此它只批准 spike 拉取 exact digest，不能升级为生产签名结论。

PostgreSQL 18.6 是 2026-08-13 发布的稳定 patch；官方当前仍支持 18、17、16、15、14。[PostgreSQL current documentation](https://www.postgresql.org/docs/) [release notes](https://www.postgresql.org/docs/release/) 官方镜像入口说明 tag、架构、初始化、secret file 与 PGDATA 行为。[Docker Official Image](https://hub.docker.com/_/postgres)

## 镜像运行安全边界

- 禁止 `POSTGRES_HOST_AUTH_METHOD=trust`；password 只经临时 secret file 注入并在 cleanup 删除。
- 只允许 `127.0.0.1` 随机端口与 runner-owned private network；不发布到 LAN，不连接现有 Docker network。
- 使用 disposable named volume，开始前校验 label/owner，结束后按明确名称删除；不得挂载 host 数据目录或已有 volume。
- 不以 root credential 运行应用 query；初始化 superuser 仅用于创建 fixture role/database，runner 后续使用最小权限 role。
- stdout/stderr 和 diagnostics 必须过滤 DSN、password、SQL 参数与环境变量；原始 container inspect 不进入 checked-in transcript。
- image layer 的 OS package CVE 扫描、attestation material verification 和签名仍是 production blocker；`npm audit` 不覆盖 image。

## 考虑过的替代方案

| 方案 | 优点 | 代价与结论 |
| --- | --- | --- |
| `postgres:18.6-trixie` | 当前 Debian stable base | 与既有环境兼容性证据较少；保留为 Bookworm 生命周期不足时的复审项 |
| `postgres:18.6-alpine` | image 更小 | musl、extension/tooling 差异扩大变量；拒绝本轮 |
| 浮动 `postgres:18`/`postgres:latest` | 自动获得 patch | evidence 不可复现；拒绝 |
| 本机 PostgreSQL | 启动快 | 版本、locale、extension、数据残留不可控；拒绝作为 canonical runner |
| Drizzle Kit | schema diff/CLI convenience | 引入第二 migration owner 与更大依赖面；拒绝，Drizzle 只评估 query layer |
| Kysely Migrator | 与 builder 集成 | 不能替代 Blankspace checkpoint/manual/recovery contract；拒绝 |
| Prisma | 成熟 schema/client/migration | engine/codegen 与全局 schema 扩大边界，不是 RFC 候选；本轮不增加第四方案 |
| postgres.js | 小而直接 | 会让三候选 driver 不同；只有 `pg` 无法满足时才重审 |

## 回滚、撤销与复审

Spike 回滚是删除 exact dev dependencies、runner 和 checked-in transcripts，并清理带 S7 label 的 disposable container/network/volume；不迁移或删除任何用户数据。image digest 可从 daemon cache 移除，但不是完成代码回滚的必要条件。

以下任一条件触发复审：candidate/image latest 或 patch 变化、lock 多出未批准节点、install script 出现、license 变化、新 advisory/CVE、registry integrity/digest 漂移、attestation 不可解析、需要 extension/HA/proxy、Bookworm 生命周期不足，或 frozen matrix 无法表达 owner/transaction/recovery 行为。复审前不得扩大 semver range、自动更新 digest 或放宽测试。

## 可复现命令

```bash
npm view pg@8.23.0 @types/pg@8.23.1 kysely@0.29.5 drizzle-orm@0.45.2 version license repository dependencies peerDependencies scripts engines dist --json
npm install --prefix <temporary-directory> --package-lock-only --ignore-scripts --no-audit --no-fund --save-exact pg@8.23.0 @types/pg@8.23.1 kysely@0.29.5 drizzle-orm@0.45.2
npm audit --prefix <temporary-directory> --package-lock-only --ignore-scripts --audit-level=low --json
docker buildx imagetools inspect postgres:18.6-bookworm
```

最后一条命令只用于后续重新查询 manifest；`A1-S7-01` 实际使用 Registry V2 API，并未执行 Docker pull/run。
