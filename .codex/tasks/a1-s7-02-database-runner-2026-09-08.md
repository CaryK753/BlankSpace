# A1-S7-02 本地 Database conformance runner

日期：2026-09-08

## 目标

按冻结的 S7 合同安装 exact spike dependencies，对账 pnpm lock，并在 digest-pinned、一次性 PostgreSQL 18.6 容器上实现三访问层和 migration/fault conformance corpus。

## TODO

- [x] 阅读 A1-S7-02、S7 contract/supply-chain review、RFC-0013、测试、安全与供应链边界。
- [x] 确认 Docker Desktop daemon 可用，当前无容器和镜像；记录 engine、架构与资源边界。
- [x] 安装 exact `pg`、`@types/pg`、Kysely 与 Drizzle，核对 lock、license、scripts 与 Node types。
- [x] 实现 digest 校验、一次性 network/volume/secret/container lifecycle 与 cleanup ledger。
- [x] 实现 neutral two-owner schema/seed、三访问层 typed query corpus。
- [x] 实现 migration plan、hash、advisory lock、transaction/checkpoint/manual/removal 与 deadline 场景。
- [x] 冻结 transcript schema、canonical baseline、稳定 diagnostics 与候选结论。
- [x] 运行 build、typecheck、完整 test、`test:s7`、verify:docs 和资源残留检查。
- [x] 更新 S7 文档、work-item DAG、project status 与 Agent 入口。
- [ ] 提交、同步远端并核对 GitHub Actions。

## 范围边界

- 只允许冻结的 exact spike dependencies；不安装 Drizzle Kit、Kysely Migrator CLI、dotenv、tsx 或其他 driver。
- 只操作带本任务固定 label/name prefix 的一次性 Docker resources；不接触已有容器、镜像、network 或 volume。
- 不实现 production Database adapter、业务 Kit schema、备份/PITR、HA/proxy 或 production migration apply。
- 本地 macOS/arm64 结果最多推进 S7 为 Provisional pass；Ubuntu Pass 由 `A1-S7-03` 负责。

## 本地证据

- 环境：macOS arm64、Node.js v24.20.0、pnpm 10.32.1、Docker Desktop 29.7.2、PostgreSQL 18.6 arm64 image from frozen OCI index。
- exact dependencies：`pg@8.23.0`、`@types/pg@8.23.1`、`kysely@0.29.5`、`drizzle-orm@0.45.2`；安装禁用 scripts，lock 未出现 Node 26 types 或新增 requiresBuild。
- 14 场景正反序 canonical hash：`8e48920e5c1adc8b9cf327ffeeb195dcc48d2c4c8290a7f0822cbf751313df04`。
- `pnpm build`、`pnpm typecheck`、147 Vitest、8 S1、4 S2、7 S3、4 S4、15 S5、10 S6、5 S7 tests 与 `pnpm verify:docs` 通过。
- 每轮完成后检查 `blankspace.s7.run` label，container、volume、network 均无残留。
- Kysely 与 Drizzle 都通过；按依赖/安装体积和不采用 schema generator/migrator 的边界，Kysely 为 provisional query-layer 选择，direct SQL 保留为退路。
