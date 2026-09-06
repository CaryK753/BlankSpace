# RFC-0023：可靠副作用、Jobs 与身份邮件

## 状态

Proposed

## 背景

进程内 Event 是 best-effort，但 Phase 1 的邮箱验证、密码重置和 onboarding 已需要可靠副作用。Blankspace 不应自研队列；它必须定义成熟队列 adapter 需要满足的交付边界。

## 决策

数据 owner 在业务事务内写 `EffectIntentV1`；dispatcher 从 outbox 投递给 BullMQ、云队列或其他 adapter。语义是 at-least-once，consumer 必须以 `(owner, effectId)` 幂等。Envelope 至少包含 schema/version、isolation root、actor/system provenance、payload hash、availableAt、attempt policy、deadline 和 correlation/causation ID。

Job adapter 必须声明 lease/visibility、heartbeat、ack、retry/backoff、DLQ、取消、调度、payload size、顺序和 tenant fairness capabilities。Blankspace 不宣称 exactly-once。涉及外部创建时，intent 必须先持久化；adapter 声明原生 idempotency、按 operation ID 查询/reconcile 或 `manual-recovery-only`。外部调用成功但响应/ack 丢失时只能按声明能力恢复；无法查询且不保证幂等的 provider 禁止自动重试，进入可审计人工恢复状态。

Phase 1B 内置最小 Identity Mail Delivery 路径，而不是等待完整 Notifications Kit：Identity transaction 写 verification/recovery mail intent；adapter 负责模板版本、供应商 message ID、dedupe、退信/投诉和测试 sink。Token version/expiry 与 effect payload 绑定；旧邮件不能恢复已轮换 token。

system actor 是独立判别类型，包含 owner Kit、purpose、isolation root 和最小 scope。普通用户请求不能构造它。DLQ replay、跨租户管理、强制取消和 payload 查看是特权管理操作并写安全审计。

## 验收条件

1. 在每个提交/投递/执行/ack 边界崩溃后无 intent 丢失且业务副作用不重复；
2. poison message 有界进入 DLQ，不阻塞其他租户；
3. 每租户 quota/fairness 防止单租户占满 worker；
4. worker 滚动发布 drain，旧 schema job 有兼容或 quarantine 路径；
5. Identity 邮件供应商 outage、重复、乱序、bounce 和旧 token fixtures 通过。
6. 外部调用前崩溃、成功后响应丢失、external reference 持久化前崩溃均按 capability 得到确定结果。

## 非目标

- 自研消息 broker；
- 用进程内 Event 冒充可靠队列；
- 建设 Workflow/Saga DSL；
- 对不可幂等的外部系统承诺 exactly-once。
