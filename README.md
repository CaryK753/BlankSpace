# Blankspace

Blankspace 的目标是成为一个面向广泛 SaaS 产品的开箱即用框架。它提供可组合的应用基础设施，并允许开发者把产品独有的业务、界面和数据定义保留在独立的 Product Overlay 中。

Blankspace 不要求每个产品都采用同一种架构。传统 Web SaaS 可以只使用远端数据能力；桌面或知识工作区产品可以进一步启用本地存储、离线同步和实时协作。框架的能力上限应足以构建 AFFiNE 级完整产品，但各阶段不会一次性复制 AFFiNE 的全部复杂度。

当前仓库处于架构设计和 Phase 1A spike 阶段，尚没有可运行的框架。文档中的命令和 API 是目标体验，不代表已经实现；实时实验进度以 [Phase 1 风险实验状态](./docs/spikes/README.md) 为准。

| 能力 | 当前状态 | 计划阶段 |
| --- | --- | --- |
| 架构与开发体验契约 | 设计草案 | Phase 0 固化 RFC |
| Foundation、CLI、基础 Kits | 未实现 | Phase 1 |
| Local Workspace | 未实现 | Phase 2 |
| Cloud Workspace 与迁移 | 未实现 | Phase 3 |
| 离线复制与协作 | 未实现 | Phase 4 |
| React Web Runtime | 设计草案 | Phase 1 |
| Electron、Capacitor、SwiftUI、Compose 客户端 Runtime | 设计草案 | Phase 1 后按独立里程碑 |
| Editor、Billing 等扩展 Kits | 未实现 | 按真实产品需求推进 |

## 开发者承诺

Blankspace 的成功不以抽象数量衡量，而以开发者能否做到以下事情衡量：

- 一个命令创建并运行带默认认证、可选产品主体/授权模板、存储和部署配置的产品；
- 绝大多数业务和 UI 开发只修改产品拥有区域，不修改框架源码或生成物；
- 通过 Kit 与 adapter 增加支付、编辑器、本地存储等能力；
- 在升级前生成兼容性报告，升级后用 codemod、受影响测试和多目标构建验证；
- 让 AI 编程代理从机器可读的 Product Graph、Contracts 和诊断中理解项目，而不是猜测框架内部实现。

## 核心分层

```text
Product Overlay
产品业务 / UI / 数据定义 / Coordinators / 品牌
        │
        ▼
Optional Kits
Identity / Workspace / Files / Editor / Local-first / Billing / ...
        │
        ▼
Foundation
生命周期 / Kit 装配 / Service / Event / 配置 / Runtime / 构建
```

### Foundation

所有 Blankspace 产品共享的最小框架层。Foundation 不认识 Workspace、支付、编辑器或同步等具体领域，只负责装配和运行应用。

### Optional Kits

开发者按产品需要选择的基础设施 packages。Kit 定义一个可复用领域能力，具体技术或外部供应商由 adapter 接入。Blankspace 不重造编辑器、认证协议、支付网关、搜索引擎、任务队列或 CRDT；它提供薄适配、装配、诊断、conformance 和升级边界。产品仍可直接使用 Tiptap 等上游公共 API。

### Product Overlay

具体产品拥有的代码。Product Module 以目录为开发单位；跨 Kit 的产品流程使用普通 TypeScript Coordinator 编排。

## 设计原则

- **组合而非继承**：产品组合 Foundation 与 Kits，不 fork 框架源码。
- **框架负责装配，不发明新语言**：业务逻辑仍然使用普通 TypeScript。
- **能力按需进入产物**：没有启用的 Kit 及其平台实现不得进入构建结果。
- **Kit 拥有自己的数据**：其他 Kit 只能使用公共 Service，不能直接访问其内部表。
- **显式业务流程**：需要结果时调用 Service；广播既成事实时发布 Event；跨 Kit 流程由产品 Coordinator 控制。
- **Provider 决定 Workspace 行为**：Local、Cloud 和普通 remote-only Workspace 可以拥有不同的存储栈。
- **渐进式 local-first**：框架提供 local-first 能力，但不强制所有产品或所有数据域使用。
- **多客户端、非最低公分母**：Web/Desktop 可以共享 React，Hybrid Mobile 与原生移动端共享语义契约而不强制共享组件树。
- **AFFiNE 是能力基准，不是源码模板**：Blankspace 最终应能承载同等级产品，而不是复制其内部 API。
- **集成优先，不重造领域引擎**：成熟上游负责领域内部能力；Blankspace 负责让选择、配置、生命周期、裁剪、诊断和升级可控。
- **认证不等于产品用户模型**：Identity 只建立 Account/Session/Actor；Organization、Workspace、团队、角色和资源关系由产品选择模板或授权引擎建模。
- **选择能力而不是绑定品牌**：同一能力可使用 embedded、自托管或托管实现；许可证、支持状态和 provider-native 锁定必须可见。

## 目标开发体验

```jsonc
{
  "$schema": "./node_modules/@blankspace/contracts/schemas/product-config.schema.json",
  "schemaVersion": "1",
  "preset": "remote-saas-core",
  "targets": ["web", "server"],
  "product": "./product"
}
```

`remote-saas-core` 只展开 Identity、Database 与 Identity 自有的可靠邮件路径，不强制采用 Workspace。需要 Workspace 租户形态时使用 `workspace-saas`，后者在 core 上增加 Workspace 与默认授权模板。只有需要替换某个 Kit 的 preset 配置时，才在根 `kits` 中再次声明该 Kit；替换以整个 Kit 配置对象为单位，不做隐式深合并。

产品目录：

```text
product/
├── manifest.jsonc
├── coordinators/
├── shared/
├── modules/
│   ├── documents/
│   ├── edgeless/
│   └── copilot/
├── frontend/
├── backend/
├── data/
├── theme/
├── assets/
└── locales/
```

Product Compiler 自动展开 Preset、解析 Kit 依赖、校验配置与 adapter、扫描 Product Modules、注册贡献，并为目标运行时裁剪。生成的 Product Graph 必须可检查，自动化不能成为隐藏魔法。

## 最小交互模型

Blankspace Phase 1 只保留三种 Kit 间交互：

| 需求 | 机制 |
| --- | --- |
| 立即获得结果或确认动作成功 | 调用公共 Service |
| 通知其他部分某个事实已经发生 | 发布 Event |
| 组合多个 Kit 完成产品业务 | 编写 Product Coordinator |

Phase 1 不提供 Command Bus、Query Bus、Workflow DSL、Saga DSL 或统一 Operation 抽象。

## Workspace 与 local-first

Blankspace 借鉴 AFFiNE 的 provider 思路：Workspace 由一个 Workspace Provider 管理，而不是先创建一个抽象 Workspace 再随意绑定多台服务器。

```text
Local Provider
└── Local Workspace
    └── local storage only

Server Provider
└── Cloud Workspace
    ├── local replica（可选）
    └── one remote server

Remote-only Provider
└── SaaS Workspace
    └── remote API only
```

Workspace 使用 `{ sourceId, workspaceId }` 在客户端定位。Local → Cloud 是显式迁移：在目标 Server 创建 Cloud Workspace、复制内容并切换到新的 Workspace，而不是给原 Workspace 添加 remote binding。

## 当前非目标

- Phase 1 实现完整 AFFiNE、BlockSuite 或通用 CRDT 平台；
- 让每个 SaaS 强制使用 Workspace 或 local-first；
- 运行时安装 Kit 或建设 Kit 市场；
- 用一个万能 API 抽象普通 HTTP、local-first 写入和 CRDT 同步；
- 让 Kit 根据其他 Kit 的存在偷偷改变产品行为；
- 通过修改框架内部源码实现产品定制。

## 文档导航

- [完整文档索引](docs/README.md)
- [当前实现参考](docs/current-implementation.md)
- [Agent 从这里开始](docs/agent-start-here.md)
- [参与贡献](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)
- [从零理解并构建一个产品](docs/getting-started.md)
- [SaaS MVP 采用策略](docs/mvp-adoption.md)
- [核心术语](docs/glossary.md)
- [参与框架开发](docs/contributing.md)
- [验证策略与证据](docs/testing-strategy.md)
- [安全模型与信任边界](docs/security.md)
- [软件供应链政策](docs/supply-chain.md)
- [Framework Package 发布与 npm/pnpm 分发](docs/package-publication.md)
- [部署与运行责任](docs/operations.md)
- [Platform Operations 与持续交付](docs/platform-operations.md)
- [多产物 CI/CD 与客户端发布](docs/ci-cd.md)
- [总体架构](docs/architecture.md)
- [开发者体验与 AI 编程](docs/developer-experience.md)
- [配置参考](docs/configuration-reference.md)
- [CLI 与诊断契约](docs/cli-and-diagnostics.md)
- [客户端 Runtime 与多端开发](docs/client-runtimes.md)
- [跨平台 Design System](docs/design-system.md)
- [前端基础能力：i18n、图标与资源约定](docs/frontend-foundations.md)
- [基础 UI Shell 模板与路由](docs/ui-templates.md)
- [上游升级与兼容性](docs/upgrades.md)
- [Production Readiness Gate](docs/production-readiness.md)
- [Optional Kit 设计](docs/kits.md)
- [Integration Catalog](docs/integration-catalog.md)
- [SaaS Capability Catalog](docs/capability-catalog.md)
- [AI、知识库与文档智能能力](docs/ai-capabilities.md)
- [Product Module 规范](docs/product-modules.md)
- [开发路线图](docs/roadmap.md)
- [Phase 1 实施蓝图](docs/phase-1-blueprint.md)
- [Phase 1 风险实验状态](docs/spikes/README.md)
- [RFC 索引](docs/rfcs/README.md)
- [AFFiNE 架构研究](docs/research/affine.md)
- [AFFiNE 级产品可行性独立审查](docs/reviews/affine-feasibility.md)
- [决策与门禁台账](docs/decision-backlog.md)

## 下一步

当前 Phase 1A 先推进 S1～S7 中与装配骨架直接相关的实验；S1 仍是 provisional pass，S2、S3、S4 均已通过 Linux、macOS、Windows 的真实工具矩阵。S5 串行 lifecycle core、资源账本、启动失败回滚以及幂等/并发 stop 已取得 macOS arm64 provisional evidence；下一工作项 `A1-S5-02` 补齐生命周期 Event dispatch、嵌套深度和活动 dispatch 排空，shutdown deadline 和 host 强制终止仍不进入该工作项。S8 属于 Phase 1C 的 UI Shell 门禁，不属于当前 1A 批次，但仍是完整 Phase 1 的必需实验。通过对应门禁后再实现 `remote-saas-core` 与 `workspace-saas` 参考产品。Local Workspace、Block 文档与 Local → Cloud 验证链从 Phase 2 开始推进，不进入 Phase 1 范围。
