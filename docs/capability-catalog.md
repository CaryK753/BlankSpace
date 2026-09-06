# SaaS Capability Catalog

## 1. 这份目录解决什么

Blankspace 不为每个 SaaS 功能重新实现一套认证、搜索、通知或分析系统。它维护的是一份**能力目录和可替换接缝**：开发者先选择所需能力，再按部署、许可证、平台和运维约束选择实现。

目录中的产品名称都是候选，不代表已经集成、免费、兼容或获得官方支持。实际状态以未来生成的 Product Graph、`blankspace.lock` 和 compatibility evidence 为准。

## 2. 不把不同事物混为一谈

每个目录项必须分别声明以下维度：

| 维度 | 允许值 | 含义 |
| --- | --- | --- |
| capability | 稳定的领域能力 ID | 产品真正需要的结果，如 `identity.authentication` |
| delivery model | `embedded` / `self-hosted` / `managed` / `hybrid` | 代码运行在哪里、由谁运维 |
| license model | `oss` / `open-core` / `source-available` / `proprietary-service` | 不能用“开源”一词掩盖商业边界 |
| support level | `candidate` / `experimental` / `official-reference` / `verified` / `community` / `direct` / `deprecated` | Blankspace 对哪个版本承诺了什么 |
| portability | `portable` / `extended` / `provider-native` | 使用的是公共 Contract、可选扩展，还是供应商专属 API |

例如 Better Auth 是可嵌入应用的开源 TypeScript 认证框架候选；Auth0 是外部托管身份平台候选。两者可以满足相邻需求，但部署、数据控制面和故障模型不同，不能只写成 `provider: better-auth | auth0` 就声称等价。

## 3. 推荐的选择体验

目标 CLI 应先询问约束，再给出透明结果：

```bash
blankspace add identity
blankspace add search --delivery self-hosted
blankspace inspect capability identity.authentication
blankspace doctor integration
```

选择器至少考虑：目标 runtime、是否允许 SaaS、数据驻留、许可证政策、现有基础设施、离线要求、预计规模和团队运维能力。它输出推荐理由、缺失能力、所需 secrets、数据出口和替换成本；不会仅按流行度自动安装。

一个新建 Web SaaS 的建议起点是：

```text
PostgreSQL
├── embedded identity（Better Auth 候选）
├── embedded authorization（Casbin starter 候选）
├── PostgreSQL jobs（pg-boss 候选）
└── transactional outbox

OpenTelemetry instrumentation
S3-compatible file contract（仅需要文件时）
Search / Notifications / Billing / Analytics（按产品显式增加）
```

这条路径有意减少初始服务数量。进入企业 SSO、复杂 B2B 身份、多区域、高吞吐队列或关系授权后，再替换为外部系统；Preset 不应提前带入所有基础设施。

## 4. 主要能力目录

### 4.1 Identity 与 Access

| 能力 | 开源/自托管候选 | 托管候选 | Blankspace 边界 |
| --- | --- | --- | --- |
| Authentication、Session、Passkey、社交登录 | Better Auth；Keycloak；ZITADEL；Ory | Auth0、Clerk、WorkOS、ZITADEL Cloud | `AccountRef`、`SessionRef`、`ActorRef`、登录/登出/恢复、审计事件、claims 映射 |
| 企业 federation、OIDC/SAML、SCIM | Keycloak、ZITADEL、Ory 组件 | Auth0、WorkOS | connection capability、tenant-aware callback、provisioning receipt；协议对象不泄漏到产品模型 |
| Authorization | Casbin、OpenFGA、SpiceDB、OPA/Cedar 实现 | 对应托管服务 | `check/checkMany`、policy revision、consistency、decision reason、审计 |

推荐分层：Authentication 只证明主体是谁；Authorization 决定主体能做什么；产品自己的 Organization、Workspace、Team、Role 和资源关系仍由 Product Overlay 定义。Better Auth 可作为 Phase 1 embedded reference spike；需要独立身份控制面时比较 Keycloak/ZITADEL/Ory；Auth0 属于 managed adapter，不应被标记成 OSS 实现。

### 4.2 Database、Cache 与 API

| 能力 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| 事务数据库 | PostgreSQL；产品可选托管 PostgreSQL | connection lifecycle、health、migration owner、transaction capability、backup/restore evidence |
| TypeScript data access | Drizzle、Kysely、Prisma 等 | 不建立万能 ORM API；Kit 只声明 migration 和 transaction integration |
| Cache / distributed coordination | Valkey/Redis、Dragonfly；Upstash 等托管服务 | namespaced key、TTL、atomic capability、degraded behavior；cache 不是事实源 |
| HTTP/API server | Fastify 等；产品也可接现有 server | RFC-0022 的 operation、validation、error、pagination、idempotency 与生成客户端 |
| Rate limiting | 内存/数据库 starter、Valkey/Redis adapter、网关能力 | subject/key、window、decision、retry metadata、fail-open/closed policy |

Database Kit 不拥有其他 Kit 的表，也不把 ORM entity 变成公共 Contract。Rate Limit、Cache 和 Lock 是不同 capability，不能因为都使用 Redis 就合并为一个语义不明的 `RedisService`。

### 4.3 Jobs、Workflow 与 Events

| 层级 | 候选 | 使用条件 |
| --- | --- | --- |
| Phase 1 可靠后台任务 | pg-boss 或 BullMQ | 已有 PostgreSQL 时优先验证 pg-boss；已有 Redis/高队列需求时验证 BullMQ |
| Durable workflow | Temporal 等 | 只有真实长流程、human-in-the-loop 或跨天恢复需求才启用 |
| 领域事件投递 | transactional outbox + Jobs/Event transport | 关键副作用必须具备幂等、重试、DLQ/隔离和 reconciliation |

Blankspace 的 `JobsService` 只统一 enqueue、schedule、cancel capability、attempt 与可诊断状态，不承诺所有 adapter 的优先级、flow、cron 或 exactly-once 语义相同。Temporal 不进入基础 Preset，也不成为跨 Kit 编排的默认方式；普通产品流程仍是 TypeScript Coordinator。

### 4.4 Files、Media 与 CDN

| 能力 | 自托管/开放候选 | 托管候选 | Blankspace 边界 |
| --- | --- | --- | --- |
| Object storage | S3-compatible 实现、Garage、MinIO 等（逐项审查许可证） | S3、R2、B2、云厂商对象存储 | immutable `BlobRef`、checksum、upload/download、signed access、retention、GC |
| Image/video transform | libvips/Sharp、FFmpeg | Cloudinary、Imgix、Mux 等 | transform request/receipt、source lineage、异步状态，不统一完整媒体 API |
| Delivery | 自建 reverse proxy/CDN | Cloudflare、云 CDN | public/private policy、cache invalidation、signed URL capability |

文件元数据归 Files Kit，二进制归 adapter。公共引用不能包含本机路径或供应商 bucket key；迁移工具必须能枚举、校验并重新写入 blob。

### 4.5 Search 与 Discovery

| 场景 | 候选 | 推荐 |
| --- | --- | --- |
| 产品全文搜索 | Meilisearch、Typesense、OpenSearch；Algolia managed | Phase 5 首先比较 Meilisearch/Typesense 的部署与相关性 |
| 数据库内小规模搜索 | PostgreSQL FTS / pg_trgm | 可作为小型 SaaS starter，但必须记录规模上限 |
| 向量/混合检索 | pgvector、Qdrant、OpenSearch 等 | 作为独立 capability，不把向量搜索偷偷塞进全文搜索 Contract |

Search Kit 接收版本化 projection，提供 query、cursor、health、rebuild 和 stale-state diagnostics。ranking、synonym、facet、hybrid 参数通过 adapter extension 暴露；事实源永远不是搜索索引。

### 4.6 Notifications、Email 与 Messaging

| 层 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| 模板/邮件 UI | React Email、MJML 等 | 模板编译、locale、version；产品拥有内容 |
| 单通道 delivery | Nodemailer/SMTP、SES、Resend、Postmark、Twilio 等 | normalized destination、send receipt、provider message ID、分类错误 |
| 多通道 orchestration / inbox / preferences | Novu self-hosted 或 Cloud 等 | subscriber mapping、preference、workflow trigger、delivery status capability |

Identity 验证邮件可继续使用 Identity 自有 outbox 最小路径，不强制安装通用 Notifications Kit。需要站内信、摘要、push、SMS 或用户偏好时再启用 Notifications。营销同意、事务通知和系统告警必须是不同 purpose，退订规则不能由 adapter 猜测。

### 4.7 Billing、Entitlement 与 Metering

| 能力 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| Checkout / payment / refund | Stripe、Waffo Pancake、Paddle、App Store、Play Billing | Payment Adapter；durable webhook inbox；unknown-result reconciliation |
| Subscription / entitlement | Billing Kit 自有状态机 | provider-neutral plan、subscription、entitlement、trial 与 isolation root |
| Usage metering / invoice engine | Lago、Kill Bill 等候选或供应商能力 | usage event identity、aggregation policy、late event、correction和账单 receipt |

Waffo 与 Stripe 的商业角色和 capability 不相同；Catalog 只能声明能力差异，不能假装一键无损切换。支付和计费的详细状态机见 RFC-0024。

### 4.8 Feature Flags、Experiment 与 Configuration

| 能力 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| Flag evaluation | OpenFeature API/SDK | typed key、evaluation context、variant、reason、provider status |
| Flag management | Unleash、GrowthBook；LaunchDarkly 等托管平台 | environment/project mapping、bootstrap、offline/default policy |
| Experiment assignment | GrowthBook、PostHog 等 | stable subject、exposure event、variant；分析结论不进入 Foundation |

优先采用 OpenFeature 这一 vendor-neutral 标准，而不是再发明 `FlagService` 协议。但 OpenFeature 只统一 evaluation，不自动统一 flag 定义、治理、实验统计或供应商所有 capability。

### 4.9 Observability、Audit 与 Product Analytics

| 能力 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| Telemetry instrumentation | OpenTelemetry | trace/metric/log 语义、correlation、redaction、exporter health |
| OSS observability backend | Prometheus/Grafana/Loki/Tempo、Jaeger、OpenSearch 等 | 由部署 profile 选择，不进入产品业务 Contract |
| Managed monitoring/error tracking | Sentry、Datadog 等 | exporter/integration，供应商 SDK 专属功能属于 extension |
| Product analytics | Umami、Plausible、PostHog；Amplitude/Mixpanel 等 | consent、purpose、event schema/version、identity policy、delivery receipt |
| Security/business audit | 产品/Kit 自有 append-only audit store | actor、action、resource、decision、occurred/recorded time、integrity/export |

OpenTelemetry 是遥测框架，不是后端，也不是合规审计账本。Product Analytics、运行遥测和安全审计必须分开配置保留期、PII、访问权限与删除策略。

### 4.10 Admin、Support 与 Operations UI

| 场景 | 候选 | 使用方式 |
| --- | --- | --- |
| 产品内管理后台 | react-admin、Refine 等 | 作为 Product Overlay 的 Web UI accelerator，对接 RFC-0022 client |
| 内部工具 | Appsmith、ToolJet、Retool 等 | 独立受控部署，不赋予绕过业务授权的数据库超级权限 |
| Kit 运维面板 | 上游 dashboard 或薄 renderer | 只暴露经过授权的 diagnostics/actions，不复制上游控制台 |

Admin UI 不是一个拥有所有数据的超级 Kit。它调用正常 Service/API、复用相同 Authorization，并记录 impersonation、敏感导出和破坏性操作。react-admin 开源核心与商业扩展也必须在清单中分别标注。

### 4.11 Content、Realtime 与 AI

| 能力 | 候选 | Blankspace 边界 |
| --- | --- | --- |
| Rich text / block / canvas / code | Tiptap、BlockSuite、Monaco、CodeMirror | RFC-0018 的 document identity、lifecycle、persistence、projection、export |
| CRDT / realtime transport | Yjs、Hocuspocus 等；Liveblocks 等托管服务 | update envelope、awareness、auth bridge、checkpoint、recovery |
| AI model access | 各模型 SDK、Vercel AI SDK 等候选 | model capability、tool policy、usage、stream、cancel、trace、redaction |
| Retrieval / agent workflow | 产品选择的库或服务 | 属于 Product Module/可选 AI Kit，不让 Foundation 依赖 agent framework |

AI Kit 必须把模型调用与产品授权、数据访问和工具执行分开。Prompt、agent 流程和模型选择通常属于产品；Blankspace 可复用的部分是密钥边界、structured result、tool audit、预算、取消和可观察性。

AI 不作为单一 capability 交付。模型调用、持久 Agent Runtime、Knowledge、Web Research 与 Document Intelligence 分别选择和验证；完整边界见 [AI、知识库与文档智能能力](ai-capabilities.md)。首批候选包括 Vercel AI SDK 的 TypeScript direct integration、LangChain integrations、LangGraph durable runtime、WeKnora knowledge platform、Exa/Tavily web research，以及 Docling/MinerU/WeKnora DocReader/PaddleOCR document intelligence。列入候选不代表默认安装或官方支持。

### 4.12 Deployment 与 Operations

这些是进程外 platform capabilities，不是普通业务 Kit：

| 能力 | 开源/平台候选 | Blankspace 边界 |
| --- | --- | --- |
| Image discovery / GitOps | Flux、Argo CD、registry/云平台能力 | channel/policy、digest candidate、desired/actual state、drift receipt |
| Progressive delivery | Kubernetes Deployment、Argo Rollouts、云 revision/traffic split | rolling/canary/blue-green capability、analysis、promote/abort/rollback receipt |
| Artifact trust | Sigstore Cosign、registry signing/provenance | digest、signature identity、provenance/SBOM evidence 与拒绝原因 |
| Logs/metrics/traces | OpenTelemetry + Prometheus/Grafana/Loki/Tempo/Jaeger 或托管 backend | structured semantic、redaction、correlation、export health |
| Status/incident | Alertmanager/Grafana OnCall、status page/incident provider 等 | component state、alert/incident/runbook/status receipt；不自建 paging backend |
| Secrets/certificates | Vault、External Secrets、云 secret manager/KMS、cert-manager | SecretRef/version、rotation/revocation、certificate status 和 evidence |
| Backup/DR | PostgreSQL 原生备份/PITR、object versioning、Velero 等 | inventory、RPO/RTO、backup/restore receipt、product invariant verification |
| Capacity/cost | HPA/KEDA、OpenCost、云平台能力 | limit/budget、scale decision、quota/anomaly diagnostics |

完整发布状态机、客户端更新和回滚边界见 [Platform Operations](platform-operations.md)与 [RFC-0026](rfcs/0026-operations-plane-and-progressive-delivery.md)。自动检测更新不等于自动部署；应用镜像回滚也不等于数据库和外部副作用恢复。

## 5. 一个候选如何晋级

候选不能因为“开源”“知名”或文档齐全就进入官方 Preset。晋级为 `official-reference` 至少要有：

1. 明确 package/image/service 坐标、SPDX 和商业功能边界；
2. 支持的 target、runtime、delivery model 与最小安全配置；
3. capability matrix，包含明确 unsupported；
4. 正常、超时、重复、乱序、限流、撤销与部分失败 fixtures；
5. 数据出口、备份恢复、provider 更换和回滚演练；
6. 上一支持版本升级证据、漏洞响应 owner 和 EOL 策略；
7. 性能/资源预算及至少一个真实 Product Overlay 验证；
8. 删除 adapter 后 Foundation 与其他未依赖 capability 的 Kit 仍可构建。

`verified` 只说明某一 adapter/version/evidence bundle 通过指定 conformance；不是 Blankspace 对未来版本、漏洞或商业服务可用性的持续担保。

## 6. 替换不是虚假无损抽象

Blankspace 提供三档可移植性：

- `portable`：只使用 Kit 稳定 Contract，可按显式迁移计划更换 adapter；
- `extended`：使用某类可选 capability，只有支持它的 adapter 可替换；
- `provider-native`：产品直接使用上游 API，获得全部能力并接受更强锁定。

选择器和升级报告必须显示当前档位。切换 provider 仍可能需要账户重绑、密码重置、索引重建、blob 复制、flag 重建、历史通知丢失或支付订阅迁移；这些不能被一个统一接口隐藏。

## 7. AI 编程需要的机器上下文

未来 `blankspace context --for ai` 应为每个启用能力输出：

```json
{
  "capability": "identity.authentication",
  "adapter": "better-auth",
  "deliveryModel": "embedded",
  "supportLevel": "experimental",
  "portability": "portable",
  "allowedImports": ["@blankspace/kit-identity"],
  "providerNativeImports": ["better-auth"],
  "configSchema": "...",
  "docs": ["..."],
  "unsupported": ["saml"],
  "commands": ["blankspace doctor identity"]
}
```

AI 在新增功能前应先查询 capability，不凭依赖名猜测已经配置的能力；使用 provider-native API 时应在 Product manifest 中显式记录锁定和 owner。

## 8. 已核对的官方依据

截至 2026-09-06：Better Auth 官方仓库将其描述为 MIT、framework-agnostic 的 TypeScript 认证框架；Auth0 官方资料描述的是支持 OAuth/OIDC/SAML 的托管身份平台。Keycloak 作为独立 server 使用 OIDC/SAML；ZITADEL 同时提供 cloud 与 self-hosted 路线。因此目录必须区分 embedded、self-hosted 与 managed，而非只列品牌。[Better Auth](https://github.com/better-auth/better-auth)、[Auth0](https://auth0.com/docs/get-started/identity-fundamentals/introduction-to-auth0)、[Keycloak](https://www.keycloak.org/docs/latest/server_admin/)、[ZITADEL](https://zitadel.com/docs)

OpenFeature 是 vendor-neutral feature flag API；OpenTelemetry 是 vendor-neutral telemetry 生成、收集与导出框架，并明确不是 observability backend。这两者适合优先复用标准，但不能被误写成完整产品。[OpenFeature](https://openfeature.dev/docs/reference/intro/)、[OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/)

Novu 提供多通道通知基础设施并有 self-hosted/cloud 差异；pg-boss 是 PostgreSQL 上的 Node.js job queue；Typesense 是开源搜索引擎；Umami 可自托管并提供 Web analytics；react-admin 是浏览器端数据驱动管理 UI 框架且开源核心与 Enterprise 功能不同。这些差异都必须进入选型证据，而不是藏在统一 Kit 名称后。[Novu](https://docs.novu.co/platform)、[pg-boss](https://github.com/timgit/pg-boss)、[Typesense](https://typesense.org/about/)、[Umami](https://docs.umami.is/docs)、[react-admin](https://marmelab.com/react-admin/Readme.html)

## 9. 当前状态

本目录是设计输入，不是支持声明。当前仓库尚未交付这些 adapters，也没有可运行的 `blankspace add` 或 capability selector。近期实现只应围绕 Phase 1 纵向切片选择最少的实验候选；其余能力按真实产品需求和独立 Gate 推进。
