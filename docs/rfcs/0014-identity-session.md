# RFC-0014：Identity、Session 与请求身份

## 状态

Proposed

## 背景

Phase 1B 的 Reference SaaS 需要注册、登录和 Workspace 授权，但 Foundation 不应内置 Account 领域，也不能依赖隐式全局用户。若只规定“请求必须认证”，不同 Product Module 会各自解析 cookie、信任客户端 accountId，或把 HTTP request 传入 Service，最终无法证明多租户隔离。

本 RFC 固定 Phase 1 的最小 Identity Kit、安全会话和请求身份边界。企业 SSO、MFA、passkey、跨 Server 联邦和 Local-first 离线认证不属于此阶段。

## 决策

### 1. Identity 属于 Kit

Foundation 只提供 Service、Event、Runtime 和 host adapter 能力。Identity Kit 拥有：

- Account 与 credential 数据；
- email 注册、验证和密码认证；
- Session 的签发、查询、轮换、撤销和过期；
- 密码重置 token；
- 认证相关审计事件和速率策略接口；
- 从已验证 session 构造服务端请求身份。

Workspace membership、产品角色和资源权限由 Workspace Kit 或 Product Module 拥有。认证只证明 actor 身份，不自动授予业务权限。

### 2. 稳定身份

```ts
interface AccountRefV1 {
  serverId: string;
  accountId: string;
}

type ActorRefV1 =
  | { kind: 'account'; issuer: string; account: AccountRefV1 }
  | { kind: 'service-account'; issuer: string; serverId: string; serviceAccountId: string }
  | { kind: 'system'; issuer: string; serverId: string; owner: string; purpose: string }
  | { kind: 'shared-link'; issuer: string; serverId: string; grantId: string };
```

`accountId` 在一个 Server 内唯一且不可复用；跨 Server 使用完整 AccountRef。Email、用户名和显示名都不是稳定 ID或授权凭据。

Phase 1 的浏览器黄金路径只实现 `account`，但判别联合和 issuer/server scope 从 V1 就保留。API key/OAuth adapter 只有能建立 `service-account` 时才能发布对应 capability；RFC-0023 worker 建立受限 `system`；共享链接只有实现签名、撤销和 scope fixtures 后才能启用。客户端 request body 中的同形对象不能建立任何 ActorRef。Product route 或 Coordinator 将服务端认证边界建立的 ActorRef 传给 Service；Service 再根据当前数据检查权限。

Blankspace 不提供可被任意代码读取的全局 current user。AsyncLocalStorage 可以由 host 用于日志 correlation，但不能成为 Service Contract 的唯一身份来源。

### 3. Phase 1 认证方式

默认 Identity adapter 支持 email + password：

```text
register
→ 发送 email verification
→ verify email
→ authenticate
→ create session
```

产品可以选择是否允许未验证账号进入有限 onboarding，但创建共享 Workspace、邀请、导出、删除和权限变更等敏感操作要求已验证 email。具体业务门槛通过 capability/policy 配置显式声明。

密码使用 Argon2id 与每条 credential 唯一 salt，不存储明文或可逆密文。实现 spike 在目标硬件上冻结参数，最低不得低于采用时 OWASP Password Storage 指南的 Argon2id 基线；算法、参数和版本随 hash 记录，成功登录时可渐进 rehash。可选 pepper 存在 secret provider 中并支持版本轮换，不能与数据库一同存储。

密码允许 Unicode 和空格，不静默截断；最大输入字节数用于防止拒绝服务并在 UI/API 中一致声明。产品不得要求周期性强制修改密码；已知泄漏、管理员重置或高风险事件可要求重新认证和轮换。

### 4. Server-side Session

Phase 1 使用服务端存储的 opaque session，不使用自包含 bearer JWT 作为默认 Web session。

```ts
interface SessionRecordV1 {
  sessionIdHash: string;
  account: AccountRefV1;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  authenticationVersion: number;
  revokedAt?: string;
  revokeReason?: string;
}
```

客户端 session ID 由密码学安全随机源生成，至少 128 bits entropy，只含无业务含义的随机值；数据库只存其单向 hash。生产 Web 通过 `__Host-` 前缀 cookie 传递，设置 `Secure`、`HttpOnly`、`Path=/` 和显式 `SameSite`，不设置 `Domain`，不出现在 URL、localStorage 或日志中。

Session 同时具有 idle、absolute 和可选 renewal timeout。精确时长是产品安全策略，必须在部署前冻结；默认值不能被客户端延长。登录、权限等级变化、密码重置、可疑会话恢复和其他高风险事件轮换 session ID。Logout 撤销当前 session；用户可以查看并撤销其他 sessions；密码重置默认撤销全部既有 sessions。

### 5. CSRF 与请求认证

Cookie 认证的非安全 HTTP 方法必须通过 CSRF 防护。Phase 1 Web host 同时使用：

- `SameSite` cookie 作为一层浏览器约束；
- Origin/Fetch Metadata allowlist；
- 与 session 绑定、不可从跨站请求读取的 CSRF token；
- 对登录、重置、邀请等端点的速率限制。

GET/HEAD 不执行状态修改。CORS 使用显式 origin allowlist，不与 credential 模式下的通配符组合。WebSocket、SSE 和上传入口使用同一 session 验证与 origin 策略。

### 6. 请求身份到 Service

HTTP route 的顺序固定为：

```text
解析并限制输入
→ 验证 session 与 CSRF/origin
→ 从 SessionRecord 构造 ActorRef
→ 调用 Service(actor, businessInput)
→ Service 查询当前授权事实
→ 输出受控响应
```

ActorRef 可序列化是为了 Contract 和日志结构一致，但它不是凭证。跨进程调用不能只转发 ActorRef，必须使用目标端认可的认证机制重新建立 actor。Service 不信任请求 body、Event payload 或缓存中的 role/entitlement 快照。

后台任务和 system actor 需要独立判别类型、最小权限和审计来源；Phase 1B 的用户请求不能伪装成 system actor。Phase 1B 最小 Identity 邮件 worker 使用 RFC-0023 的受限 system actor；完整 Jobs Kit 可以后续实现，但不能继续推迟可靠邮件所需的主体定义。

### 7. 授权责任

Identity Kit 提供 actor 与 account 状态；数据 owner 执行授权：

- Product Module 根据自己的 tenant/organization/workspace 模型定义主体与关系；
- Authorization Kit 通过 RFC-0021 adapter 做 permission decision，数据 owner 仍负责 enforcement；
- Workspace Kit 仅在产品采用 Workspace membership 时验证对应关系；
- Product Module 验证自己的 resource permission；
- Billing 等 Kit 使用产品传入的完整 BillingOwnerRef 验证 scope/entitlement；
- Server host 只执行通用 session、CSRF 和 transport 检查。

权限检查和数据访问应在同一 owner 的一致性边界内，避免检查后使用过期的客户端声明。缓存授权结果必须包含完整 scope、policy version 和短有效期；权限撤销事件只用于加速失效，数据 owner 的当前状态仍是事实源。

### 8. 注册与枚举防护

Email 规范化策略明确、版本化并用于唯一索引；保留原始显示值。大小写、国际化域名和 provider 特有别名不能由不同入口各自处理。

登录、注册、验证和重置接口不通过文本、状态码或明显的快速路径泄漏账号是否存在。对 account、IP、device/risk signal 分层限速；不能用永久锁定让攻击者对已知 email 发起拒绝服务。

错误对外使用稳定类别，对内 diagnostics 保留安全调查所需原因。密码、token、session ID 和完整认证请求不进入日志。

### 9. Email 验证与密码重置

验证和重置 token：

- 使用密码学安全随机源，单次使用并短期过期；
- 数据库只保存 token hash、purpose、account、创建/过期/使用时间；
- 与请求目的和 AccountRef 绑定；
- 使用后原子标记 consumed，重复使用失败；
- 生成链接时使用配置的可信 public origin，不信任请求 Host；
- 响应对存在和不存在账号保持一致，并限制发送频率。

密码重置成功后不自动登录，通知用户，并撤销或显式要求用户选择撤销其他 sessions；Phase 1 默认全部撤销。修改 email 需要重新验证，并通知旧地址。

### 10. Adapter 边界

Better Auth 类本地 authentication adapter 或外部 IdP adapter 可以实现 Identity Kit 定义的认证能力，但不能改变 AccountRef、Session、审计和业务授权语义。Organization/Team 插件只是可选 Product starter，不进入 Identity Contract。Adapter capability 明确：password、email-verification、recovery、MFA、OIDC、api-key 等；细粒度授权交给 RFC-0021 Authorization Kit。

Phase 1 Reference SaaS 只需要默认 password adapter。OIDC、SAML、social login、passkey 和 MFA 在真实产品需求与安全 fixture 出现后加入；缺失 capability 时 Compiler 在构建阶段失败。

### 11. 审计与 diagnostics

至少记录：注册结果、验证、登录成功/失败类别、session 创建/轮换/撤销/过期、密码重置、email 变化、权限敏感操作的重新认证结果。记录 requestId、correlationId、AccountRef（策略允许时）、session record 内部 ID 或不可逆关联值、来源类别和结果；不记录 credential 或客户端 session ID。

面向客户端的错误不暴露账号存在性、hash 参数或内部 provider 响应。面向运维的 diagnostics 仍需受权限和保留策略保护。

### 12. 数据与 migration

Identity Kit 拥有 accounts、credentials、sessions、verification/reset tokens 和 auth audit namespace。Workspace Kit 只保存 AccountRef，不直接读取 credential/session 表。Identity migration 遵守 RFC-0010 的 transactional/checkpointed 与恢复契约。

删除账号不是简单级联删除所有 Kit 数据。Identity 发起版本化、可审计的 account lifecycle 流程；各 owner 根据产品政策归档、转移或清除数据。完整删除编排不属于 Phase 1B 的登录纵向切片。

## Phase 1B 验收场景

1. 注册、验证、登录、logout 和密码重置形成可运行 Web 流程；
2. session ID 不可预测、服务端只存 hash，cookie 属性和 CSRF/origin 检查通过；
3. 登录、权限变化和密码重置按规则轮换或撤销 sessions；
4. 存在/不存在 email 的登录与重置响应不泄漏可观察业务差异；
5. 伪造 request body actor、跨 Server AccountRef、撤销 session 和过期 session 均在数据访问前失败；
6. 同一 account 对 Workspace A 有权限、对 B 无权限时，缓存和查询不会串租户；
7. Product Module 只接收 ActorRef 和业务输入，不导入 HTTP session 或 Identity internal；
8. auth logs 不包含密码、reset token、原始 session ID 或 Authorization header；
9. 密码 hash 参数 benchmark、限速、session timeout 和 public origin 在 Reference SaaS 安全配置中冻结；
10. Identity schema/migration、adapter capability 和错误码进入 compatibility fixtures。

## 失败后的选择

- 若默认 password 实现无法在性能预算内满足 Argon2id 基线，调整部署资源或限制认证并发，不降级为快速 hash；
- 若 opaque session store 成为不可接受的运行瓶颈，先验证分区和缓存，不直接改成长期自包含 bearer token；
- 若每个 Service 重复授权逻辑，先在数据 owner 内提取 policy helper，不把 role 放入全局隐式 context；
- 若企业登录成为 Phase 1 必需需求，用新 spike 验证 OIDC adapter，不扩张 Foundation。

## 非目标

- MFA、passkey、OIDC、SAML 和 social login；
- 跨 Server 联邦账号或单点登录；
- 离线认证和 Local Workspace 设备身份；
- 通用组织/权限策略引擎；
- 管理员 impersonation；
- KYC、支付身份或合规认证。

## 参考资料

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

实现时重新核对参考基线并把精确参数、版本和测试环境写入安全 spike；链接不能替代本 RFC 的可执行 fixtures。
