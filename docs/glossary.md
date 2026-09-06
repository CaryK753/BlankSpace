# Blankspace 核心术语

本文给第一次阅读项目的人提供最短定义。RFC 中的精确定义和 schema 优先于本页摘要。

## 产品与扩展

| 术语 | 含义 |
| --- | --- |
| Foundation | 所有产品共享的最小装配与运行层，不包含 Workspace、支付或编辑器等具体领域。 |
| Optional Kit | 构建时加入产品的可复用领域能力 package，例如 Identity 或 Billing。 |
| Adapter | Kit 与具体供应商或技术之间的实现层，例如 Stripe、S3 或 PostgreSQL adapter。 |
| Product Overlay | 产品团队拥有的全部业务、UI、数据、配置和 Coordinator。 |
| Product Module | `product/modules/<id>/` 下的产品业务目录，不是 npm package 或运行时插件。 |
| Product Coordinator | 使用普通 TypeScript 显式组合多个 Service 的产品流程。 |
| Preset | 可展开、可检查的 Kit 默认组合，不引入新的运行时语义。 |
| Launch Recipe | 位于 Product Overlay 的可执行 provider-native 集成方案，包含 change set、版本、SecretRef、测试、删除和数据出口说明；不是 Kit 或可替换性承诺。 |
| AI Model Kit | 管理模型 capability、stream/cancel、structured result、用量、预算、trace 和安全策略的可选 Kit；不拥有产品 Prompt。 |
| Agent Runtime Kit | 只为可恢复长流程提供 checkpoint、暂停/继续和状态转换的可选 Runtime；普通流程仍使用 Coordinator。 |
| Knowledge Kit | 管理知识 source/document/version、索引、检索、引用、重建和删除的可选 Kit。 |
| Web Research Kit | 访问外部 Web 搜索/抓取并保留来源、成本和安全记录的可选 Kit；不同于产品内部 Search。 |
| Document Intelligence Kit | 将 BlobRef 解析为带页码/区域/lineage 的结构化文档和 OCR 结果的可选 Kit。 |
| External Plugin | 面向最终用户的未来动态扩展；与构建时 Kit 是不同信任模型。 |

## 装配与运行

| 术语 | 含义 |
| --- | --- |
| Product Compiler | 读取静态配置、manifests、lock 和源码边界，生成确定装配结果的工具。 |
| Product Graph | Compiler 生成的装配事实：节点、依赖、目标、绑定、来源与诊断。它不是手写配置。 |
| Executable Registry | 将 Graph 中稳定 ID 映射到静态 module/export/factory 的生成描述；不得增加 Graph 未声明的决定。 |
| assemblyId | 同时约束 Graph 与 Registry 的内容标识；二者不一致时 Runtime 在导入业务 entry 前失败。 |
| inputHash | 配置、manifests、lock 和产品源码等编译输入的内容摘要。 |
| entry | 某个 owner 针对 `shared`、`web` 或 `server` 暴露的静态运行入口。 |
| target | 要生成或运行的环境，例如 Web 或 Server。 |
| Client Target | 可独立构建、测试和发布的客户端实例，包含 platform 与绑定的 Runtime。 |
| Client Runtime Kit | 提供客户端 host、UI renderer、codegen、builder 和 verifier 的构建时 package。 |
| UI Family | renderer 协议身份，例如 `react-desktop`、`react-mobile`、`swiftui` 或 `compose`。 |
| Platform Capability | 文件、相机、分享、安全存储、多窗口等平台能力的版本化 Contract。 |
| bundle trace | Bundler 最终实际包含的 JS、CSS、worker、WASM 和 assets 清单，用来与 Compiler Graph 对账。 |
| Release Plan | 从 source、Product Graph 和 target selection 生成的构建/测试/签名任务图；尚不是可部署产物。 |
| ReleaseCandidate | 构建完成后的不可变发布记录，绑定 source/input/Graph、artifact digest、evidence、兼容性和策略。 |
| Release Lifecycle | ReleaseCandidate 在部署、桌面 updater 或移动商店中的逐 target 状态和审计轨迹。 |
| promotion | 不重新构建 artifact，只将同一 digest 晋级到另一环境或 channel 的受控状态变更。 |

## Contract 与交互

| 术语 | 含义 |
| --- | --- |
| Service Contract | 需要返回值或确认结果时使用的版本化公共接口。 |
| provider | 某个 Service Contract 的具体实现声明。 |
| binding | Compiler 为一个 Service requirement 选定唯一 provider 的结果。 |
| Event Contract | 描述已经发生事实的版本化消息结构，不用于请求返回值。 |
| request identity | Service Contract 为一次业务调用显式定义的可序列化身份或请求引用；Blankspace 不提供包含 HTTP request、隐式用户和数据库 transaction 的通用 context bag。 |
| correlationId / causationId | Event envelope 中连接同一业务链、标识直接原因的 ID，用于诊断嵌套发布。 |
| outbox | 与业务写入处于同一事务的待投递事件记录，用于实现可靠异步投递。 |

## UI 与兼容性

| 术语 | 含义 |
| --- | --- |
| Public Extension Surface | 框架明确版本化并承担迁移责任的扩展边界。 |
| Semantic Contribution | 按语义注册的 route、command、navigation 或 renderer，而不是依赖内部 DOM 位置。 |
| Visual Slot | Shell 明确提供的视觉插槽，只在语义贡献不足时使用。 |
| Product Shell | 产品可替换的应用外壳 Contract，用于深度改变布局和品牌体验。 |
| Screen Contract | 跨端共享的页面状态、语义事件与所需能力；不包含具体组件树。 |
| Semantic Token | 表达内容、操作、表面、材质和动效意图的跨平台设计变量。 |
| Component Recipe | 公共组件状态引用 Semantic Tokens 的版本化规则，由各平台 Renderer 实现。 |
| Public Override | 对公开组件的高风险替换，必须声明兼容范围并在升级时人工复查。 |
| compatibility manifest | 每个版本发布的机器可读兼容范围、废弃项、breaking changes 和 codemods。 |
| fixture | 为验证某条契约而固定的最小测试产品、输入或场景。 |
| Adopter Preview | Phase 1A～1C 后由外部开发者验证创建、开发、集成、预览部署、诊断与升级的发布门禁；不等于 Production Ready。 |

## Workspace 与数据模式

| 术语 | 含义 |
| --- | --- |
| Workspace Provider | 创建、发现和打开某类 Workspace 的来源与行为所有者。 |
| WorkspaceRef | 客户端使用 `{ sourceId, workspaceId }` 定位 Workspace 的引用。 |
| Server Scope | 某台 Server 独立的地址、认证会话、能力和 Workspace 命名空间。 |
| remote-only | 数据权威只在远端 API/数据库，客户端不维护可离线工作的副本。 |
| Local Workspace | 只存在本地 provider 中的 Workspace。 |
| local replica | Cloud Workspace 在客户端的持久副本，可在离线时工作并稍后同步。 |
| local-first | 本地写入和离线工作是基础体验；同步属于可选的远端能力。 |
| CRDT | 一类可合并并发编辑的数据结构；Blankspace 不把它强制用于所有数据。 |
| awareness | 实时协作中的临时在线状态，例如光标和用户 presence，不是持久业务数据。 |

## 文档状态词

| 状态 | 含义 |
| --- | --- |
| Proposed | 已形成设计草案，但尚未获得足够原型证据。 |
| provisional pass | 当前环境下实验通过，仍有明确的目标环境或最终工具验证未完成。 |
| Accepted | 决策和验收证据均已满足；不能只靠修改状态文字获得。 |
| unavailable | 能力尚未实现，工具必须明确拒绝，不能生成半可用工程。 |
