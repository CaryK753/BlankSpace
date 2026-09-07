# A1-S7-01 Database 工具链与故障契约

日期：2026-09-08

## 目标

在修改依赖、拉取镜像或启动数据库前，冻结 S7 的 PostgreSQL 镜像、数据访问层候选、migration runner、fixtures、deadlines、diagnostics 与供应链证据。

## TODO

- [x] 阅读 A1-S7-01、S7 spike、RFC-0013、测试策略、安全模型与供应链政策。
- [x] 核对 PostgreSQL、Kysely、Drizzle、`pg` 的精确当前版本与官方维护/安全证据。
- [x] 解析候选 npm 依赖树、许可证、install scripts 与审计结果，不修改仓库依赖。
- [x] 查询 PostgreSQL 官方镜像的精确多架构 digest、平台清单、签名/来源与安全边界，不拉取镜像。
- [x] 冻结 schema/seed、runner 环境、deadlines、场景输入和稳定 diagnostics。
- [x] 记录候选取舍、后果、rollback/export/recovery 与复审条件。
- [x] 更新 S7 Spike、work-item DAG、project status 和 Agent 启动入口。
- [x] 运行 test、verify:docs 与文档差异检查。
- [x] 提交、同步远端并核对 GitHub Actions。

## 范围边界

- 不安装数据库 npm package，不修改 lockfile。
- 不执行 `docker pull`、不启动容器、不创建 volume、schema 或 migration。
- 不提前选定生产 Database adapter；本项只冻结可执行 conformance contract。
- 不实现 Identity、Workspace 或其他业务 Kit schema。

## 证据

- PostgreSQL `18.6-bookworm` OCI index：`sha256:1c59e2c3c818eaa0f0628f695b36e7c9e362d6b219b36a54a32df645cbd7e1af`；`linux/amd64` 与 `linux/arm64/v8` manifests、SPDX/SLSA attestation metadata 和 source revision 已记录，未下载 layer、未验证独立签名。
- exact 候选：`pg@8.23.0`、`@types/pg@8.23.1`、`kysely@0.29.5`、`drizzle-orm@0.45.2`；临时 npm lock 共 19 包，MIT/Apache-2.0/ISC，0 install scripts，审查时 0 audit findings。
- 临时 `package-lock.json` SHA-256：`d7c5fc791be22555888071e4a361d08f68c4991c8f35757a4469e9df2b8d256d`；没有复制到仓库。
- 冻结 2 个 neutral owner、6 个 deadline、14 个 query/migration/fault 场景、stable diagnostics、recovery/removal 和候选选择规则。
- Node `v24.20.0`、pnpm `10.32.1`：forced incremental rebuild 恢复本地被删除但被旧 `tsconfig.tsbuildinfo` 误判为最新的 ignored `dist` 后，build、typecheck、147 Vitest、8 S1、4 S2、7 S3、4 S4、15 S5、10 S6 tests 与 verify:docs 全部通过。
- `package.json` 与 `pnpm-lock.yaml` 无差异；仅用 frozen、`--ignore-scripts` 安装恢复原 lock 的本地工具链。
- 远端 candidate commit `f7b3b8d90f67fb66ba5f36ca9972a14749111a62` 的 S2～S6 runs `34168091855`、`34168091872`、`34168091861`、`34168091890`、`34168091868` 全部完成且成功；15/15 Ubuntu/macOS/Windows check-runs 为 `success`。

## 交接

`A1-S7-02` 是唯一 ready 工作项：只按冻结审查安装 exact spike dependencies、核对 Node 24 types 与 lock 集合、验证 image digest 后创建 runner-owned disposable Docker resources，并实现本地 S7 corpus。Ubuntu evidence 由 blocked 的 `A1-S7-03` 独立负责。
