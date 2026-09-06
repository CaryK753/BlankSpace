# RFC-0024：Billing 状态机与 Payment Adapter

## 状态

Proposed

## 背景

Billing Kit 必须允许 Stripe、Waffo Pancake、Paddle 和应用商店等不同模式，同时不能把供应商对象变成产品授权事实。Waffo Pancake 对东亚开发者有 hosted checkout、多语言、多币种和 WeChat 等能力价值，并采用 Merchant of Record 模式；这些差异应由 capability 表达。

## 决策

Billing Kit 拥有产品的 plan/version、subscription projection、purchase/payment projection、entitlement、usage 和 provider mapping。Payment Adapter 只拥有 checkout、provider API、webhook verification/inbox、refund/reconciliation 与外部对象转换。公共用户/管理员操作必须同时接收可信 `ActorRef` 与 `BillingOwnerRef`，由 Billing owner 检查 permission；webhook/reconciliation 只能使用 RFC-0023 的受限 system actor。计费主体由产品明确映射到 account、organization 或 workspace，禁止裸 `accountId: string`。

```ts
type BillingOwnerRef = {
  type: string;
  id: string;
  isolationRoot: ResourceRef;
};
```

Subscription lifecycle 至少覆盖 `trialing | active | past_due | canceling | canceled`；一次性 Purchase/Payment lifecycle 至少覆盖 `pending | paid | failed | expired | partially_refunded | refunded | disputed | fulfilled`。两者分别运行 capability corpus，最终投影到共同 entitlement；adapter 可以声明不支持其中一种。Entitlement 由经过验证、去重和重排后的本地 projection 计算，不直接信任 success redirect 或单个 webhook。

Webhook endpoint 必须在解析前保留 raw bytes，验证签名、timestamp/environment、provider event identity 与目标 merchant/store；先写 durable inbox 再返回成功。重复、乱序、延迟和 poison event 均幂等处理，并通过 provider API reconciliation 修复。金额使用 decimal string + ISO currency。

Checkout/refund 等 outbound 创建必须先持久化 durable billing operation，再调用 provider。Adapter 必须声明 provider-native idempotency 或按 operation ID/external reference 查询和 reconcile 的能力。若供应商业务标识不保证唯一，Blankspace 维护本地唯一映射；若供应商既不保证幂等又无法可靠查询，未知结果进入 `manual_recovery`，禁止自动重试。

### Waffo Pancake adapter 候选

截至 2026-09-06 的官方文档显示：

- server API 使用 merchant ID 与 RSA-SHA256 private-key signing，test/prod 绑定在 key；
- checkout session 锁定 product version、价格和 currency；
- 支持一次性与订阅产品、hosted checkout、refund tickets 和 Customer Portal；
- checkout payment-method capability 包含 card、Apple Pay、Google Pay 与 WeChat，但具体可用性受产品类型和 currency 组合约束；
- `orderMerchantExternalId` 等业务标识不是 Waffo 保证唯一的 idempotency key；
- SDK/reference adapter 候选为 `@waffo/pancake-ts`，确切版本必须经过 compatibility fixture。

因此 Waffo adapter manifest 至少声明 MoR、supported currencies/payment methods、one-time/subscription、trial、refund、portal、test/prod 和 reconciliation capabilities。私钥只进入 server graph；生产必须拒绝 test-mode event。是否使用 Waffo、其费率、入驻/KYB、结算和地区可用性属于部署时商业决策，不写死在 Framework Contract。

## 验收条件

1. Stripe 与 Waffo 两个 adapter 分别按 capability 运行 subscription 与 one-time provider-neutral corpus；
2. replay、乱序、签名失败、环境混淆、金额/币种不匹配和 inbox 崩溃均不错误授予 entitlement；
3. provider outage 后 reconciliation 收敛；
4. refund/dispute/cancel 的产品政策显式且可审计；
5. 更换 adapter 有 export/mapping/cutover 计划，不宣称自动无损迁移。
6. 跨租户 subscription read、checkout、cancel/refund 与伪造 system actor 负面 fixtures 通过。
7. 调用前崩溃、provider 成功后响应丢失、external reference 持久化前崩溃均收敛或明确进入人工恢复。

## 非目标

- 自研支付处理或税务系统；
- 假装 PSP 与 Merchant of Record 责任相同；
- 让供应商 subscription 对象成为产品的唯一授权源；
- 承诺所有 adapter 支持相同支付方式、国家、币种或退款能力。
