# SaaS MVP 采用策略

## 1. 结论

Blankspace 的第一个产品目标不是证明它能描述所有 SaaS，而是证明一个没有参与框架设计的开发者，可以在不修改 Foundation 或 Kit internal 的前提下完成下面的闭环：

```text
创建产品
→ 本地启动
→ 修改一个产品业务 Module 和品牌 Shell
→ 接入上线所需的少量外部能力
→ 创建预览环境
→ 验证身份、隔离、业务、可观测性和恢复
→ 获得可审查的发布报告
```

在这条链由外部开发者复现前，Blankspace 只能称为 framework preview，不能宣传为“快速搭建并上线 SaaS MVP”。长期的 local-first、多客户端、Editor、通用 Billing Kit 和生态市场均不能替代该门禁。

市场定位进一步收窄为：**从一个稳定 core 连续构建并升级多个产品的模块化应用底座**。快速创建只是入口；Product Overlay 在上游升级中保持稳定，才是区别于一次性 starter 或代码模板的核心价值。

## 2. 当前状态

当前仓库仍处于架构设计和 Phase 1A spike 阶段，没有可运行框架。本文定义目标体验、实施优先级和验收门槛，不是当前使用教程。能力状态仍以[风险实验索引](spikes/README.md)和实际 evidence 为准。

## 3. 首批服务对象

### 3.1 必须证明的产品类型

Adopter Preview 使用三个小型 reference overlays，共享同一 Foundation 和核心能力，但采用不同产品主体与 UI：

| Reference overlay | 产品主体/隔离根 | 最小业务 | 主要证明 |
| --- | --- | --- | --- |
| Personal SaaS | Account | 创建、修改、归档个人项目 | Workspace 不是所有 SaaS 的强制模型 |
| Team SaaS | Workspace | 成员在 Workspace 内管理任务 | membership、角色和跨租户负例 |
| Metered Tool | Account 或 Workspace，由 fixture 固定 | 执行一次有配额的处理任务 | 用量、entitlement 和外部副作用的接缝 |

三个 overlays 不等于维护三套完整示例应用。它们复用测试 harness、UI recipes 和基础 Module，只保留能证明主体模型、产品流程与视觉差异的最小代码。若新增 reference overlay 不能关闭一个现有风险或支持一个真实 adopter，不得进入官方维护范围。

### 3.2 适合首批采用的团队与产品

第一批验证对象优先选择多产品独立开发者、小型工作室与 Agency。它们会在多个产品中重复承担 Identity、Database、邮件、部署、监控和升级成本，最容易验证 Blankspace 是否真正降低长期边际维护成本。

- 单用户或小团队的 CRUD/工作流 SaaS；
- AI、自动化或数据处理工具，但模型调用与任务实现由产品直接集成；
- 轻量 CRM、工单、项目管理和内部业务产品；
- 以 Web/Server 和 PostgreSQL 为主、允许 remote-only 的产品。

### 3.3 Adopter Preview 明确不承诺

- Marketplace 分账、托管资金、争议或复杂税务；
- 医疗、证券、银行等需要专项合规认证的产品；
- 大规模数据仓库、流处理或低延迟交易系统；
- 离线优先、多端原生、CRDT 协作、白板和完整内容平台；
- “只改配置、不写产品代码”即可得到任意垂直 SaaS。

这些产品未来可以使用 Blankspace 的部分能力，但不能用通用架构声明替代真实领域验证。

## 4. 最小可启动产品

### 4.1 Core 必须交付

Adopter Preview 的默认 Web SaaS 必须同时具备：

| 能力 | 最小交付 | 不包含 |
| --- | --- | --- |
| Web/Server | 可运行 React Shell、Fastify host、typed client | 多端 Runtime |
| Identity | 注册、登录、验证、恢复、session 撤销 | 企业 SSO/MFA 的默认实现 |
| Product principal | Personal 与 Workspace 两种 starter | 固定 Organization 世界观 |
| Authorization | route、Service、DAL 一致的最小策略与负例 | 通用关系授权服务默认依赖 |
| Database | PostgreSQL、migration、seed、备份/恢复 recipe | 替产品决定 RPO/RTO |
| API | CRUD、cursor、错误、幂等与版本冲突 | 万能数据 API |
| Reliable effects | Identity 邮件 outbox/worker | 通用 Workflow DSL |
| UI | Auth、列表、详情、表单和标准状态；可替换 Product Shell | 垂直产品完整设计系统 |
| Delivery | 本地环境和一个 vendor-neutral preview profile | HA 或零停机生产承诺 |
| Diagnostics | check、doctor、Graph、结构化错误和发布摘要 | 隐藏式自动修复 |

缺少任一项时，创建命令只能标记为 experimental，不得称为 MVP starter。

### 4.2 常见上线能力采用 Launch Recipe

支付、文件、产品分析、错误监控和额外邮件经常决定 MVP 能否上线，但不应为了首个 adopter 提前冻结五个通用 Kit。Phase 1 增加 **Launch Recipe**：一份可执行、可删除、带版本和责任边界的 Product Overlay 集成方案。

首批必须至少提供：

| Recipe | 最小场景 | 必需证据 |
| --- | --- | --- |
| checkout | 一次性支付或订阅二选一 | webhook 验签、幂等、重复/乱序、reconciliation、测试环境 |
| object-storage | 上传一个私有文件并授权下载 | checksum、大小/类型限制、signed access、删除/退出路径 |
| product-analytics | 一个已同意的产品事件 | consent、事件 schema、PII policy、失败不阻断业务 |
| error-monitoring | Server 与 Web 各一次受控错误 | source map、redaction、environment 和 release correlation |
| transactional-email | 一封产品业务邮件 | purpose、模板版本、outbox 或明确 delivery 语义 |
| ai-feature | 流式生成、结构化输出或只读 tool 三选一 | budget、cancel、redaction、trace、失败 UI 和 eval case |

Launch Recipe 不是 Blankspace Kit，也不承诺 provider 可替换。它必须：

1. 位于 Product Overlay 拥有区域，并在 manifest 声明 `provider-native` 依赖；
2. 固定 package/service version、SecretRef、目标环境和 owner；
3. 提供 `add` change set、最小测试、删除步骤、数据出口与已知锁定；
4. 不修改 Foundation registry，不把供应商对象泄漏进无关 Modules；
5. 通过至少一个 reference overlay 和一次从干净目录开始的复现。

当同一能力经过两个明显不同产品验证、边界稳定且替换价值真实存在时，再按 Capability Catalog 晋级为 experimental Kit。Recipe 不得因为“未来可能复用”自动升级为框架抽象。

## 5. 渐进式开发体验

### 5.1 三层入口

开发者只在需要时接触下一层复杂度：

| 层 | 开发者动作 | 应看到的概念 |
| --- | --- | --- |
| Start | 选择 Personal 或 Workspace preset 并启动 | 产品名、环境、首页、登录 |
| Build | 新增 Module、页面和业务流程 | Module、Service、Coordinator |
| Extend/Operate | 加 recipe/Kit、部署和升级 | capability、adapter、Graph、evidence |

创建首页不要求理解 assemblyId、Registry Draft、capability selection record 或升级恢复 journal。它们可以进入诊断和高级文档，但不能成为首个业务页面的前置知识。

### 5.2 目标命令链

```bash
pnpm create blankspace my-product --preset remote-saas-core --principal personal
cd my-product
pnpm dev
blankspace module create projects --resource
blankspace recipe add checkout
blankspace deploy preview
blankspace verify mvp --deployment preview
```

命令当前均为目标接口，`--principal personal` 也是待 CLI/schema 验证的 starter 选择，不新增第三个 preset。每个生成器必须先展示 change set；交互式和非交互式调用产生同一规范化结果。失败后不得留下半写入工程。

### 5.3 开发者时间预算

时间从干净、受支持的开发环境开始测量，依赖下载时间单独记录，不能从结果中删除。以下是需要通过真实 journey 冻结的产品体验上限，不是当前性能事实：

| Journey | 体验上限 | 完成定义 |
| --- | --- | --- |
| 创建到本地首页 ready | 10 分钟 | 首页、数据库、注册/登录均可用 |
| 创建首个 CRUD resource | 30 分钟 | list/create/read/update/archive/restore 通过 |
| 明显改变品牌与 Shell | 30 分钟 | 不修改 internal，截图可区分默认产品 |
| 添加一个 Launch Recipe | 45 分钟 | 本地测试模式和失败路径通过 |
| 创建 preview deployment | 60 分钟 | TLS URL、migration、health 和日志可检查 |
| 从上一 minor 升级并验证 | 30 分钟 | plan、apply、verify 或 restore 有确定结果 |

正式阈值由至少五次独立 journey 的原始记录冻结。失败、求助点、阅读页面和手工步骤都进入 evidence；不能只记录成功者的命令执行时间。

## 6. UI 差异化门禁

“能换颜色”不足以证明适合多种 SaaS。Phase 1C 除默认 Shell 外，必须用两个布局明显不同的 Product Shell 验证：

- 数据密集型桌面布局：侧边导航、表格、批量动作和详情；
- 聚焦型工具布局：单一主任务、进度/结果和少量导航。

两个 Shell 共享 Auth、route、error、permission 和 loading semantics，但不得共享同一个页面结构后只替换 token。外部开发者必须能仅在 Product Overlay 内完成一种 Shell 的品牌、导航和主流程修改。视觉、键盘与可访问性证据仍由 S8 管理。

## 7. Adopter Preview Gate

Phase 1A～1C 证明框架内部成立；Adopter Preview 证明开发者能够使用它。公开 preview release 前必须满足：

1. **可获得**：有许可证、发布包、固定 lock、安装来源和最低环境检查；
2. **可启动**：Personal SaaS 与 Team SaaS 在干净环境中由目标命令创建并运行；
3. **可开发**：外部开发者完成一个 Module、一个 Coordinator 和一次 Shell 修改；
4. **可上线验证**：至少一个 reference overlay 创建 vendor-neutral preview deployment；
5. **常见集成可行**：checkout 与 object-storage recipes 端到端通过，其余首批 recipes 至少完成干净目录复现；
6. **可诊断**：注入配置、数据库、Secret、migration 和外部 provider 失败后，开发者能从稳定诊断定位责任层；
7. **可升级**：上一 preview/minor fixture 完成 check、apply、verify 和 restore；
8. **外部可复现**：至少三名未参与 Blankspace 设计的开发者独立完成 journey，其中至少两人使用不同 reference overlay；
9. **维护可承受**：所有 official/experimental artifacts 有 owner、版本策略、CI fixture、漏洞响应和弃用路径；
10. **诚实发布**：公开页面列出 unavailable、experimental、provider-native 和 production No-Go 项，不用远期路线能力宣传当前版本。

Adopter Preview 不等于 Production Ready。处理真实客户数据仍需产品通过[Production Readiness Gate](production-readiness.md)；preview profile 不能被当作 HA、自动回滚或灾备证据。

产品启用 AI、知识库、Web Research 或文档解析时，还必须满足 [AI 能力门禁](ai-capabilities.md#9-安全成本与质量门禁)。聊天界面能够返回文本不等于 AI feature 已可发布。

### 7.1 Upstream Upgrade Proof

Adopter Preview 前必须先关闭一条可复现的升级证明，不能只展示 upgrade 命令或静态 compatibility report：

1. 用已发布或可复现的版本 N 创建至少两个不同主体模型的 reference overlays；
2. 每个 overlay 在产品拥有区域加入至少三个有测试的 Product Modules，并固定初始 tree hash；
3. 版本 N+1 为 Foundation 或官方 Kit 带来至少一项真实安全、正确性或基础设施修复；
4. 执行 check、plan、apply、affected tests、全目标 build 和 verify；
5. 零修改样本中，声明过的 Product Overlay 业务文件 tree hash 必须保持不变；
6. 需要 codemod 或人工修改的样本分别记为 automated migration 或 manual migration，不能计入零修改成功；
7. 发布原始命令、版本、fixture、差异、失败原因和恢复结果，失败样本不得从分母删除。

这条证明验证的是 extension contract 与升级责任边界。它不要求此时支持所有数据库 migration、客户端 Runtime 或生产部署形态。

## 8. 复杂度与维护预算

### 8.1 每个新增抽象的准入问题

新增 Kit、DSL、公共 Contract 或 reference overlay 前必须回答：

1. 哪个真实 adopter journey 被当前普通 TypeScript 或 direct integration 阻塞？
2. 是否已有两个不同产品证明相同领域语义？
3. 新抽象删除后，产品能否退回 provider-native 路径？
4. 谁维护正常、失败、安全、升级和退出 fixtures？
5. 它增加了多少首次创建、check、bundle 和文档认知成本？

没有真实阻塞时优先写 Product Module 或 Launch Recipe，不进入 Foundation。

### 8.2 支持面上限

- 每种 capability 同期最多维护一个 `official-reference` adapter；第二个先保持 experimental/community，除非真实迁移或部署需求证明必要；
- 每个 official artifact 必须至少有一个 owner 和一个上一版本 fixture；owner 缺失则停止晋级并进入 deprecated 评估；
- reference overlays 共用基础测试，不复制完整应用；
- 连续两个 minor 没有 reference product 或 adopter 使用的 experimental recipe/adapter，必须评审删除、降级为 community 或冻结维护；
- 新客户端 Runtime 不得阻塞 Web/Server 的 MVP journey。

## 9. 成功指标

Adopter Preview 发布后按版本记录：

| 指标 | 目的 |
| --- | --- |
| Upgrade Success Rate | 衡量真实下游项目是否能在 Product Overlay 业务代码零修改的情况下升级并通过验证 |
| journey 完成率与中位耗时 | 判断是否真的加速 MVP |
| 每个 journey 的求助点和文档跳转数 | 发现概念暴露过早 |
| Product Overlay 与 internal 修改比例 | 验证产品所有权边界 |
| 创建失败、部署失败和升级恢复成功率 | 验证工具可靠性 |
| recipe/Kit/direct integration 使用分布 | 决定哪些能力值得稳定化 |
| 官方 artifacts 数量、owner 覆盖和 CI 时长 | 控制生态维护成本 |

指标只用于产品决策，不采集最终 SaaS 用户数据。遥测必须显式 opt-in、公开 schema、最小化采集并允许本地导出；没有同意时由开发者手工提交 journey evidence。

`Upgrade Success Rate = 零 Product Overlay 业务代码修改且完整验证通过的下游升级数 / 所有纳入本次版本矩阵的下游升级数`。分母按发布前冻结的 fixture 和已登记 adopter 列表确定；依赖失败、框架回归和需要人工业务修改的样本均保留在结果中，并另行报告 codemod success 与 restore success。

## 10. 实施顺序

```text
Phase 1A Assembly
→ Phase 1B 两种主体模型 + Reference SaaS
→ Phase 1C 两种差异化 Shell + Extension/Upgrade Proof
→ Adopter Preview：Launch Recipes + Preview Deployment + 外部 Journey
→ Product-specific Production Readiness
```

实现工作只按当前门禁所需的最小纵向切片推进。Adopter Preview 未关闭前，不以增加长期 Capability Catalog 条目、原生客户端或完整 local-first 能力来代替开发者采用证据。
