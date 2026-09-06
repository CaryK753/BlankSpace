# A1-S5-01 生命周期 core 与资源账本

日期：2026-09-06

## 目标

冻结串行 A→B→C→D factory/start/stop 生命周期、单一 ready 状态、资源账本、启动失败回滚，以及幂等/并发 stop 的确定性行为；不提前实现 Event dispatch、shutdown deadline 或生产 Runtime host。

## TODO

- [x] 阅读 A1-S5-01、S5 matrix、RFC-0001、RFC-0002、测试策略和安全边界
- [x] 接管并审阅上一 Agent 留下的 S5 lifecycle core、runner、schema 与 transcript
- [x] 验证正常启动/关闭和严格反序 stop
- [x] 验证 factory/start/部分启动清理失败，保留主错误与残余资源
- [x] 验证 stop 错误不阻断其余资源回收
- [x] 验证连续/并发 stop 共享同一终态且不重复释放
- [x] 验证 start 期间请求 stop 不再启动后续 entry 且不进入 ready
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新 work item evidence、S5 Spike 与 project status

## 接手审查结论

- 遗留实现只使用内存 entry 与资源句柄，没有新增依赖、真实网络/数据库资源或业务 Kit。
- failed entry 的部分资源由 fixture 自身清理；Runtime 只停止已经成功 started 的前置 entries，符合 RFC-0001 的资源所有权规则。
- 启动错误保留为 `primaryError`，自身清理和反序 stop 错误进入附加 diagnostics；故意无法回收的资源保持 active 并计入余额。
- `stop()` 在启动中、ready、stopping 和终态均复用同一个 shutdown promise；资源释放次数由 ledger 和 fixtures 双重断言。
- canonical hash 只覆盖平台无关的场景内容；环境信息单独记录，因此后续可执行 Linux/macOS/Windows 对账。

## 市场方向核对

调研结论要求短期优先形成“可运行、可部署、可验证”的 SaaS 纵向切片，而不是继续扩大抽象设计。仓库现有 `docs/mvp-adoption.md`、Phase 1 门禁和复杂度预算已经明确这条约束；S5 core 是可靠 Runtime 的直接前置，不需要改写长期架构。此次仅修正路线图陈旧状态，不把 AI、UI、Identity、Database、CLI 或 Launch Recipe 扩入当前工作项。

## 本地验证证据

- macOS 27.0（26A5425a），arm64；
- Node.js v24.20.0；
- pnpm 10.32.1；
- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：147 个 Vitest、8 个 S1、4 个 S2、7 个 S3、4 个 S4 与 8 个 S5 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

未跳过检查。S5 core 可以记录为 Provisional pass；跨平台 S5 conformance、Event dispatch、shutdown deadline 和 host 强制终止尚未形成证据，不能把完整 S5 标为 Pass。
