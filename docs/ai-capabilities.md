# AI、知识库与文档智能能力

## 1. 定位

Blankspace 的 AI 能力目标是让开发者快速增加模型调用、流式 UI、工具执行、知识检索和文档解析，同时保留产品对 Prompt、Agent 流程、数据授权、成本和结果质量的所有权。

AI 不进入 Foundation。第一阶段采用 integration-first：产品可以直接使用成熟 SDK；只有跨产品稳定且需要统一治理的部分才进入 Kit。本文是候选架构，不表示相关 packages、adapters 或命令已经实现。

## 2. 能力分层

```text
Product Overlay
Prompt / Agent graph / Tools / RAG strategy / UX / Eval dataset
        │
        ├── AI Model Kit（模型、流、结构化结果、用量）
        ├── Agent Runtime Kit（可选：长流程、checkpoint、暂停恢复）
        ├── Knowledge Kit（文档、版本、索引、检索、引用）
        ├── Web Research Kit（联网搜索、抓取、来源）
        └── Document Intelligence Kit（解析、OCR、版面、表格）
                │
                ▼
Adapters / Direct integrations
Vercel AI SDK / LangChain / LangGraph / WeKnora / Exa / Tavily /
Docling / MinerU / WeKnora DocReader / PaddleOCR / model providers
```

这些能力不能合并成一个 `AIService`。模型生成、Agent 状态、知识检索、Web 搜索和文档解析拥有不同的数据生命周期、安全风险、成本与失败语义。

## 3. AI Model Kit

### 3.1 最小边界

AI Model Kit 只负责跨产品重复出现的调用治理：

- 文本与多模态输入的版本化 request；
- streaming、cancel、timeout 和 finish reason；
- JSON Schema 驱动的 structured result；
- tool declaration 与 tool-call receipt，但不拥有产品工具实现；
- provider/model capability、region 和数据处理策略；
- token/媒体用量、估算成本、quota 和 budget decision；
- retry、fallback 与 rate-limit 分类；
- trace、redaction、prompt/model version 和安全决策。

Prompt、system instruction、few-shot、模型路由策略和业务输出解释默认属于 Product Overlay。产品可以使用 provider-native metadata，但必须声明锁定，稳定 Contract 不伪装所有模型能力等价。

### 3.2 Vercel AI SDK

TypeScript Web/Server 的首个候选是 Vercel AI SDK direct integration/adapter。官方资料覆盖 provider abstraction、streaming、structured output 和 tool loop，适合 Blankspace 的 React-first 产品路线：[AI SDK providers](https://github.com/vercel/ai/blob/main/content/docs/02-foundations/02-providers-and-models.mdx)、[Vercel streaming](https://vercel.com/docs/functions/streaming-functions)。

Blankspace 不再包装 `generateText`、`streamText` 等每个函数。推荐路径是：

```text
Product Module 使用 AI SDK 公共 API
→ Blankspace adapter 注入已审查 provider、SecretRef 和 policy
→ lifecycle callbacks 写入统一 usage/trace receipt
→ Product UI 消费 AI SDK stream protocol 或显式转换层
```

只有 provider 配置、治理和 receipt 进入稳定边界；SDK 专属 UI/stream 特性可以保留为 `extended`。

## 4. Agent Runtime Kit

简单的 tool loop、路由或两三步处理先写普通 TypeScript Coordinator。只有需要以下能力时才启用 Agent Runtime：

- 长时间运行或进程重启后恢复；
- checkpoint、人工批准、暂停与继续；
- 并行分支、循环、补偿或可审计状态转换；
- 多 Agent handoff，且普通 Coordinator 已被真实用例证明不足。

### 4.1 LangChain 与 LangGraph 的角色

LangChain 适合作为模型、retriever、tool 和 middleware 的集成生态，不成为 Blankspace 的领域 Contract。其官方 JavaScript 文档把它定位为构建 agents 和相关集成的框架：[LangChain overview](https://docs.langchain.com/oss/javascript/langchain/overview)。

LangGraph 面向 stateful、long-running agent/workflow，并提供 checkpoint/store 等能力；它可以独立于 LangChain 使用：[LangGraph overview](https://langchain-ai.github.io/langgraph/index.html)、[LangGraph reference](https://reference.langchain.com/python/langgraph/overview)。因此：

| 场景 | 默认选择 |
| --- | --- |
| 单次生成、流式聊天、简单 tools | Vercel AI SDK 或 provider SDK direct integration |
| 需要大量现成 retriever/tool 集成 | LangChain direct integration |
| 可恢复、多步骤、人工审批 Agent | LangGraph adapter/sidecar candidate |
| 确定性的普通业务流程 | Product Coordinator，不使用 Agent framework |

Agent Runtime 不负责业务授权。每次 tool call 都重新携带可序列化 Actor、tenant scope 和 policy revision；checkpoint 不保存明文 Secret，恢复时也不能沿用已撤销授权。

## 5. Knowledge Kit

Knowledge Kit 管理可查询知识资产，而不是把“向量数据库”当作知识库：

```text
Source
→ immutable source version
→ parse receipt + normalized document
→ chunk/projection version
→ embedding/index receipt
→ retrieval result
→ cited answer（由 Product/AI Coordinator 生成）
```

最小公共语义包括：

- knowledge base、source、document 和 version identity；
- tenant/ACL scope 在 ingestion、index、cache 和 retrieval 全链路一致；
- parse/chunk/embed/index 的 model、参数、hash 和 lineage；
- keyword/vector/hybrid retrieval capability 与 filter；
- passage、页码/位置、原文引用和 source URL；
- stale、partial、quarantined、deleted 状态；
- rebuild、reindex、export、delete 和 provider migration receipt；
- retrieval 与 answer evaluation corpus。

### 5.1 WeKnora adapter

腾讯 WeKnora 是首个完整 knowledge platform 候选。其官方仓库覆盖文档理解、RAG 检索、Agent 与 Wiki 等完整能力，因此更适合作为 self-hosted platform adapter，而不是复制其内部 pipeline：[Tencent WeKnora](https://github.com/Tencent/WeKnora)。

Blankspace adapter 首批只桥接：

- knowledge base 与 product principal 的映射；
- source/document upload、状态和删除；
- retrieval/ask 结果及引用；
- API key、endpoint、health、版本和 capability discovery；
- tenant isolation、审计、备份、恢复与退出验证。

WeKnora 内部的 chunking、rerank、Agent 和 Wiki 能力通过 adapter extensions 暴露，不直接写进 Knowledge Kit 最小 Contract。产品若直接调用 WeKnora 的高级 API，应标记 `provider-native`。

## 6. Web Research Kit

联网研究与产品内部全文搜索是两个能力。`search.query` 查询产品拥有的索引；`ai.web-research` 访问不断变化的外部 Web，并承担来源、抓取时间、许可和提示注入风险。

公共边界至少记录：

- query、locale、时间范围、include/exclude domains；
- search、extract、crawl、answer 等独立 capabilities；
- result URL、canonical URL、title、published/crawled time；
- raw、highlight、summary 的来源关系，不能把供应商摘要冒充原文；
- request/provider ID、latency、cost、rate limit 和 cache policy；
- robots/terms、内容保留和删除策略；
- redirect、DNS/IP、文件下载和恶意内容隔离。

Exa 的 Search API 同时支持搜索和结果内容提取，并暴露 domain/date 等过滤项：[Exa Search API](https://exa.ai/docs/reference/search)。Tavily 提供面向 AI 应用的 Search API，并应按 search/extract/crawl capability 分别接入：[Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)。两者都是 managed candidates，不进入默认 preset；只有产品启用联网研究时才加入 SecretRef、成本和数据出境门禁。

Adapter 不能返回一段无来源文本作为稳定结果。任何模型生成的综合答案必须引用底层 results，并允许产品取得原始来源记录进行核验。

## 7. Document Intelligence Kit

Document Intelligence 负责把文件变成有来源位置的结构化文档；Knowledge Kit 决定如何版本化、切分、索引和检索。OCR 是解析 pipeline 的一种 capability，不等同于整个文档解析。

### 7.1 最小 Contract

- input BlobRef、media type、size、checksum 和 source version；
- parser/模型/OCR engine identity、版本和参数 hash；
- sync/async、progress、cancel、timeout 与 partial success；
- normalized blocks：text、heading、list、table、image、formula、page/region；
- reading order、page/coordinates、confidence、language 和 warnings；
- extracted assets 使用新的 BlobRef，不保存临时本机路径；
- Markdown/JSON 等派生输出及其 lineage；
- password-protected、超限、损坏、宏/压缩炸弹和不支持格式的稳定错误；
- 原文件、临时文件、模型输入与输出的保留/删除策略。

### 7.2 首批候选

| 候选 | 推荐定位 | 重要边界 |
| --- | --- | --- |
| Docling / docling-serve | embedded Python 或 self-hosted parsing service | 使用统一 `DoclingDocument`/Markdown/JSON；明确本地模型、remote VLM 和 OCR 配置 |
| MinerU | self-hosted 或其可验证 cloud service | 复杂 PDF/Office 到 Markdown/JSON；cloud 与开源部署分别声明数据策略 |
| WeKnora DocReader | WeKnora 配套 self-hosted gRPC sidecar candidate | 它是 WeKnora 内部独立解析微服务，不默认承诺为通用公共产品 |
| PaddleOCR | embedded/self-hosted OCR 与结构化解析 candidate | OCR、版面/表格和文档理解 capabilities 分开声明 |

Docling 官方支持从文件/URL转换到统一文档并导出 Markdown/JSON，也提供服务化接口：[Docling usage](https://github.com/docling-project/docling/blob/main/docs/usage/index.md)、[docling-serve](https://github.com/docling-project/docling-serve/blob/main/docs/usage.md)。MinerU 官方仓库将复杂文档转换为适合 LLM 的 Markdown/JSON：[MinerU](https://github.com/opendatalab/MinerU)。WeKnora 官方文档说明 DocReader 是独立 Python gRPC sidecar：[WeKnora DocReader](https://github.com/Tencent/WeKnora/blob/main/website-docs/03-features/03-document-parsing.md)。PaddleOCR 提供 OCR 和结构化文档能力，具体语言、模型与部署支持必须按选定版本验证：[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)。

解析器选择不是单一排行榜。Selection record 必须用产品自己的 corpus 比较：扫描件/数字 PDF、中文/英文/混排、表格、公式、页眉脚注、阅读顺序、耗时、显存/内存、失败恢复和许可证。

## 8. RAG 属于显式产品流程

Blankspace 不提供隐藏式 `askKnowledge()` 万能实现。一个产品 RAG Coordinator 应显式决定：

```text
鉴权与 scope
→ query rewrite（可选）
→ internal retrieval / web research
→ rerank（可选）
→ context budget 与引用选择
→ model generation
→ citation validation
→ usage/audit/evaluation receipt
```

每一步都可以使用 Kit 或 provider-native API，但 Graph 必须显示启用的能力和数据出境。模型不得绕过 Knowledge Kit 的 ACL 直接查询共享向量索引。

## 9. 安全、成本与质量门禁

AI 能力进入 Adopter Preview 前至少验证：

| 风险 | 必需控制 |
| --- | --- |
| Prompt injection | 外部/文档内容标记为 untrusted；tool policy 不服从检索内容中的指令 |
| 数据泄漏 | tenant scope、PII/secret redaction、provider region/retention、禁止训练策略证据 |
| 越权工具 | typed input、Actor、allowlist、确认/审批、幂等和副作用 receipt |
| 成本失控 | request/token/tool/retrieval budget、并发和速率限制、hard stop |
| 幻觉与错误引用 | grounded eval、citation existence/span 检查、无证据时允许 abstain |
| 文档攻击 | 文件类型/大小/页数限制、恶意 archive/macro、sandbox、SSRF 防护 |
| 供应商故障 | timeout、cancel、分类错误、有限重试、fallback policy 和 degraded UI |
| 数据删除 | source、chunks、embeddings、cache、checkpoints 和 provider copy 的可验证删除 |

每个 AI reference adapter 必须带固定 eval corpus、正常/超时/限流/部分输出/取消 fixtures、用量 receipt 和上一版本兼容证据。仅证明模型返回了文字不构成通过。

## 10. 分阶段交付

### Adopter Preview

- Vercel AI SDK 的 provider-native Launch Recipe：流式文本、structured output、一个只读 tool；
- Exa 或 Tavily 二选一 Web Research Recipe；
- Docling embedded/serve 二选一 Document Intelligence Recipe；
- 一个最小 RAG reference overlay，可使用 WeKnora adapter spike 或轻量 PostgreSQL/vector candidate；
- 所有 recipe 都有预算、引用、redaction、取消和失败 UI。

### Phase 5 candidate Kits

- AI Model Kit 与至少两个 model provider 用例；
- Knowledge Kit 与 WeKnora platform adapter；
- Document Intelligence Kit 与两个不同解析器 corpus；
- Web Research Kit 与 Exa/Tavily capability 对照；
- Agent Runtime Kit 只有在持久长流程真实需求出现后启动 LangGraph spike。

AI 能力按 Kit 独立关闭，不因一个聊天 Demo 成功而整体标记完成。
