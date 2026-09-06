# A1-S5-03 S5 跨平台 conformance

日期：2026-09-06

## 目标

在 Ubuntu 24.04、macOS 15 与 Windows 2025 上运行冻结的 9 个 lifecycle 和 5 个 Event 场景，对账同一 canonical matrix hash，并保持 S2～S4 regression workflow 绿色。

## TODO

- [x] 阅读 A1-S5-03、S5 spike、测试策略、安全边界与现有 workflow
- [x] 验证本地 S1～S5 与文档基线
- [x] 新增固定 Node.js 24.20.0 / pnpm 10.32.1 的 S5 三平台 workflow
- [x] 运行 build、typecheck、test、verify:docs
- [ ] 在远端验证 Linux、macOS、Windows 的 S5 canonical hashes
- [ ] 确认同一提交上的 S2、S3、S4 regression workflows 通过
- [ ] 更新 work item evidence、S5 Spike 与 project status
- [ ] 提交并同步远端仓库

## 范围边界

- workflow 只运行冻结的 `pnpm test:s5` corpus，不生成或改写 transcript。
- 平台、架构和 Node 版本只作为 evidence metadata，不进入 matrix hash。
- 不加入 shutdown deadline、host termination、S6 server、durable transport、真实 Service/Kit 或新依赖。
