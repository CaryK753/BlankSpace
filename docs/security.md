# 安全模型与信任边界

## 1. 状态与范围

本文是 Blankspace 的初始威胁模型，约束 Phase 1 的 Foundation、构建时 Kits、Product Overlay 和 remote-only SaaS。Local Workspace、复制、第三方 Kit、External Plugin、Desktop/Mobile 和软件供应链签名需要在相应阶段扩展本模型。

当前仓库没有可部署产品，也没有经过安全审计的实现。本文定义实现和测试必须满足的边界，不构成安全认证。

## 2. 需要保护的资产

- account、session、Workspace membership 和业务数据；
- server secrets、供应商凭据、数据库凭据和签名材料；
- Product Graph、Executable Registry、两份 lockfile 和升级计划的完整性；
- Kit、adapter、Product Module 与 generated 代码的来源和所有权；
- migration 历史、备份、恢复点和审计记录；
- 多租户请求中的 account、Workspace 与资源作用域；
- 本地副本、离线队列和被拒绝修改；这些从 Phase 2 开始适用。

## 3. 信任区域

```text
不可信输入
配置文本 / HTTP 请求 / Event payload / 文件 / package metadata
        │ schema、认证、授权、边界检查
        ▼
产品进程
Foundation Runtime + 已构建的 Kits + Product Overlay
        │ adapter Contract
        ▼
外部系统
PostgreSQL / 对象存储 / 邮件 / 支付 / AI provider
```

Phase 1 的 Foundation、已选择的 Kits 和 Product Overlay 在构建后运行于同一信任进程，不提供进程内安全沙箱。因此 import boundary、package 审查和构建期裁剪是安全边界的一部分。未经审查的第三方 Kit 不能因为实现了 manifest 就被视为安全。

External Plugin 属于另一种默认不可信模型；在权限、签名、沙箱和故障隔离 RFC 完成前不支持运行时安装。

## 4. 配置与 SecretRef

Product 配置是静态 JSONC 数据，不能执行代码。根 schema 校验通用结构，Kit 的版本化 `configSchema` 校验具体字段和 adapter capability。

SecretRef 只表示服务端秘密的名称和 `server` scope：

```jsonc
{ "$secret": "STRIPE_SECRET_KEY", "scope": "server" }
```

规则：

- manifest、Graph、diagnostic、日志、升级计划和生成物只记录引用，不记录 secret 值；
- SecretRef 到达 web/shared entry 时编译失败；
- Runtime 只在 server host 启动时通过 host secret provider 解析；
- 客户端需要的 publishable key、endpoint 等是普通公开配置，不伪装成 secret；
- 缺失 secret 在启动监听端口或执行 migration 前失败；
- diagnostic 对异常和外部 SDK 响应做字段级脱敏，不能依赖字符串替换猜测 secret。

生产 SecretRef 还必须绑定环境和 consumer workload 的最小权限策略，读取与管理操作留审计；轮换使用版本化新值，依赖验证成功后撤销旧值。每个 secret 的 owner、轮换/撤销与泄漏响应 runbook、最近演练证据属于发布门禁，具体要求见[部署与运行责任](operations.md#6-配置与-secret)。

## 5. 身份、租户与 Workspace 授权

Foundation 不提供隐式全局用户。每个 Service Contract 显式接收其业务所需的 AccountRef、WorkspaceRef、actor 或 request identity。HTTP request、AsyncLocalStorage context 和数据库 transaction 不进入跨 Kit 公共 Contract。

每个服务端入口在访问数据前验证：

1. session 真实有效且属于当前 Server；
2. actor 对目标 account/Workspace/resource 具有所需权限；
3. URL、body、Graph binding 和 Service 参数中的作用域一致；
4. 数据查询包含明确租户条件，不能先读取再在应用层过滤；
5. 缓存 key、日志字段和异步任务携带完整作用域 identity。

`workspaceId`、`accountId`、`serverId` 和 `sourceId` 是路由标识，不是凭证。客户端提供的 role、ownerId 或 entitlement 不能直接作为授权事实。

## 6. Kit 与数据所有权

Kit 只能通过公开 Service/Event 与其他 Kit 协作，不读取其他 Kit 的内部表。共享 PostgreSQL 不代表共享数据所有权。

- 公共 Service 不接受另一 Kit 的 transaction handle；
- 跨 Kit 原子需求先重新评估数据归属；
- 跨 Kit 流程使用幂等调用、部分成功状态、补偿或 outbox；
- migration 具有 owner、稳定 ID、内容 hash 和显式顺序；
- 移除 Kit 不自动删除数据，永久清除需要可审计操作。

这些规则同时减少 confused deputy、越权查询和升级时的隐式数据破坏。

## 7. 编译与供应链

Compiler 在执行产品 entry 前校验：

- package identity、exports 和声明依赖；
- public/internal、Module 与 target import 边界；
- symlink、相对路径和 package export 不越过 owner/root；
- Graph 与 Registry `assemblyId` 一致；
- package manager lockfile 与 `blankspace.lock` 一致；
- 未启用 Kit 和 server implementation 不进入 Web bundle trace。

Phase 1 的依赖、构建、发布、SBOM、provenance、install script 和撤销规则见[软件供应链政策](supply-chain.md)。第三方 Kit 的额外签名、发布者信任和运行权限仍属于后续供应链 RFC；完成前官方支持范围只包含政策记录的受审查 package/version。

## 8. Runtime 与拒绝服务

Runtime 的 register 阶段无 I/O，factory 不获取需关闭资源，start 失败先由入口回收部分资源。Event 只在 ready 后接受发布，嵌套 dispatch 有深度上限，停止时拒绝新事件并在 deadline 内排空活动 handler。

Host adapter 还必须限制：

- HTTP body、上传、分页、查询复杂度和并发请求；
- 登录、验证码、邀请、导出和高成本操作的速率；
- handler、外部调用、关闭和后台任务的 deadline；
- 队列长度、重试次数和退避；
- 日志、临时文件、数据库连接和内存用量。

超过限制应返回稳定 diagnostic/HTTP 错误并保留服务可用性，不能无限缓存或无界重试。

## 9. Event 与外部输入

Event schema 在发布前验证，handler 不信任 payload 中的权限或租户声明。Event envelope 的 correlation/causation 字段用于追踪，不授予权限。

进程内 Event 是 best-effort，不保证可靠投递。需要可靠副作用时由数据 owner 在业务事务内写 outbox；consumer 依据稳定 eventInstanceId 实现幂等。Webhook、消息队列和同步 transport 都属于外部输入，必须验证签名、时效、防重放和来源作用域。

## 10. Web 基线

Reference Web 至少需要：

- 安全 cookie 属性、session rotation、CSRF 防护和明确 CORS allowlist；
- 输出编码、内容安全策略和受控 HTML/URL 处理；
- 服务端权限校验，不依赖隐藏按钮；
- 上传类型、大小、文件名和存储 key 校验；
- 统一错误响应，生产环境不暴露 stack、SQL 或供应商响应；
- 依赖、构建产物和 source map 的发布策略。

具体认证方案由 Identity Kit RFC/实现定义；Foundation 只要求 host 和 Contract 能执行这些控制。

### 10.1 未来 Client Runtime 边界

RFC-0015 的 Client Runtime 在进入 official 或被产品批准用于生产前，必须扩展本威胁模型并通过各自安全 fixtures：

- Electron renderer 保持 context isolation 与 sandbox，不启用任意 Node integration；preload 只暴露最小 typed capabilities，并验证 IPC sender 与输入；
- Capacitor WebView 只加载受信任打包内容，native plugins 使用 allowlist、最小权限和 schema 校验，不暴露通用 native invoke；
- SwiftUI/Compose Runtime 使用 Keychain/Keystore 等平台安全存储，不把 session、密钥或敏感数据放入普通偏好设置；
- deep link、文件、分享、push、剪贴板和外部 URL 都按不可信输入处理；
- 客户端签名、entitlements/permissions、自动更新或商店发布证据进入 Runtime release gate；
- 非 official Runtime 默认不受信任，`verified` 只表示通过声明的 compatibility conformance，不等于安全审计；生产使用需要显式 allowlist 和独立来源、权限及供应链审查。

一个 client 的安全通过不能推导另一个 Runtime 安全；Web/Electron 共享 React renderer 也不共享 host 权限边界。

## 11. AI 与自动化权限

AI 使用与人类相同的 schema、CLI 和边界检查。项目根 `AGENTS.md` 是上下文入口，不是安全沙箱。

默认可修改产品拥有区域和测试；不得直接修改 generated 产物、生产 secret、已执行 migration、发布凭据或兼容性结论。package/config/codemod change set 必须可审查。AI 不能确认 Public Override 的人工视觉检查，也不能执行生产 migration。

## 12. Local-first 扩展要求

Phase 2～4 必须补充：设备密钥与本地加密、数据库文件权限、锁屏与退出登录、本地导出、离线授权窗口、权限撤销、同步重放、恶意或损坏 change、配额耗尽、附件完整性和 quarantine 数据保留策略。

Local-first 不能把“数据在本地”当作自动安全，也不能让旧离线客户端永久绕过服务端权限变化。

## 13. 安全验证

每个 release gate 至少覆盖：

- 跨租户 Account/Workspace/resource ID 组合；
- server SecretRef 流向 Web/shared 和日志泄漏；
- internal、symlink、dynamic import 与 package export 越界；
- Graph/Registry/lock 篡改；
- session 错配、权限撤销和请求重放；
- 超大输入、慢 handler、队列堆积和关闭超时；
- migration 重复、内容变化和并发 runner；
- 升级计划输入变化与恢复失败。

发现安全问题时记录受影响资产、信任边界、攻击前提、可观察结果和回归 fixture。只修补表面输入而不补边界测试，不算完成。

## 14. 尚待决策

以下事项的 owner、触发时点、产物和阻断范围统一登记在[决策与门禁台账](decision-backlog.md)的 DEC-008～DEC-011、DEC-012E/C/I/A 与 DEC-013；本节保留安全范围，不另维护状态。

- Identity Kit 的 Phase 1 password/session 基线已由 RFC-0014 提出；MFA、passkey、外部 IdP 和离线身份仍待决策；
- 第三方 Kit 与 External Plugin 的签名和沙箱；
- Desktop/Mobile 的密钥存储、更新签名和系统权限；
- Local-first 数据加密、密钥恢复和设备撤销；
- SaaS 部署的备份保留、区域和合规配置。

这些项目在进入对应实现阶段前必须形成 RFC 或明确的产品策略。

## 15. 参考基线

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)：安全开发活动和证据管理的上层框架；
- [OWASP Secure Product Design Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Product_Design_Cheat_Sheet.html)：信任边界、最小权限和纵深防御；
- [OWASP Software Supply Chain Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html)：依赖、构建和交付链风险；
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)：安全事件、日志完整性和敏感字段排除。

这些资料提供基线，不自动使 Blankspace 或使用它构建的产品符合任何认证、法律或行业要求。产品团队仍需根据数据类型、地区和业务选择适用控制。
