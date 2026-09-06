# RFC-0022：Phase 1 API Contract V1

## 状态

Proposed

## 背景

Remote SaaS 在 Phase 1 就需要稳定的 Web/Server 协议，不能等到原生客户端阶段再定义，也不能让每个 Module 手写 route、错误包装和分页。

## 决策

每个公开 operation 由静态 manifest 引用 JSON Schema，至少声明：稳定 ID、version、method/path 或 RPC selector、request/result、typed errors、认证方式、permission、isolation root、幂等语义、分页方式、rate-limit class 和敏感字段策略。

写 operation 必须声明 `none | idempotency-key | resource-version`；可由客户端或网关重试的创建/副作用操作不得选择 `none`。

`idempotency-key` 使用 `IdempotencyRecordV1`，identity 为 `(isolationRoot, operationId, key)`，并记录 actor、canonical request hash、`in-progress | completed | failed-retryable | failed-terminal`、result/error hash、创建/过期时间。占位记录与业务变更在同一 owner transaction 中创建或提交；相同 key 不同 request hash 返回稳定 conflict。并发请求只允许一个执行者，其他请求等待有界结果或返回 retry-later；completed 和 terminal error 可安全重放。进程在占位后崩溃时由 lease/owner transaction 恢复，不能永久卡住或再次执行已提交副作用。TTL 不得短于客户端最大重试窗口；清理只删除已终态且超过政策窗口的记录。

列表 V1 只提供 opaque cursor，cursor 绑定 filter/sort/isolation root 并带完整性保护，不暴露数据库 offset。成功和错误拥有固定 envelope；HTTP 状态不是唯一错误语义。

Compiler 从同一 Contract 生成 Fastify binding、TypeScript client、mocks 和 OpenAPI 投影。Server binding 从认证边界取得 ActorRef，不从 request body 建立 actor。Product Graph 记录 contract hash；Module manifest 静态声明 `apiContracts`，Runtime 只能绑定已声明 operation。

Public API 的 API key/OAuth/service-account authentication 是 Identity adapter capability，不复用浏览器 cookie，也不把 ActorRef 当 credential。缺少所需 capability 时对应 operation 不得发布。

## 验收条件

1. Web client、Server binding 和 mock 的 schema/hash 相同；
2. 跨租户 ID、匿名、错误枚举、分页篡改、重复写入均有负面 fixture；
3. 未声明 route、声明未绑定 operation、重复 ID 和不兼容 schema 使构建失败；
4. 上一 minor 客户端与当前 Server 的兼容窗口有证据；
5. API 文档和 AI context 从 Contract 生成，不靠扫描 handler 猜测。
6. 并发同 key、同 key 异 payload、提交前后崩溃、响应丢失和 TTL 边界 corpus 产生确定结果。

## 非目标

- 强制 REST 或 GraphQL 作为唯一 transport；
- 允许每个 Module 自定义成功/错误 envelope；
- 在 V1 建设完整 API gateway 产品。
