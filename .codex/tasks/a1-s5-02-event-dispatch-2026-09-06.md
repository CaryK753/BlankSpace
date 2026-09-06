# A1-S5-02 生命周期 Event dispatch 与排空

日期：2026-09-06

## 目标

在现有 S5 lifecycle core 上冻结进程内、best-effort Event dispatch：只在 ready 接受新发布，handler 按稳定 ID 串行运行，嵌套发布采用深度优先并保留 correlation/causation/depth，stop 先拒绝新发布并等待活动 dispatch，再反序停止 entries。

## TODO

- [x] 阅读 A1-S5-02、S5 matrix、RFC-0001、RFC-0002、测试策略和安全边界
- [x] 验证现有 S1～S5 与文档基线
- [x] 实现生命周期门控的 Event dispatcher 与稳定 diagnostics
- [x] 增加 register/factory/start/stopping 拒绝 fixture
- [x] 增加稳定 handler 顺序、handler failure 与嵌套 depth-first fixture
- [x] 增加最大深度 32、depth 33 拒绝 fixture
- [x] 增加 stop 前活动 dispatch 排空 fixture
- [x] 保持原 9 个 lifecycle 场景与 S2～S4 regression 不变
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新 work item evidence、S5 Spike 与 project status
- [x] 提交并同步远端仓库

## 范围边界

- 不加入 durable transport、retry 或 transactional outbox。
- 不加入 shutdown deadline、host 强制终止、并行 handler 或生产 Runtime host。
- 不新增依赖，不引入真实 Service、业务 Kit、网络或数据库资源。
- 原 `macos-arm64.json` 生命周期 transcript 保持不变；Event 证据使用独立 transcript。

## 实现结论

- `InProcessEventDispatcher` 只在 lifecycle phase 为 `ready` 时创建新 dispatch；根 publish 由 active set 跟踪，stop 先切到 `stopping` 再等待 active set 排空。
- handler 按 ID 的字节序稳定排序并串行 await；业务异常写入独立 diagnostics，不拒绝外层 publish。
- handler 获得受控的嵌套 publish，Runtime 派生 correlationId、causationId 和 dispatchDepth；第 33 层拒绝并作为当前 handler diagnostic 记录。
- Event fixtures 使用独立 schema/transcript，避免改写 A1-S5-01 已冻结的九个 lifecycle scenarios。

## 本地验证证据

- macOS 27.0（26A5425a），arm64；
- Node.js v24.20.0；pnpm 10.32.1；
- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：147 个 Vitest、8 个 S1、4 个 S2、7 个 S3、4 个 S4 与 15 个 S5 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过；
- Event matrix hash：`452c665615c33df5fdaf81c45f13a87ce80fce536981784a2e89521c3dcc30b4`。

未跳过检查。S5 仍为 Provisional pass；三平台 S5 对账由 `A1-S5-03` 继续，shutdown deadline 与 host termination 不在本工作项内。
