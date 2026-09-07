# A1-S6-03 S6 跨平台 conformance

日期：2026-09-07

## 目标

在 Ubuntu 24.04、macOS 15 与 Windows 2025 上运行冻结的 S6 十场景 core corpus，在 POSIX runner 上执行真实 `SIGTERM`/`SIGINT`，并保持 S2～S5 regression workflows 绿色。

## TODO

- [x] 阅读 A1-S6-03、S6 spike、测试策略、安全边界与现有 workflow。
- [x] 盘点 CI 触发器、runner、依赖安装、权限和风险边界。
- [x] 新增固定 Node.js 24.20.0 / pnpm 10.32.1 的 S6 三平台 workflow。
- [x] 运行 build、typecheck、test、test:s6 与 verify:docs。
- [ ] 在远端验证 Linux、macOS、Windows 的同一 S6 canonical hash。
- [ ] 验证 Ubuntu/macOS 真实 signal 与 Windows 批准的平台限制。
- [ ] 确认同一提交上的 S2～S5 regression workflows 通过。
- [ ] 更新 work item evidence、S5/S6 Spike 与 project status。
- [ ] 提交并同步远端仓库。

## CI 边界

- workflow 只读取仓库并运行冻结的 `pnpm test:s6`，不部署、不写 package registry、不需要 secret 或外部服务。
- 使用 GitHub-hosted runner；不启用依赖缓存，安装使用 frozen lockfile 和 `--ignore-scripts`。
- Windows 只验证 core corpus 与 `unsupported-by-node` signal transcript，不把强制终止冒充 POSIX graceful signal。
- rollback 是移除独立 `s6-conformance.yml`；它不改变产品运行时或远端环境。
