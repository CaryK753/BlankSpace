# A1-S5-03 S5 跨平台 conformance

日期：2026-09-06

## 目标

在 Ubuntu 24.04、macOS 15 与 Windows 2025 上运行冻结的 9 个 lifecycle 和 5 个 Event 场景，对账同一 canonical matrix hash，并保持 S2～S4 regression workflow 绿色。

## TODO

- [x] 阅读 A1-S5-03、S5 spike、测试策略、安全边界与现有 workflow
- [x] 验证本地 S1～S5 与文档基线
- [x] 新增固定 Node.js 24.20.0 / pnpm 10.32.1 的 S5 三平台 workflow
- [x] 运行 build、typecheck、test、verify:docs
- [x] 在远端验证 Linux、macOS、Windows 的 S5 canonical hashes
- [x] 确认同一提交上的 S2、S3、S4 regression workflows 通过
- [x] 更新 work item evidence、S5 Spike 与 project status
- [x] 提交并同步远端仓库

## 范围边界

- workflow 只运行冻结的 `pnpm test:s5` corpus，不生成或改写 transcript。
- 平台、架构和 Node 版本只作为 evidence metadata，不进入 matrix hash。
- 不加入 shutdown deadline、host termination、S6 server、durable transport、真实 Service/Kit 或新依赖。

## 远端证据

- candidate commit：`fd70c05b4a2e677c0a802cf4ecc2f376d46943c0`；
- S5 run `34043351874`：Ubuntu 24.04、macOS 15、Windows 2025 全部通过；
- lifecycle matrix hash：`60634d7bbee5d4a47e38bf483df7ce357d998dfbff205dd282feab16df087151`；
- Event matrix hash：`452c665615c33df5fdaf81c45f13a87ce80fce536981784a2e89521c3dcc30b4`；
- S2 run `34043351886` 与 S3 run `34043351842`：三平台全部通过；
- S4 run `34043351840`：Windows 首次在 `corepack install` 下载阶段触发 Node Undici assertion，未进入依赖安装或项目测试；对同一提交执行 failed-job rerun 后，Ubuntu、macOS、Windows 全部通过。

## 状态结论

S5 的 frozen lifecycle/Event corpus 已取得跨平台 portability evidence。S5 仍保持 Provisional pass，因为 shutdown deadline、进程 signal 和 host termination 尚未执行；这些边界由 S6 继续验证，不能用本次成功替代。
