# Blankspace 总体架构

## 1. 文档状态

本文定义 Blankspace 当前采用、等待证据确认的架构方向。接口示例仍是候选设计。TypeScript/ESM、Node.js 24 LTS、React-first、Fastify、PostgreSQL、JSON Schema-first 与 JSONC 是 RFC-0013 的 Proposed 决策，可用于验证性实现但尚未 Accepted；pnpm、Vite、Vitest、Playwright、数据库访问层及若干分析工具仍需通过 spikes 锁定。

已确认：

- Blankspace 面向广泛 SaaS 产品；
- 采用 `Foundation + Optional Kits + Product Overlay`；
- local-first 是可选基础能力，不是所有产品的强制数据模型；
- Product Module 以目录为开发单位；
- 最终能力上限应足以构建 AFFiNE 级完整产品；
- 客户端 Runtime 可替换，官方目标同时包含 React/Electron/Capacitor 与 SwiftUI/Compose；
- Phase 1 优先普通代码与少量原语，不建设通用编排语言。
- 采用 integration-first：Blankspace 不重造成熟领域引擎，只维护薄适配和产品化集成边界。

## 2. 架构总览

```text
┌──────────────────────────────────────────────┐
│               Product Overlay                │
│ Modules / Coordinators / UI / Data / Brand   │
├──────────────────────────────────────────────┤
│                Optional Kits                 │
│ Identity / Workspace / Editor / Local-first  │
│ Files / Search / Jobs / Billing / ...        │
├──────────────────────────────────────────────┤
│                  Foundation                  │
│ Lifecycle / Services / Events / Runtime      │
│ Configuration / Compiler / Diagnostics       │
└──────────────────────────────────────────────┘
```

依赖方向只能向下。Foundation 不导入 Kit 或产品代码；Kit 不导入 Product Module；Product Module 不导入 Kit 内部实现。

## 3. Foundation

Foundation 是框架的最小公共层，只负责所有产品都需要的应用装配能力：

- Product 配置加载与校验；
- Kit 与 Product Module 的发现；
- 依赖图、初始化顺序和生命周期；
- 类型化 Service 注册与查找；
- Event 发布、订阅和错误处理；
- Runtime Adapter 与目标裁剪；
- 公开配置、服务端配置和 secret 的边界；
- Product Graph 生成与诊断；
- 测试 runtime。

Foundation 不定义 Account、Workspace、Organization、数据库实体、权限、支付、文件、编辑器、本地数据库或同步协议。

认证身份、产品主体和授权必须分离：Identity Kit 可以借助 Better Auth 类 adapter 建立 Account/Session/Actor；产品自行定义 Organization、Team、Workspace、service account 和资源关系；Authorization Kit 可以连接 OpenFGA、SpiceDB、Casbin 或产品实现。Foundation 不冻结统一 User/Organization/Role 表，详见 [RFC-0021](rfcs/0021-identity-authorization-composition.md)。

## 4. Optional Kits

Kit 是 Blankspace 维护或兼容的构建时基础设施 package。产品显式选择 Kit，Preset 只负责展开常用组合。

候选包括 Identity、Workspace、Permissions、Files、Jobs、Notifications、Editor、Local-first、Sync、Collaboration 和 Billing Kit。这不是 Phase 1 交付清单。

只有满足以下条件的能力才适合成为官方 Kit：

1. 能被多个不同产品复用；
2. 核心语义可以脱离具体产品存在；
3. 需要跨运行时生命周期或大量基础设施；
4. 经过至少两个真实实现验证后拥有稳定边界。

AFFiNE 参考产品可以证明能力有用，但不能单独证明它必须进入 Foundation 或 Kit。Kit 应优先复用成熟上游：编辑器、认证、支付、搜索、队列和 CRDT 的内部算法不属于 Blankspace。Adapter 只负责 manifest、配置、生命周期、capability、跨领域的最小输入输出、诊断、conformance 和升级元数据，不镜像上游完整 API；深度功能由 Product Module 使用上游公共 API。完整规则见 [Optional Kit 设计](kits.md)、[Integration Catalog](integration-catalog.md)与 [RFC-0020](rfcs/0020-integration-first-kits.md)。

## 5. Product Overlay

Product Overlay 包含领域模型、Product Modules、跨 Kit Coordinators、平台 UI、routes、API、任务、数据定义、主题和本地化。

长期目标是让产品仓库以 packages 依赖 Blankspace。早期原型可以把 framework 和 `product/` 放在同一仓库，但必须维持 package、目录、依赖方向与代码所有权边界。

### 5.1 多客户端 Runtime

Blankspace 分离 client identity、运行 platform、Client Runtime Kit 和 UI Family。Web 与 Electron 默认共享 React Desktop renderer；Capacitor 使用独立 React Mobile renderer；iOS 和 Android 还可以分别选择 SwiftUI 与 Compose。一个 client 只绑定一个主 UI Runtime，但同一产品的不同客户端可以选择不同路线。

跨端共享 Domain/API/Error schema、Screen state/event、Route identity、Design semantics 和 fixtures；Transport、页面组件树与系统集成由平台 Runtime 实现。Foundation 不导入任何 UI framework 类型。完整模型见[客户端 Runtime](client-runtimes.md)、[RFC-0015](rfcs/0015-client-runtimes.md)、[跨平台 Design System](design-system.md)与机器契约 [RFC-0017](rfcs/0017-client-runtime-machine-contracts.md)。这些是 Phase 1 之后的 Proposed 能力，不改变当前 `web`/`server` schema。

## 6. 最小交互原语

### 6.1 Service

需要返回值、立即确认成功或清晰传播错误时，调用公共 Service：

```ts
const account = await identity.getAccount(accountId);
const subscription = await billing.activate(input);
```

调用者依赖 Service Contract，不依赖具体 Kit 类或内部文件。

### 6.2 Event

某件事已经发生，其他部分可以选择响应时，发布 Event：

```ts
await events.publish('subscription.activated', {
  accountId,
  subscriptionId,
});
```

Event 适用于通知、索引、Analytics、缓存刷新和可重试副作用。它不用于获取返回值、权限判断或隐藏关键业务顺序。

### 6.3 Product Coordinator

跨 Kit 的产品流程使用普通 TypeScript：

```ts
export class OnboardingCoordinator {
  constructor(
    private readonly identity: IdentityService,
    private readonly workspaces: WorkspaceService,
    private readonly email: EmailService
  ) {}

  async register(input: RegisterInput) {
    const account = await this.identity.register(input);
    const workspace = await this.workspaces.create({ ownerId: account.id });
    await this.email.sendWelcome({ account, workspace });
    return { account, workspace };
  }
}
```

Kit 只编排自身领域内不可分割的操作。多个独立 Kit 构成的产品体验由 Product Overlay 控制，不由 Kit 根据环境自动猜测。

## 7. 数据所有权与一致性

每个 Kit 拥有自己的数据模型。例如 Identity 管理 accounts 与 sessions，Workspace 管理 workspaces 与 memberships，Billing 管理 subscriptions、invoices 与 entitlements。

其他 Kit 只能保存稳定 ID、调用公共 Service 或订阅公开 Event，不得直接读写其数据表。Phase 1 允许多个 Kits 共用一个数据库和 migration system，通过 schema 或命名前缀表示所有权，不要求每个 Kit 独立数据库。

单个 Kit 内的关键写入由该 Kit 自己保证事务。跨 Kit 与外部服务的流程默认使用显式顺序、幂等和可重试副作用，不承诺分布式原子事务。只有真实长流程需求出现后，才评估可选 Durable Jobs 或 Workflow Kit。

## 8. Runtime 与目标裁剪

Contract、领域类型、配置、API client 和纯逻辑可以共享；窗口、导航、SQLite、IndexedDB、文件系统、安全存储、通知、后台任务和平台支付允许差异。

Phase 1 的 Kit 只贡献 `shared`、`server` 和 `web` 入口。RFC-0015 未来以 Client Target、Client Runtime 与 UI Family 描述 Desktop/Mobile；Product Compiler 始终只把目标 client 所需入口和 adapter 放入产物。

## 9. Workspace Provider 模型

Workspace 不属于 Foundation。安装 Workspace Kit 后，产品获得 Workspace Registry 与 Provider Contract。

```ts
type WorkspaceRef = {
  sourceId: string;
  workspaceId: string;
};
```

`sourceId` 表示管理该 Workspace 的 provider。它用于客户端定位、存储命名空间和 provider 选择，不表示一个可随意追加的同步目标列表。

```ts
interface WorkspaceProvider {
  readonly sourceId: string;
  list(): Promise<WorkspaceMetadata[]>;
  create(input: CreateWorkspaceInput): Promise<WorkspaceRef>;
  open(ref: WorkspaceRef): Promise<WorkspaceEngineConfig>;
  archive(ref: WorkspaceRef): Promise<void>;
}
```

| Provider | 本地状态 | 远端状态 | 适用场景 |
| --- | --- | --- | --- |
| Local | 主数据 | 无 | 纯本地应用 |
| Remote-only | 可选缓存 | 服务端主数据 | 传统 SaaS |
| Local-replica | 完整本地副本 | 单一 Server 同步源 | AFFiNE 类产品 |

Cloud Workspace 并不等于 remote-only。它可以从创建时就属于一个 Server Provider，同时在客户端拥有完整本地副本。

### 9.1 Server Registry

Server 与 Workspace 是相关但不同的概念：

```text
Server Registry
├── endpoint
├── server config/features
├── protocol version
└── server-scoped Account Session

Server
└── contributes one or more Workspace Providers
```

客户端可以连接多台 Server，每台 Server 有独立认证会话和能力集。官方托管只是内置 Server，自托管 Server 使用相同的发现与作用域模型。

### 9.2 Local → Cloud

Blankspace 将 Local → Cloud 定义为显式迁移：

```text
在目标 Server 创建 Cloud Workspace
→ 复制文档、领域数据和文件
→ 验证目标数据
→ 切换到新的 WorkspaceRef
→ 按策略归档或删除旧 Local Workspace
```

迁移不是给 Local Workspace 修改 `sourceId`，也不是把多台 Server 追加为同步目标。是否保留旧 Workspace、是否维持内部文档 ID、失败后如何恢复，需要由迁移 RFC 定义。

## 10. Local-first 能力

local-first 由 Local-first Kit 提供，可被 Workspace Provider 或具体数据域启用。

| 模式 | 写入位置 | 数据权威 | 同步 |
| --- | --- | --- | --- |
| `remote` | 远端 API | 服务端 | 无 |
| `local` | 本地事务 | 本地 | 无 |
| `replicated` | 本地事务 | 本地副本与复制协议 | 有 |

一个产品可以让文档使用 `replicated`，订阅与账单使用 `remote`，设备偏好使用 `local`。

`replicated` 模式的最低不变量：

```text
用户操作
→ 在本地事务中写入数据与待同步记录
→ 更新本地界面
→ 后台复制
→ 重试或报告同步状态
```

同步失败不能撤销已成功提交的本地操作。CRDT 只是某些协作数据的候选实现，不是所有 replicated 数据的默认答案。

## 11. UI 扩展

```text
Brand Primitive / Semantic Token / Component Recipe
→ Platform Renderer
→ Semantic Contribution
→ Composition
→ Named Visual Slot
→ Explicit Override
→ Framework Fork（不支持）
```

优先使用 route、command、navigation item、setting、resource renderer 等语义贡献。视觉插槽只用于确实依赖位置的扩展。跨平台主题共享语义而不是固定像素，详见 [RFC-0016](rfcs/0016-cross-platform-design-system.md)。

## 12. 暂不引入的抽象

- Command Bus 和 Query Bus；
- Workflow 或 Saga DSL；
- 同时统一 HTTP、本地调用和 CRDT 的 Operation API；
- 运行时动态 Kit；
- Kit 根据可选依赖自动改变关键业务行为；
- 跨 Kit 分布式事务；
- 通用多服务器同步拓扑。

这些能力只有在普通 TypeScript、Service、Event 和后台任务无法清晰解决真实问题时才进入 RFC。

## 13. Proposed RFC，仍需原型验证

- Foundation 的最小 package 划分与公开 API（RFC-0001）；
- Kit Contract、Service token 和生命周期（RFC-0002）；
- Product Directory 与 Product Graph（RFC-0003、RFC-0004）；
- Workspace Provider、Server Scope 和数据模式（RFC-0005、RFC-0006）；
- 参考产品切片与 Local → Cloud 迁移（RFC-0007、RFC-0008）；
- UI、升级、AI 开发和能力验收（RFC-0009～RFC-0012）；
- Phase 1 技术方向与候选工具（RFC-0013）；
- Identity 与请求身份（RFC-0014）；
- 多客户端 Runtime、跨平台 Design System 与机器契约（RFC-0015、RFC-0016、RFC-0017）；这些不属于 Phase 1 实现范围。

完整草案见 [RFC 索引](rfcs/README.md)。`Proposed` 不代表已经实现或接受。

## 14. 开发者体验是架构约束

Foundation 的 API、目录边界和生成物必须共同支持：

- 一个命令创建并运行产品；
- 常规开发只修改 Product Overlay；
- Product Shell 提供深度 UI 定制而不暴露内部 DOM；
- `check`、`inspect` 和 `doctor` 给出稳定、结构化诊断；
- AI 与人类使用同一套 CLI、Contract 和验证规则；
- 上游升级先预检、再计划、应用并验证；
- internal import、手改生成物和 secret 泄漏由工具阻止。

任何新架构抽象都必须说明它如何改善这些体验，否则默认不加入 Foundation。详见[开发者体验与 AI 编程](developer-experience.md)和[上游升级与兼容性](upgrades.md)。
