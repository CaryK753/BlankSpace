# RFC-0018：Editor Engine 最小边界

## 状态

Proposed

## 背景

Phase 2 必须用 Block 文档验证 Local Workspace，但稳定 Editor Kit 原计划到 Phase 5 才形成。如果 Phase 2 直接把某个引擎写进产品内部，后续抽象会返工；如果等待 Phase 5，则路线倒置。本 RFC 冻结一个足以执行纵向切片的 experimental boundary，不承诺通用编辑器 API，也不要求 Foundation 理解 Block、Canvas 或 CRDT。

机器草案位于 [`editor-engine-v1.schema.json`](../schemas/proposed/editor/editor-engine-v1.schema.json)。通过 E1 spike 前它不进入正式 contracts。

## 决策

### 1. 分两次承诺

- Phase 2：reference product 使用一个 experimental Editor adapter；公共边界只保证生命周期、事务、持久化、导入导出、观察和同步桥接；
- Phase 5：至少两个明显不同用例通过后，才决定哪些部分晋级为稳定 Editor Kit；Tiptap 与 BlockSuite adapter 都只是候选实现，不是 Contract 本身。

Phase 2 不承诺编辑引擎可热切换，也不承诺不同引擎共享 selection、undo history 或内部 document model。

### 2. 身份与所有权

```ts
interface EditorDocumentRefV1 {
  workspace: WorkspaceRef;
  documentId: string;
  engineId: string;
  formatId: string;
  formatVersion: string;
}
```

`documentId` 由客户端生成且在 Workspace 内稳定。`engineId + formatId + formatVersion` 决定内容解释方式；打开不支持的格式必须返回 typed error，不能猜测或静默迁移。Workspace Kit 拥有 Workspace 生命周期，Editor adapter 拥有内容事务和格式，Files Kit 拥有 blob bytes，Search Kit 只消费明确发布的索引投影。

### 3. Host 与 Engine 的边界

Host 提供：Workspace scoped storage transaction、blob references、clock/ID source、受控 background scheduling、diagnostics 和 capability 查询。Engine 提供：create/open/close、只读 snapshot、transaction、change observation、export/import、index projection 与可选 sync codec。

Engine 不直接读取全局数据库、用户 home、网络、session 或 secret；所有外部能力经 scoped Service 注入。Foundation 不读取 Block tree、selection 或 undo stack。Manifest 的 `publicApiSchemaHash` 和 `operations[]` 必须逐项声明上述操作的 request/result schema；Host 只调用声明过的操作，adapter fixture 对账实际 exports，防止公共接口退化为文档约定。

### 4. 事务与持久化

一次用户可见编辑必须产生单一 `EditorTransactionReceipt`：document、base revision、result revision、持久化记录 hashes、blob ref changes、sync operations 和 index invalidations。Editor 数据域拥有 engine state、receipt、逻辑 blob-reference records、sync outbox 和 index invalidations，并通过 Host 注入的 Workspace-scoped storage transaction 一次提交；任一写入失败则全部不可见。这不是跨 Kit transaction：Files Kit 仍拥有 blob bytes、上传和 GC，Sync/Jobs 只消费 Editor 已提交的 outbox，Search 只消费 invalidation/projection。它们不得把自己的私有表加入 Editor transaction，也不得使文档提交等待远端副作用。

revision 只用于检测本地观察顺序，不被当作跨设备全序。receipt 不包含用户主目录、随机时间戳或未声明路径；相同确定性输入产生相同 canonical hashes。

Engine 可以保存 opaque snapshot/change bytes，但必须声明 `formatId/version`、canonical encoding、最大尺寸、校验 hash 和 migration 支持窗口。不能只序列化运行时对象或依赖进程内指针。

### 5. Selection、Undo 与命令

Selection、composition、cursor 和 undo/redo 默认属于 engine session，不进入 Foundation 或跨引擎 Contract。Shell、跨 Kit integration 和 AI 自动化只能通过 adapter 的版本化 portable command/contribution surface 调用；这些命令的 ID、参数 schema、可用条件和结果 schema 必须可枚举。Product Module 内部可以直接使用上游 public commands/extensions，只登记 package/version/owner，不要求 Blankspace 逐个包装或枚举；直接调用仍不得绕过 Workspace scope、权限、持久化提交和 secret 边界。

Undo 只承诺在同一打开 session 和 engine 声明的持久化范围内工作。多人协作下 undo 的意图/冲突语义由 engine/data-domain protocol 声明，Blankspace 不默认把历史操作反向重放。

### 6. Schema Extension

Product/Kit 通过静态 extension manifest 注册 block/node kind、schema version、commands、render contract、index projection 和 migration。command 另有 availability schema；content kind 明确 schema version、render contract hash 与 index projection schema hash。extension identity 全局唯一；依赖图无环；未知 required kind 阻止可写打开，允许产品策略选择 read-only recovery。动态下载 schema 或打开文档后再注册 required extension 不受支持。上游已有 extension 系统时优先复用；Blankspace manifest 只登记装配、权限、兼容和跨领域所需元数据，不复制 Tiptap/BlockSuite 的完整 extension API。

### 7. Blob 与索引

内容只保存不可变 `BlobRef`，不得把临时本地路径同步到其他端。新增/移除 blob ref 与文档事务一同记录；实际上传、下载、GC 和配额由 Files Kit 管理。Search 只读取 engine 产生的版本化 projection；索引可重建，不是文档权威状态。

### 8. Sync Bridge

Engine 声明其数据域的 `protocolId/version` 与 operation codec。Blankspace Sync 只传输、排序、确认和拒绝机器 envelope，不解释 engine payload。非协作 engine 可以发布 replace/version-check operations；CRDT engine 可以发布增量 updates，但必须满足 RFC-0019 的 operation identity、幂等、checkpoint 和 quarantine 规则。

### 9. Renderer 与多端

Editor UI 属于对应 UI Family renderer。React、SwiftUI 和 Compose 不共享组件树；它们必须对同一 document/command/state schema 给出等价可达行为。若某 engine 只支持 React，其他客户端必须在 Graph 中明确 unsupported 或 read-only，不能伪装成 official 全端能力。

## E1 Spike

E1 分两个门禁：E1a 在 Phase 2 实现前用 in-memory/fault-injection storage harness 冻结边界，至少接入一个真实 Tiptap 类 adapter；E1b 是 Phase 2 退出门禁，在真实 Local Provider 上重跑事务、离线重启和恢复场景。第二个明显不同的 BlockSuite 类 Page/Edgeless adapter 属于 Phase 5 稳定 Editor Kit 的晋级证据，不阻止 Phase 2 只交付 experimental adapter。E1a/E1b 共用以下矩阵：

| 场景 | 必需证据 |
| --- | --- |
| 创建、编辑、关闭、离线重启 | receipt、storage hashes 与内容一致 |
| transaction 中 blob/outbox 失败 | 文档修改不可见 |
| required extension 缺失/版本不支持 | typed error 或 read-only recovery |
| import/export 往返 | 明确允许的语义保持且格式版本可查 |
| snapshot 损坏 | hash 失败，不覆盖最后可信版本 |
| index projection 失败 | 文档仍可编辑，索引可重建 |
| 同一操作重复观察 | operation ID 不重复产生业务效果 |
| 上一 minor adapter/format | migration 或明确拒绝路径 |

E1a/E1b 用 Tiptap 类 adapter 验证结构化富文本与上游 API escape hatch；Phase 5 再用 BlockSuite 类 adapter 验证共享 Block 数据与 Page/Edgeless capability，或用等价的明显不同引擎替代。测试目标是证明共同边界保持薄，而不是让两者伪装成相同编辑器。第二用例未通过前只能称 experimental Editor boundary。

## 验收条件

1. Foundation 与 Workspace Contract 不出现 Block/Canvas/CRDT 类型；
2. 完全离线编辑和崩溃恢复不依赖网络；
3. storage、blob refs、outbox 在同一提交边界；
4. 产品扩展不导入 adapter internal；
5. renderer unsupported/read-only 状态进入 Graph 和 UI；
6. 真实 adapter 能实现边界而无需复制大部分引擎 API；
7. 第二用例证明边界不是只为一个文档模型改名。
8. adapter 不镜像引擎 commands/extensions，产品可以从明确入口使用上游公共 API。

## 非目标

- 通用富文本 AST、通用 Canvas API 或通用 CRDT；
- 跨引擎保留 selection/undo history；
- Phase 2 就承诺稳定第三方 Editor SDK；
- 让 Editor adapter拥有 Workspace、Files、Search 或 Sync 的全部实现。
- 由 Blankspace 自研富文本、画布、selection、undo 或 CRDT 引擎。

## 重审触发条件

真实 adapter 无法同时满足事务与性能、跨端 renderer 需要泄漏 engine internal、第二用例需要完全平行 API，或同步 payload 无法遵守 RFC-0019 时重审。
