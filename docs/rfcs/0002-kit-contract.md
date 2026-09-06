# RFC-0002：Kit、Service 与 Event Contract

## 状态

Proposed

## 背景

Kit 需要独立演进、被产品选择并向其他代码提供稳定能力。若 Kit 直接互相导入实现，依赖关系、数据所有权和升级影响都会隐藏在源码中；若引入 Command/Query/Workflow 等通用总线，又会提高简单产品的理解成本。

## 决策

### 1. Kit Manifest

每个 Kit 发布无副作用、机器可读的 manifest：

```ts
interface KitManifestV1 {
  schemaVersion: '1';
  id: string;
  version: string;
  requires: ServiceRequirement[];
  provides: ServiceDeclaration[];
  events: EventDeclaration[];
  configSchema: SchemaRef;
  entries: Partial<Record<RuntimeTarget, EntryRef>>;
  migrations: MigrationDeclaration[];
  capabilities: string[];
}
```

`id` 使用反向域名或受控命名空间，发布后不可复用。Manifest 不读取环境变量，不执行产品代码，也不包含 secret 值。

### 2. Service Contract

```ts
const BillingService = defineService<BillingServiceV1>({
  id: 'blankspace.billing',
  version: '1.0.0',
});
```

- Service ID 和 major version 决定兼容身份；Phase 1 同一裸 ID 只允许一个 major；
- Phase 1 requirement 只接受精确 `1`/`1.2`/`1.2.3` 或 caret `^1`/`^1.2`/`^1.2.3`；Compiler 选择唯一 provider；
- 一个产品图中同一 Service ID 只能绑定一个 provider；
- Compiler 先按 target、capability 和所有消费者 version ranges 过滤 provider：零个报缺失，一个自动绑定，多个必须由产品用 provider package identity 显式选择；绝不自动选择最高版本或按注册顺序覆盖；
- Contract 使用可序列化输入输出类型，但本地调用不强制序列化；
- 方法必须在业务输入中显式接收其语义所需的 account、WorkspaceRef、actor 或 request identity，不读取隐式全局状态；
- typed domain error 属于 Contract，底层 SDK error 不得泄漏。

Foundation 不规定一个包含所有身份、租户和事务的通用 Context。每个 Service Contract 定义自己真正需要的、可序列化的引用；例如 Workspace Service 使用 `WorkspaceRef`，Identity Service 使用自己的 AccountRef。HTTP request、React context、AsyncLocalStorage 对象和数据库 transaction handle 不能进入跨 Kit Service Contract。

数据库事务属于拥有数据的 Kit/Module 内部。一个 Service 可以在实现内部开启事务，也可以在同一 owner 的 internal 方法间传递 transaction，但公共 Service 不接收另一 Kit 的 transaction。跨 Kit 流程使用显式顺序、幂等、补偿或 outbox；如果业务确实要求同一原子事务，应重新评估数据所有权，而不是增加通用 transaction context。

Service 方法可以是 command 或 query，但 Phase 1 不增加对应总线。

```ts
interface ServiceRequirement {
  serviceId: string;
  versionRange: string;
  optional?: boolean;
  feature?: string;
}

interface ServiceDeclaration {
  serviceId: string;
  contractVersion: string;
  providerId: string;
  targets: RuntimeTarget[];
  capabilities?: string[];
}
```

这是有意收窄的 semver 子集。`~`、比较表达式、通配符、并集、预发布和 build metadata 在 Phase 1 schema 中拒绝；出现真实需求后再扩展语法并增加解析与兼容 fixtures。

Optional Service 默认不进入 Registry、目标闭包或启动拓扑。产品配置显式启用对应 `feature` 后，它被规范化为普通硬 requirement；缺失或版本不满足立即编译失败，并参与 affected tests。代码通过生成的 feature 常量或已绑定 Service 使用它，不在运行时 `tryResolve` 猜测存在性。

Phase 1 根配置用 `enabledFeatures: ["<module-id>/<feature-id>"]` 启用 Module optional feature，用 `serviceProviders: { "<service-id>": "<provider-package-id>" }` 消除过滤后的多 provider 候选。前者必须引用 Product Manifest allowlist 中 Module 的真实 `optional` 声明；后者不能绕过 target、capability 或 version range，也不能保留没有消费者的多余选择。字段结构以 `product-config.schema.json` 为准。

### 3. Event Contract

```ts
const SubscriptionActivated = defineEvent<Payload>({
  id: 'blankspace.billing.subscription-activated',
  version: '1.0.0',
});
```

- Event 表达已经发生的事实，名称使用过去式语义；
- Event envelope 包含 eventId、version、eventInstanceId、occurredAt、correlationId、causationId 和 dispatchDepth；业务 payload 包含关联 ID；
- 发布不返回业务结果；
- 默认 transport 是进程内、同次运行、best-effort；
- handler 失败记录独立 diagnostic，不改变原 Service 已成功的事实；
- 可靠投递必须由发布方事务性 outbox 与明确 transport 提供，不能由基础 Event API 假装保证。

Event minor 版本只能新增可选字段；消费者必须声明接受的 major/range。不兼容消费者在编译期失败。

Phase 1 的 `publish(): Promise<void>` 只表示本次 dispatch 已完成。Handlers 按稳定 handler ID 串行执行；单个异常被捕获到 Runtime diagnostics sink，随后继续其他 handlers，Promise 不因 handler 业务错误拒绝。Runtime 自身无法调度时才拒绝。需要让调用者获知结果的逻辑必须使用 Service。

进程内 Event transport 只在 Runtime 进入 `ready` 后接受新的 publish。`register`、factory 和 `start` 阶段发布会以生命周期 diagnostic 拒绝，避免 handler 在依赖尚未就绪时运行。Runtime 开始 stopping 后拒绝新 publish，并在关闭 deadline 内等待已经开始的 dispatch 完成，再按反序停止 entries；超时行为交给 host adapter 处理并记录未完成 handler。

handler 内可以发布另一个 Event；Phase 1 使用同步的深度优先 dispatch，内层 publish 完成后外层 handler 才继续。Envelope 增加 `correlationId`、`causationId` 和 `dispatchDepth`。Runtime 默认最大深度为 32；超过时拒绝内层调度并生成稳定 diagnostic，随后按普通 handler 失败规则继续外层剩余 handlers。该限制防止 Event 环形成无限递归，不提供业务重试保证。

Event envelope 中的 `occurredAt` 由事实发布方提供，表示业务事实发生时间；Runtime 只校验格式，不用自己的当前时间改写。`eventInstanceId` 由发布方生成且在重试时保持不变。进程内 best-effort transport 不据此去重；durable transport 必须单独定义幂等和持久化语义。

### 4. Kit Runtime

Kit runtime entry 导出：

```ts
interface KitEntry {
  register(context: RegistrationContext): void;
  start?(context: StartContext): Promise<void>;
  stop?(): Promise<void>;
}
```

`register` 只能登记 manifest 与 Graph 已声明的 Service/handler factories，不能实例化业务对象或声明新 Contract。Runtime 先在 Registry Draft 完成全部 register，再验证 binding IDs、provider identities 和 handler IDs；不一致时丢弃 Draft 并停止启动。Factories 只在 Draft 提交后按拓扑实例化，`start` 不能动态增加公共 Contract。Event dispatch 在全部必需 entries 启动并进入 ready 前保持关闭。

### 5. Adapter

Adapter 实现 Kit 定义的 provider contract，并发布 capability 列表。产品显式选择 adapter。下列 TypeScript 只说明 Kit 与 adapter 的语义关系，不是 `blankspace.config.jsonc` 的可执行配置语法：

```ts
billingKit({ adapter: stripe() })
```

Compiler 校验 Kit 所需 capability，而不是假设所有供应商功能相同。Adapter 不可扩展 Kit 的公共领域语义；供应商专有能力要么作为显式可选 Contract，要么留在 Product Module 内。

### 6. 数据所有权

- Kit 拥有自己的 schema、表和 migration 命名空间；
- 其他 Kit 只保存稳定 ID 并调用 Service 或订阅 Event；
- 共享数据库不等于共享数据所有权；
- 跨 Kit 外键必须由双方 Contract 和 migration 顺序显式声明，默认不允许；
- Kit 卸载不自动删除数据。

## 验收场景

1. 两个 Billing adapters 可由产品显式切换，消费者源码不变；
2. 重复 provider、缺失 Service、version range 不满足和 capability 不足在编译期失败；
3. register 提供未声明 Service 时启动失败；
4. handler 失败不让已完成业务操作显示为失败；
5. 可靠事件示例通过事务 outbox 在重复投递下保持幂等；
6. web target 无法导入 server-only Service 实现或 secret；
7. 升级 manifest 能分别报告 Kit Contract 与 adapter 冲突。
8. start/stop 阶段的新 Event 被拒绝，关闭会等待已开始 dispatch；嵌套 Event 超过深度限制时给出确定 diagnostic。
9. 公共 Service Contract 不暴露其他 Kit 的 transaction、HTTP request 或 framework context bag。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| Kit 直接互相依赖实现 | 写起来直接 | 依赖和升级不可见 | 拒绝 |
| 全部消息化 | 松耦合 | 请求响应、错误和调试复杂 | 拒绝 |
| Service + Event + 产品 Coordinator | 常规 TypeScript、边界明确 | 跨 Kit 长流程需产品处理 | 采用 |

接受的限制是 Phase 1 不提供分布式事务或 Workflow DSL。真实长流程可先由显式 Coordinator、幂等 Service、outbox 和 Jobs Kit 解决。

## 重审触发条件

- 同一 Service 多 provider 同时使用成为普遍需求；
- 大量 Product Coordinators 重复相同可靠长流程；
- 序列化限制妨碍单进程高性能能力。
