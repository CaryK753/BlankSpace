# Blankspace RFC 索引

RFC 用于冻结需要原型验证的重要公共契约。`Proposed` 表示方向可以用于验证性实现，但尚未获得完整接受证据；它不代表已经交付。每份 RFC 只有在自身验收场景、关联 spikes、实现 fixtures 和兼容验证全部通过，并记录维护者评审后，才能改为 `Accepted`。

| RFC | 状态 | 主题 |
| --- | --- | --- |
| [RFC-0001](0001-foundation-boundary.md) | Proposed | Foundation 最小边界与生命周期 |
| [RFC-0002](0002-kit-contract.md) | Proposed | Kit、Service 与 Event Contract |
| [RFC-0003](0003-product-directory.md) | Proposed | Product Directory 与 Module Boundary |
| [RFC-0004](0004-product-graph.md) | Proposed | Product Graph 与 Runtime Entries |
| [RFC-0005](0005-workspace-provider.md) | Proposed | Workspace Provider 与 Server Scope |
| [RFC-0006](0006-data-modes.md) | Proposed | Local、Remote 与 Replicated 数据模式 |
| [RFC-0007](0007-reference-slice.md) | Proposed | AFFiNE 参考产品首个纵向切片 |
| [RFC-0008](0008-local-cloud-migration.md) | Proposed | Local → Cloud 迁移与恢复 |
| [RFC-0009](0009-public-extension-surface.md) | Proposed | Public Extension Surface 与 Product Shell |
| [RFC-0010](0010-upgrade-protocol.md) | Proposed | 升级计划、兼容清单与恢复 |
| [RFC-0011](0011-ai-developer-contract.md) | Proposed | 开发者黄金路径与 AI Contract |
| [RFC-0012](0012-affine-capability-matrix.md) | Proposed | AFFiNE 能力矩阵与非功能基准 |
| [RFC-0013](0013-phase-1-technology.md) | Proposed | Phase 1 技术栈与验证 Spikes |
| [RFC-0014](0014-identity-session.md) | Proposed | Identity、Session 与请求身份 |
| [RFC-0015](0015-client-runtimes.md) | Proposed | 多客户端 Runtime、UI Family 与 Screen Contract |
| [RFC-0016](0016-cross-platform-design-system.md) | Proposed | 跨平台 Design System 与 Token Resolver |
| [RFC-0017](0017-client-runtime-machine-contracts.md) | Proposed | 多客户端 Graph V2、分发、工具与证据机器契约 |
| [RFC-0018](0018-editor-engine-boundary.md) | Proposed | Phase 2 experimental Editor Engine 最小边界 |
| [RFC-0019](0019-sync-protocol-v1.md) | Proposed | Replicated 数据域的 Sync Protocol V1 机器边界 |
| [RFC-0020](0020-integration-first-kits.md) | Proposed | Integration-first Kit、薄适配与上游责任边界 |
| [RFC-0021](0021-identity-authorization-composition.md) | Proposed | 身份、产品主体与可替换授权引擎 |
| [RFC-0022](0022-api-contract-v1.md) | Proposed | Phase 1 API Contract V1 |
| [RFC-0023](0023-reliable-effects-and-jobs.md) | Proposed | 可靠副作用、Jobs 与身份邮件 |
| [RFC-0024](0024-billing-payment-adapters.md) | Proposed | Billing 状态机与 Payment Adapter |
| [RFC-0025](0025-capability-catalog-and-selection.md) | Proposed | Capability Catalog、支持状态与集成选型 |
| [RFC-0026](0026-operations-plane-and-progressive-delivery.md) | Proposed | Operations Plane、渐进交付、客户端更新与回滚 |

RFC 被接受前必须包含可运行原型、失败用例和验证记录。

贡献者应先阅读[框架贡献指南](../contributing.md)和[验证策略](../testing-strategy.md)。RFC 状态由可复现证据推进；`Proposed` 允许验证性实现，但不允许实现与文档静默漂移。

状态变更由 RFC 作者提出，由仓库维护者审查。记录至少包含审查日期、基线 hash、证据路径、未通过项为零的声明和兼容性分类；未来建立 `CODEOWNERS` 后以对应 Contract owner 为必需 reviewer。修改公共 schema 时，兼容新增使用当前 schema version，不兼容语义变更必须提升 schema major 并提供迁移或明确拒绝策略。
