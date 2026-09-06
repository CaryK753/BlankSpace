# Proposed Sync Protocol schemas

这里保存 RFC-0019 的 Y1 transport-independent wire 草案，不代表 Sync Kit 已实现。

`sync-protocol-v1.schema.json` 覆盖 hello/negotiation、operation batch、逐 operation result、checkpoint 与 blob chunk。数据域 payload 保持 opaque，但 identity、encoding、hash、版本和恢复结果必须可验证。

`fixtures/` 当前包含合法单 operation batch 与非连续 sequence 反例；语义检查由 `pnpm verify:docs` 执行。Y1 仍需扩展完整故障 corpus。
