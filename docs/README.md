# Blankspace 文档索引

## 当前状态

Blankspace 处于架构设计和 Phase 1A spike 阶段，没有可用于创建产品的完整框架。目标命令和 API 不是当前交付能力。实验进度以[风险实验索引](spikes/README.md)为准，路线门禁以 [Phase 1 实施蓝图](phase-1-blueprint.md)为准。

## 按读者开始

### 产品开发者

1. [当前实现参考](current-implementation.md)
2. [从零理解并构建产品](getting-started.md)
3. [SaaS MVP 采用策略](mvp-adoption.md)
4. [开发者体验与 AI 编程](developer-experience.md)
5. [品牌与视觉基线](brand.md)
6. [配置参考](configuration-reference.md)
7. [CLI 与诊断契约](cli-and-diagnostics.md)
8. [Product Module](product-modules.md)
9. [Optional Kit](kits.md)
10. [Integration Catalog](integration-catalog.md)
11. [SaaS Capability Catalog](capability-catalog.md)
12. [AI、知识库与文档智能能力](ai-capabilities.md)
13. [客户端 Runtime 与多端开发](client-runtimes.md)
14. [跨平台 Design System](design-system.md)
15. [前端基础能力：i18n、图标与资源约定](frontend-foundations.md)
16. [基础 UI Shell 模板与路由](ui-templates.md)
17. [升级与兼容性](upgrades.md)
18. [Production Readiness Gate](production-readiness.md)

### 框架贡献者

1. [当前实现参考](current-implementation.md)
2. [Agent 从这里开始](agent-start-here.md)
3. [Phase 1A 可执行工作项](implementation/phase-1a-work-items.json)
4. [空白上下文 Agent 验收](implementation/cold-agent-readiness.md)
5. [总体架构](architecture.md)
6. [核心术语](glossary.md)
7. [参与框架开发](contributing.md)
8. [RFC 索引](rfcs/README.md)
9. [验证策略](testing-strategy.md)
10. [Phase 1 实施蓝图](phase-1-blueprint.md)
11. [风险实验索引](spikes/README.md)
12. [决策与门禁台账](decision-backlog.md)
13. [文档权威来源与维护规则](documentation-governance.md)

### 部署与安全负责人

1. [安全模型与信任边界](security.md)
2. [软件供应链政策](supply-chain.md)
3. [部署与运行责任](operations.md)
4. [Platform Operations 与持续交付](platform-operations.md)
5. [多产物 CI/CD 与客户端发布](ci-cd.md)
6. [Framework Package 发布与 npm/pnpm 分发](package-publication.md)
7. [升级与兼容性](upgrades.md)
8. [验证策略](testing-strategy.md)
9. [决策与门禁台账](decision-backlog.md)

### 产品和架构决策者

1. [项目 README](../README.md)
2. [总体架构](architecture.md)
3. [开发路线图](roadmap.md)
4. [AFFiNE 架构研究](research/affine.md)
5. [AFFiNE 能力矩阵 RFC](rfcs/0012-affine-capability-matrix.md)
6. [AFFiNE 级产品可行性独立审查](reviews/affine-feasibility.md)
7. [决策与门禁台账](decision-backlog.md)

## 事实来源

| 问题 | 权威来源 |
| --- | --- |
| 当前做到了什么 | `status/project-status.json`、可复现测试证据 |
| 哪些决策或门禁还没关闭 | 决策与门禁台账 |
| 何时进入下一阶段 | Phase 1 蓝图、路线图 |
| 为什么采用某个架构 | 对应 RFC |
| 公共结构允许哪些字段 | `packages/contracts/schemas/` |
| 最终装配了什么 | 未来生成的 Product Graph |
| 使用了哪些版本 | package manager lockfile 与未来 `blankspace.lock` |
| RFC 实现依据 | 根 `rfc-baseline.json` |

README 和领域文档用于解释，不覆盖 schema 或 RFC 的精确定义。RFC 是 Proposed 时表示可以用于验证性实现，但尚未取得接受证据。

## 文档覆盖矩阵

| 主题 | 概览 | 详细设计 | 验证/实施 |
| --- | --- | --- | --- |
| 分层与依赖方向 | architecture | RFC-0001 | phase-1-blueprint、S4/S5 |
| Kit、Service、Event | kits | RFC-0002 | testing-strategy、S5 |
| 成熟上游与薄适配 | integration-catalog、kits | RFC-0020 | adapter conformance、compatibility fixtures |
| SaaS 能力选择与支持状态 | capability-catalog | RFC-0025 | selection record、per-capability conformance |
| Product Directory/Module | product-modules | RFC-0003 | S1/S2、compiler fixtures |
| 配置与 CLI 诊断 | configuration-reference、cli-and-diagnostics | RFC-0011、RFC-0013 | S1、diagnostic fixtures |
| Graph、Registry、裁剪 | architecture/glossary | RFC-0004 | S2～S4 |
| Workspace 与多 Server | architecture | RFC-0005 | Phase 1B remote-only fixture；Phase 2～4 |
| local-first 数据模式 | architecture | RFC-0006～0008 | Phase 2～4 fixtures |
| UI 定制 | developer-experience | RFC-0009 | S8、Phase 1C |
| 基础 Desktop/Mobile Shell 与路由 | ui-templates、design-system | RFC-0009、RFC-0015～0017 | proposed UI contracts、S8 |
| 多客户端 Runtime | client-runtimes | RFC-0015、RFC-0017 | CR1 Client Runtime |
| 跨平台 Design System | design-system | RFC-0016、RFC-0017 | DS1 Design System |
| 前端 i18n、语义图标与资源约定 | frontend-foundations、design-system | RFC-0009、RFC-0016～0017 | S8 locale/icon/a11y fixtures |
| 升级 | upgrades | RFC-0010 | Phase 1C upgrade fixtures |
| AI 开发 | developer-experience | RFC-0011 | Phase 1B AI journey |
| 能力上限与指标 | roadmap | RFC-0012 | budgets、reference products |
| MVP 采用与外部开发者验证 | mvp-adoption | Phase 1 RFCs | Adopter Preview journeys、launch recipes |
| Editor Engine 边界 | roadmap、AFFiNE 可行性审查 | RFC-0018 | E1、Phase 2 Block 文档 |
| Sync Protocol | architecture、roadmap | RFC-0006、RFC-0019 | Y1、N1、Phase 4 |
| 技术选型 | architecture | RFC-0013 | S1～S8 |
| 安全 | security | RFC-0014、RFC-0017 | security regression fixtures |
| 身份与 Session | security | RFC-0014 | Phase 1B auth/tenant fixtures |
| 身份、产品主体与授权 | architecture | RFC-0021 | 多模型 authz、跨租户 fixtures |
| Phase 1 API | product-modules | RFC-0022 | binding/client、分页/幂等 fixtures |
| 可靠副作用与 Jobs | kits | RFC-0023 | outbox、Identity mail、worker failure fixtures |
| Billing/Payment | kits、integration-catalog | RFC-0024 | Stripe/Waffo adapter corpus |
| AI、Agent、知识库、联网研究与文档解析 | ai-capabilities、capability-catalog | RFC-0020、RFC-0025 | provider/agent/retrieval/parser eval 与安全 fixtures |
| 软件供应链 | supply-chain | RFC-0017 | dependency review、SBOM、provenance、release gates |
| Framework package / npm-pnpm 发布 | package-publication、supply-chain | RFC-0017 | pack/consumer fixtures、registry provenance、SC1 |
| 部署与运维 | operations | host/database/upgrade RFC | S6/S7、release gates |
| 镜像更新、渐进发布与回滚 | platform-operations | RFC-0026 | release/deployment/rollback/client-update fixtures |
| Docker、Desktop 与 Mobile CI/CD | ci-cd、supply-chain | RFC-0017、RFC-0026 | proposed release contracts、SC1、平台签名/商店 evidence |
| 生产资格 | production-readiness | RFC-0021～0024 | product-specific production report |

当前 S1 为 Provisional pass，S2～S6 为 Pass。S4 已在 Linux、macOS、Windows 上验证 `ExecutableRegistryV1`、joint assemblyId、resolved Service/Event bindings、18 组 pre-factory mismatch 与 guarded generated-entry probe；S5 lifecycle/Event corpus 与 S6 exact Fastify 5.12.3 十场景真实 loopback/deadline/termination corpus 也已完成三平台 canonical 对账，Ubuntu/macOS 的真实 signal 和 Windows 明确平台分支均通过。当前唯一 ready 工作项是 `A1-S7-01`，先冻结 Database 工具链和 migration fault contract。链接表示实验规格入口，只有对应状态和 transcript/evidence 明确记录的部分才算已经执行。

## 状态词

- `Proposed`：设计可供验证，尚未 Accepted；
- `Draft matrix`：实验场景未锁定工具或环境；
- `Matrix frozen`：实验输入和门槛已冻结，尚未执行；
- `Provisional pass`：替代环境或工具通过，目标验证仍未完成；
- `Pass`：目标环境和规定矩阵通过；
- `Accepted`：RFC 的验收、实现、兼容证据和维护者评审全部完成；
- `Unavailable`：能力尚未实现，工具必须明确拒绝。

## 维护规则

修改公共术语、配置、target、阶段或命令时，检查 README、本索引、入门文档、领域文档、相关 RFC、schema、蓝图和实验状态。示例必须注明当前可执行、目标接口或未来提案。RFC 内容变化后更新根基线并记录原因和受影响 fixtures。

每次修改文档后运行 `pnpm verify:docs`；该命令检查 JSON、Markdown 本地链接与代码围栏、带 `$schema` 示例、Schema formats、项目/Spike 状态对账和 RFC 基线。领域语义仍需通过对应 fixtures 与无上下文读者测试验证。完整维护协议见[文档权威来源](documentation-governance.md)。
