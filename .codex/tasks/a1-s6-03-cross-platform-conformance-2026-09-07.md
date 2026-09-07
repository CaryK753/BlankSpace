# A1-S6-03 S6 跨平台 conformance

日期：2026-09-07

## 目标

在 Ubuntu 24.04、macOS 15 与 Windows 2025 上运行冻结的 S6 十场景 core corpus，在 POSIX runner 上执行真实 `SIGTERM`/`SIGINT`，并保持 S2～S5 regression workflows 绿色。

## TODO

- [x] 阅读 A1-S6-03、S6 spike、测试策略、安全边界与现有 workflow。
- [x] 盘点 CI 触发器、runner、依赖安装、权限和风险边界。
- [x] 新增固定 Node.js 24.20.0 / pnpm 10.32.1 的 S6 三平台 workflow。
- [x] 运行 build、typecheck、test、test:s6 与 verify:docs。
- [x] 在远端验证 Linux、macOS、Windows 的同一 S6 canonical hash。
- [x] 验证 Ubuntu/macOS 真实 signal 与 Windows 批准的平台限制。
- [x] 确认同一提交上的 S2～S5 regression workflows 通过。
- [x] 更新 work item evidence、S5/S6 Spike 与 project status。
- [x] 提交并同步远端仓库。

## CI 边界

- workflow 只读取仓库并运行冻结的 `pnpm test:s6`，不部署、不写 package registry、不需要 secret 或外部服务。
- 使用 GitHub-hosted runner；不启用依赖缓存，安装使用 frozen lockfile 和 `--ignore-scripts`。
- Windows 只验证 core corpus 与 `unsupported-by-node` signal transcript，不把强制终止冒充 POSIX graceful signal。
- rollback 是移除独立 `s6-conformance.yml`；它不改变产品运行时或远端环境。

## 远端证据

- Candidate commit：`147ed7ae3648fe2fae3a38c871833e48ad8defd7`。
- S6 run `34084714281`：Ubuntu 24.04、macOS 15、Windows 2025 全部通过。
- 三个平台均通过 checked-in baseline assertion，匹配 core matrix hash `cf82465d0667b1a58f46bbfa9c2aa65a3247cff53ac11e3d3fcf63590cdd78eb`。
- Ubuntu/macOS 执行真实、重复 `SIGTERM` 与 `SIGINT`；Windows 断言 `unsupported-by-node`，没有伪造 POSIX graceful signal。
- Request/background timeout 子进程均先 IPC 上报 pending owners，再以状态 1 退出；没有触发 parent hard kill。
- 同一提交的 S2 run `34084714246`、S3 run `34084714297`、S4 run `34084714309`、S5 run `34084714274` 全部通过。

## 状态结论

S5 与 S6 提升为 Pass。Fastify 5.12.3 适合作为后续 Phase 1A Server host adapter 原语，但当前仍无 production Runtime/API。下一 ready item 为 `A1-S7-01`，只冻结 Database 工具链、fault contract 与供应链审查，不安装依赖或启动容器。
