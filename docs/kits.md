# Optional Kit 设计

## 1. 目标

Kit 为产品提供可选、可组合的基础设施能力。开发者选择自己需要的 Kit，并在必要时配置策略或外部 adapter；Blankspace 自动完成依赖检查、初始化、运行时注册和目标裁剪。

Kit 不应把日常 SaaS 开发变成复杂编排。Phase 1 坚持：

```text
需要结果 → Service
通知事实 → Event
跨 Kit 产品流程 → Product Coordinator
```

开箱即用的 Kit 必须提供完整默认路径，而不只是接口。需要外部供应商时，CLI 应能安装 adapter、更新配置、生成环境变量模板并立即校验。

“完整默认路径”不意味着 Blankspace 自己实现领域引擎。编辑器、认证、支付、搜索、队列、对象存储和 CRDT 等优先集成成熟上游；Kit 负责薄适配、配置、生命周期、诊断、能力发现、conformance 和升级。Adapter 不得复制上游大部分 API，完整原则见 [Integration Catalog](integration-catalog.md)与 [RFC-0020](rfcs/0020-integration-first-kits.md)。

开发者选择的是 capability 与约束，不是一个模糊的品牌枚举。候选的 embedded/self-hosted/managed 交付方式、OSS/商业边界、支持状态和可移植性必须独立表达；主要领域候选见 [SaaS Capability Catalog](capability-catalog.md)，选择与晋级规则见 [RFC-0025](rfcs/0025-capability-catalog-and-selection.md)。

## 2. Kit 与其他概念

| 概念 | 所有者 | 物理形态 | 作用 |
| --- | --- | --- | --- |
| Foundation | Blankspace | 核心 packages | 装配和运行所有产品 |
| Optional Kit | Blankspace 或兼容作者 | 构建时 package | 提供可复用领域基础设施 |
| Adapter | Kit 或第三方作者 | package 或实现对象 | 对接具体技术和供应商 |
| Product Module | 产品团队 | `product/modules/` 目录 | 实现产品业务功能 |
| External Plugin | 第三方 | 未来的安装单元 | 面向最终用户动态扩展 |

Kit 在构建时进入产品，不是运行时插件。第一阶段不建设 Kit 市场，但 Contract 不应假定 Kit 只能由 Blankspace 官方实现。

## 3. 三类 Kit 配置

### 3.1 零配置

```jsonc
{
  "kits": {
    "@blankspace/kit-events": {},
    "@blankspace/kit-jobs": {}
  }
}
```

行为固定或拥有安全默认值。

### 3.2 策略配置

```jsonc
{
  "kits": {
    "@blankspace/kit-workspace": {
      "membership": "multi-user",
      "defaultRole": "member"
    }
  }
}
```

配置决定 Kit 的领域策略。

### 3.3 Adapter 配置

```jsonc
{
  "kits": {
    "@blankspace/kit-files": {
      "adapter": "s3",
      "bucket": { "$secret": "S3_BUCKET", "scope": "server" }
    },
    "@blankspace/kit-billing": {
      "adapter": "stripe",
      "secretKey": { "$secret": "STRIPE_SECRET_KEY", "scope": "server" },
      "publishableKey": "pk_from_non_secret_deployment_config"
    }
  }
}
```

Kit 定义领域语义，adapter 处理外部 SDK、协议和供应商差异。

根 Product Config schema 只校验 Kit 值是静态对象；Compiler 随后从已安装 Kit manifest 读取该 Kit 的 `configSchema`，执行第二阶段字段、adapter capability 与 SecretRef 校验。当前 S1 只实现根结构 schema，Kit 专属 schemas 和组合 validator 尚未交付，因此以上仍是目标语法。

## 4. Kit 定义

候选底层接口与 Runtime 生命周期保持一致：

```ts
export const billingEntry: KitEntry = {
  register(registry) {
    registry.provideFactory(BillingService, factoryContext => {
      const identity = factoryContext.use(IdentityService);
      const database = factoryContext.use(DatabaseService);

      return new BillingServiceImpl({
        identity,
        database,
        adapter: factoryContext.config.adapter,
      });
    });
  },
};
```

`register` 只登记 factory，不读取已实例化 Service，也不构造业务对象。Registry Draft 与 Graph 全量对账并提交后，Runtime 才按拓扑执行 factory；`factoryContext.use()` 只能取得 Graph 已绑定且已经成功启动的依赖。factory 构造纯内存对象，需要关闭的连接、监听器和后台任务由 entry 的 `start` 获取并遵守 RFC-0001 的清理规则。

Kit manifest 至少声明：

- 稳定 `id`；
- 硬依赖的 Service Contracts；
- 对外提供的 Service Contracts；
- 配置 schema；
- 各运行时入口；
- 自有数据与 migrations；
- 生命周期和清理方式。
- adapter/package 坐标、支持等级、maintainer/owner 与 security contact（适用时）。

## 5. 依赖与初始化

开发者不手工维护 Kit 初始化顺序。Product Compiler 根据 `requires` 生成有向无环图：

```text
Database
├── Identity
│   ├── Workspace
│   └── Billing
└── Jobs
```

构建阶段必须拒绝：

- 缺失硬依赖；
- 重复 Service provider；
- 循环依赖；
- 当前目标不支持的运行时入口；
- 缺失必填 adapter；
- secret 被客户端入口引用；
- Product Module 依赖未启用的 Service。

Kit 不应通过“检测某个可选 Kit 是否存在”偷偷改变关键业务行为。可选增强必须由产品显式配置或 Coordinator 显式调用。

## 6. Service Contract

需要结果或立即确认时，直接调用类型化 Service：

```ts
export interface BillingServiceContract {
  getSubscription(actor: ActorRef, owner: BillingOwnerRef): Promise<Subscription | null>;
  activate(actor: ActorRef, input: ActivateSubscriptionInput): Promise<Subscription>;
  hasEntitlement(actor: ActorRef, owner: BillingOwnerRef, feature: string): Promise<boolean>;
}

export const BillingService = defineService<BillingServiceContract>(
  'blankspace.billing'
);
```

使用方：

```ts
const billing = use(BillingService);
const allowed = await billing.hasEntitlement(actor, billingOwner, 'ai.unlimited');
```

规则：

- Contract 小而稳定，不暴露供应商 SDK；
- 使用方不导入 Kit 的 `internal/`；
- 业务错误使用明确的 typed error；
- Service 方法不依赖隐式全局用户或 Workspace；
- Account、WorkspaceRef、actor 等业务身份由 Contract 显式定义并传入；
- 公共 Service 不接收 HTTP request、AsyncLocalStorage context 或其他 Kit 的数据库 transaction。

Phase 1 不再包装一层 Command Bus 或 Query Bus。

## 7. Event

Event 表达已经发生的领域事实：

```ts
await events.publish('billing.subscription-activated', {
  accountId,
  subscriptionId,
  occurredAt,
});
```

Event 可以用于：

- Analytics；
- 搜索索引；
- 缓存失效；
- 通知与邮件；
- 非关键派生数据。

Event 不可用于：

- 请求返回值；
- 权限判断；
- 隐藏必须按序成功的业务步骤；
- 假装获得跨 Kit 原子事务。

事件处理失败不能让已经成功的原始事务变得含糊。需要可靠投递时，发布方在自己的事务中写入 outbox，由 Jobs Kit 或 Event transport 重试。

## 8. Product Coordinator

跨 Kit 流程属于产品：

```ts
export class OnboardingCoordinator {
  constructor(
    private readonly identity: IdentityServiceContract,
    private readonly workspaces: WorkspaceServiceContract,
    private readonly email: EmailServiceContract
  ) {}

  async register(input: RegisterInput) {
    const account = await this.identity.register(input);
    const workspace = await this.workspaces.create({ ownerId: account.id });

    try {
      await this.email.sendWelcome({ account, workspace });
    } catch (error) {
      // Account 与 Workspace 已成功；邮件记录后重试，不回滚核心数据。
      await this.recordEmailFailure(error, account.id);
    }

    return { account, workspace };
  }
}
```

Coordinator 是普通 TypeScript 类或函数，可以直接测试和调试。Blankspace 只负责注入 Services，不规定流程 DSL。

Coordinator 不能用一个共享数据库 transaction 把多个 Kits 强行包成原子操作。需要原子提交的数据通常应归属同一 owner；跨 Kit 流程使用幂等调用、明确的部分成功状态、补偿或事务 outbox。

## 9. 数据所有权

Kit 可以共享数据库实例，但必须拥有自己的表、schema 和 migration 命名空间。

禁止：

```ts
// Billing Kit 直接读取 Identity Kit 内部表
db.select().from(identityAccounts);
```

允许：

```ts
const account = await identity.getAccount(accountId);
```

跨 Kit 引用默认保存稳定 ID。是否使用数据库外键取决于部署模型和 migration 能否保持 Kit 独立升级，不能成为隐式依赖。

## 10. Billing 与外部供应商

Billing Kit 管理套餐、订阅、发票、entitlement、试用和状态转换。Payment Adapter 管理 checkout、收款、退款、供应商对象和 webhook。

```text
Billing Kit
└── Payment Adapter
    ├── Stripe
    ├── Waffo Pancake
    ├── Paddle
    ├── App Store
    ├── Play Billing
    └── Custom
```

产品代码依赖：

```ts
billing.hasEntitlement(actor, billingOwner, 'pro');
```

而不是直接依赖：

```ts
stripe.subscriptions.retrieve(...);
```

不同 adapter 不必假装功能完全一致。Kit 必须暴露 adapter capabilities，并在构建阶段拒绝使用供应商不支持的功能。

`BillingOwnerRef` 由产品明确映射到 account、organization、workspace 或其他计费主体，必须包含 isolation root；不能以裸 `accountId` 猜测租户。Stripe 是 PSP 类候选，Waffo Pancake 是 Merchant of Record 类候选，两者的税务、结算、支付方式与 webhook 能力不同。公共状态机、durable inbox、entitlement 和 reconciliation 见 [RFC-0024](rfcs/0024-billing-payment-adapters.md)。

## 11. Editor Kit

Editor Kit 统一编辑器发现、生命周期、内容类型、权限接入、保存和导入导出边界，不试图统一所有编辑操作。

阶段分为两步：Phase 2 只按 RFC-0018/E1 使用 experimental Editor Engine Boundary，服务于 Reference Workspace 的 Block 文档；Phase 5 才依据第二真实用例决定哪些能力晋级为稳定 Editor Kit。后文配置示例属于第二步，不能反向阻止 Phase 2。

```jsonc
{
  "kits": {
    "@blankspace/kit-editor": {
      "adapters": {
        "richText": "tiptap",
        "blockEdgeless": "blocksuite",
        "code": "monaco"
      }
    }
  }
}
```

这是 Phase 5 稳定 Editor Kit 的目标 Product Config 语法，不是当前或 Phase 2 experimental adapter 的可用配置。

Tiptap、BlockSuite、Monaco 和独立白板引擎具有不同内容模型。Blankspace 不提供虚假的万能 `insertBlock()` 接口，也不给每个上游 command 再包一层。富文本产品可直接深度使用 Tiptap extensions/commands；AFFiNE 参考产品则必须根据“结构化文档”与“Page + Edgeless 共享模型”的实际需要比较 Tiptap 组合方案和 BlockSuite。Tiptap 是富文本 reference adapter 候选，不等于完整 AFFiNE editor。待第二个内容型产品验证后，再决定哪些生命周期、持久化和投影能力值得晋级为稳定 Editor Kit。

## 12. Preset

Preset 是透明的 Kit 组合：

```jsonc
{
  "preset": "remote-saas-core"
}
```

Phase 1B 提供两个透明 preset：`remote-saas-core` 只展开 Identity、Database 与 Identity 自有的验证/恢复邮件 outbox/worker；`workspace-saas` 在 core 上增加 Workspace Kit 和默认 Workspace authorization starter。Account、Organization 或 B2B2C 产品使用 core 并选择自己的主体模板，不携带 Workspace schema、migration 或 Shell。Files、Search、通用 Jobs、Notifications 等只能由产品显式添加或进入新的命名 preset，不能在兼容 minor 中静默加入。

Compiler 先展开 preset，再处理根 `kits`。若同一 Kit ID 同时出现，产品声明以整个 Kit 配置对象为单位替换 preset 对象；不做递归合并、数组拼接或“最后字段获胜”。这样删除一个产品字段不会意外恢复 preset 中的同名默认值。若产品只想采用 preset 配置，就不要重复声明该 Kit。Product Graph 必须同时记录 preset 原始对象、产品替换对象、最终对象和 `source: product-replacement`；`explain` 需要展示这一替换链。关键 secret、adapter 和领域策略仍必须由产品显式选择，preset 不能提供可绕过授权的默认值。

CLI 应支持：

```bash
blankspace inspect kits
```

输出启用来源、依赖、adapter、运行时入口和裁剪结果。

## 13. 配置与秘密

```jsonc
{
  "adapter": "stripe",
  "secretKey": { "$secret": "STRIPE_SECRET_KEY", "scope": "server" },
  "publishableKey": "pk_from_non_secret_deployment_config"
}
```

- `scope: "server"` 的 SecretRef 只能进入服务端目标；
- 客户端配置必须作为明确的非秘密配置处理，不能伪装成 SecretRef；
- 缺失配置在启动前失败；
- Product Compiler 可以生成 `.env.example` 与部署配置说明；
- 任何 secret 流入客户端 graph 都必须导致构建失败。

## 14. Client Runtime Kit 与 UI coverage

Client Runtime Kit 是平台 host 和 UI renderer 的构建时 package，不是业务 Optional Kit，也不是最终用户动态 Plugin。Foundation 只消费其 manifest、capabilities、builder 和 verifier，不导入 React、Electron、Capacitor、SwiftUI 或 Compose 类型。

包含 mandatory Screen/Contribution 的 Kit 必须按 UI Family 声明 renderer coverage 和支持等级。无 UI Kit 可以只提供 Service。Graph 区分 `provided`、`fallback`、`excluded` 和 `missing`；缺失 mandatory renderer 时构建失败。只有 manifest 标记 `clientOptional: true` 且目标 client 没有 Screen、route、contribution、capability 或产品 requirement 依赖时才能排除，否则必须更换 Runtime 或安装 renderer。

第一方目标路线是 React Web、Electron React、Capacitor React Mobile、SwiftUI 和 Compose。React Native、Flutter、Tauri 等可以由兼容作者提供 Runtime Kit，但通过受信 verifier 的 conformance evidence 前不得获得 effective `verified`。概念见 [RFC-0015](rfcs/0015-client-runtimes.md)，分发、UI feature、证据与信任策略见 [RFC-0017](rfcs/0017-client-runtime-machine-contracts.md)。

跨生态 renderer 作为独立 artifacts 发布：npm、Swift Package 与 Maven 坐标通过 distribution manifest 绑定到同一逻辑 Kit identity、version 和 contract hash。`blankspace.lock` 记录每个 client 的真实 artifact、source、hash 与 generator；不能假设一个 npm Kit 包含可直接由 Xcode/Gradle 消费的实现，也不能只因版本号相同就视为兼容。

## 15. Phase 1 边界

Phase 1 实现：

- Kit 声明和硬依赖图；
- Service Contract 与 provider；
- Event 的进程内发布和测试支持；
- shared/server/web 入口裁剪；
- 配置 schema 与 secret 边界；
- Product Graph 和诊断。

每个稳定 Kit 还必须提供版本化 Contract、升级 manifest、最小示例、测试 harness 和适合 AI 读取的结构化元数据。

Phase 1 不实现：

- 运行时安装和卸载 Kit；
- Kit 市场；
- 自动远程发现第三方 Kit；
- Command/Query Bus；
- Workflow/Saga DSL；
- 分布式事务；
- 可选依赖触发的隐式业务行为。
