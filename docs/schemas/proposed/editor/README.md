# Proposed Editor schemas

这里保存 RFC-0018 的 E1 实验输入，不是 Phase 2 已交付 Contract。通过真实 adapter、第二用例、持久化故障和升级 corpus 后，才可迁入 `packages/contracts/schemas/`。

- `editor-engine-v1.schema.json`：Engine manifest、DocumentRef 与 TransactionReceipt 的判别联合；
- opaque engine payload 仍须声明 format、encoding、version、size 和 hash；
- selection、undo stack 和内部 Block tree 不进入跨引擎 schema。

`fixtures/` 当前包含 receipt 正例和 revision 倒退反例；语义检查由 `pnpm verify:docs` 执行。
