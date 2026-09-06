# Integration Catalog

## 1. 用途

本页帮助产品开发者判断“Blankspace 提供什么、应该复用什么、由谁负责”。它是候选目录，不是已交付清单或依赖冻结；确切版本以未来的 `blankspace.lock` 和 compatibility manifest 为准。

本页聚焦薄 adapter 的接入方式；跨身份、数据、任务、文件、搜索、通知、计费、Feature Flag、可观测性、分析、后台和 AI 的完整选择矩阵见 [SaaS Capability Catalog](capability-catalog.md)。目录分类与支持状态由 [RFC-0025](rfcs/0025-capability-catalog-and-selection.md)定义。

总原则是：**Blankspace 建设集成层，不重造成熟领域引擎。** 完整决策见 [RFC-0020](rfcs/0020-integration-first-kits.md)。

## 2. 责任划分

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Foundation | 装配、生命周期、配置、Graph、诊断、裁剪、升级协议 | 领域算法或产品 UI |
| Kit/adapter | 把上游能力接入稳定的最小边界，提供 conformance 与兼容元数据 | 复制上游全部 API |
| 上游项目 | 编辑、同步、检索、支付等领域内部能力 | Blankspace 的产品装配 |
| Product Overlay | 选型、深度配置、业务语义、页面与跨 Kit 流程 | 维护 Blankspace 核心 |

## 3. 首批候选

| 能力 | 上游候选 | Blankspace 只集成的边界 | 重要限制 |
| --- | --- | --- | --- |
| 富文本/结构化文档 | Tiptap | lifecycle、document ref、持久化 receipt、projection、sync bridge、diagnostics | 不等于白板或数据库视图；headless 不等于没有产品 UI 工作 |
| Block 文档 + Edgeless | BlockSuite | 与上行相同，另声明 Page/Edgeless renderer capability | 更接近 AFFiNE 内容模型，但不能因此写进 Foundation |
| 代码编辑 | Monaco 或 CodeMirror | mount lifecycle、文件/模型 identity、权限和诊断 | 不伪装成普通富文本 adapter |
| 协作数据 | Yjs | update codec、checkpoint、awareness capability、provider lifecycle | CRDT 不自动解决认证、授权、blob 和备份 |
| 身份认证 | Better Auth；Keycloak/ZITADEL/Ory；Auth0 等托管 IdP | Account/Session/Actor、配置和审计事件 | embedded/self-hosted/managed 必须分别声明；Organization 插件只是可选 starter |
| 细粒度授权 | OpenFGA、SpiceDB、Casbin | `check/checkMany`、policy revision、consistency、审计和 conformance | 产品拥有 object/relation/permission schema；授权引擎不替代数据隔离 |
| 支付 | Stripe、Waffo Pancake、Paddle、应用商店 SDK 等 | checkout、webhook inbox、退款、reconciliation 与供应商映射；Billing Kit 保有 entitlement | PSP 与 MoR capability 不同；供应商对象不泄漏进稳定 Contract |
| 搜索 | Meilisearch/Typesense/Algolia 等 | projection ingestion、query、健康与重建 | ranking 高级参数留在 adapter/产品层 |
| 后台任务 | pg-boss、BullMQ 或平台队列 | enqueue、worker lifecycle、retry diagnostics | 优先减少初始服务数；交付语义必须按 adapter 声明 |
| 对象存储 | S3-compatible 或平台 SDK | immutable blob ref、上传下载、校验与 GC capability | 本地路径不能成为同步协议的一部分 |
| AI 模型与流式 UI | Vercel AI SDK、模型 provider SDK | provider/SecretRef、stream/cancel、structured result、usage/budget/trace | 不重复包装 SDK 全部 API；Prompt 属于产品 |
| Agent 编排 | LangChain、LangGraph | tool policy、checkpoint/恢复、状态与审计接缝 | 普通流程继续用 Coordinator；LangGraph 只用于持久长流程 |
| 知识平台 | WeKnora | knowledge/document identity、ingestion status、retrieval/citation、health/exit | 高级 Agent/Wiki/chunking 作为 extension/provider-native |
| 联网研究 | Exa、Tavily | search/extract/crawl capability、来源、时间、成本与安全 receipt | 不与产品内部全文搜索混用 |
| 文档解析/OCR | Docling、MinerU、WeKnora DocReader、PaddleOCR | BlobRef、结构化 blocks、page/region、lineage、partial/error | OCR 不等于完整解析；self-host/cloud 分别验证 |

截至 2026-09-06 的官方资料核对：Tiptap 将 Editor 定义为基于 ProseMirror 的 headless、framework-agnostic 富文本编辑器，并以 extension 扩展；协作扩展可接入 Yjs。BlockSuite 同时提供 PageEditor 和带 canvas rendering 的 EdgelessEditor。这支持把二者视为不同内容范围的候选，而不是互相完全替代。[Tiptap 文档](https://tiptap.dev/docs)、[Tiptap Extensions](https://tiptap.dev/docs/editor/core-concepts/extensions)、[Tiptap Collaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)、[BlockSuite Overview](https://blocksuite.io/guide/overview)

BullMQ 官方将其描述为基于 Redis 的 Node.js 队列；Meilisearch 的核心能力是对索引文档执行全文检索。它们是说明 integration-first 的候选，不代表 Blankspace 已选定或交付对应 adapter。[BullMQ 文档](https://docs.bullmq.io/)、[Meilisearch 文档](https://www.meilisearch.com/docs/capabilities/full_text_search/overview)

Better Auth 是 MIT 开源的 TypeScript authentication 候选，其 Organization plugin 支持成员、团队和可配置角色，但 Blankspace 不采用其 schema 作为统一产品模型。SpiceDB/OpenFGA/Casbin 是开源授权候选；其中关系型引擎允许产品自行定义资源、关系与 permission。[Better Auth](https://github.com/better-auth/better-auth)、[Organization plugin](https://better-auth.com/docs/plugins/organization)、[SpiceDB](https://github.com/authzed/spicedb)、[OpenFGA](https://github.com/openfga/openfga)、[Casbin](https://github.com/apache/casbin)

Waffo Pancake 是 Payment Adapter 候选而非框架依赖。其官方 API 使用 RSA 签名的 server credential，提供 hosted checkout、一次性/订阅产品、refund 与多币种/支付方式 capability；Blankspace adapter 必须额外提供 durable webhook inbox、环境隔离、幂等和 reconciliation。[Waffo 官方开发文档](https://docs.waffo.ai/llms-full.txt)

## 4. Tiptap 的推荐使用方式

若产品需要 Notion 类的富文本或结构化文档，优先在 Product Module 中使用 Tiptap 原生 extension、command 和 React/Vue integration。Blankspace adapter 不重复包装这些 API，只桥接：

```text
Editor session lifecycle
→ Workspace-scoped persistence
→ blob references
→ search projection
→ Yjs/sync envelope（若启用）
→ capability/diagnostic/upgrade evidence
```

产品自定义 slash menu、bubble menu、node view、快捷键和样式仍属于产品 UI。跨 SwiftUI/Compose 客户端不能假定复用 Tiptap 的 DOM renderer；应声明 WebView/hybrid、read-only renderer、原生等价实现或 unsupported，不能隐藏平台差异。

这里也不要求所有 UI 从零写。Web/Desktop 优先使用成熟的 headless/accessibility primitives、Tiptap 提供的可选 UI components/templates 或其他经过审查的组件库；原生端优先使用 SwiftUI/Compose 的平台控件和成熟库。Blankspace Design System 负责 token、recipe、状态语义和 Shell 接缝，产品负责把现成组件组合成自己的页面。只有带有稳定 Kit 语义、能被多个产品复用的薄 renderer 才值得由 Blankspace 维护。

若目标是同一数据模型在文档与无限画布之间切换，应先比较 BlockSuite 与“Tiptap + 独立 canvas 引擎 + 自定义共享模型”的总成本。后者不是安装两个组件就自然完成，必须额外证明 identity、selection、schema、undo、事务和协作语义。

## 5. 何时可以直接使用上游

以下情况无需等待官方 Kit：

- 能力只被一个 Product Module 使用；
- 不需要跨 Kit 的稳定语义；
- 产品愿意接受上游 API 和数据格式锁定；
- 产品自己维护配置、安全、升级与测试。

应在 Product manifest 声明 direct integration，包括稳定 ID、package/version、targets、capabilities、owner/security contact 和用途。未来工具应从各目标依赖图核对 resolved version、报告漏报，并把它纳入依赖审计和升级影响报告，但不会假装为其提供 adapter 级兼容保证；这些声明 schema 与检查当前尚未实现。

## 6. 反模式

- 给 Tiptap 每个 command 再写一个 Blankspace command；
- 自己实现 CRDT、富文本 selection、支付签名或搜索 ranking，只为减少一个依赖；
- 把某个官方 adapter 变成 Foundation 的隐式依赖；
- 用一个 `provider: any` 掩盖 capability 和版本差异；
- 为了“可替换”承诺无损迁移，却没有格式转换和回滚证据；
- 把上游 UI 组件强行共享到 SwiftUI/Compose。
