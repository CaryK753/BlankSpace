# 部署与运行责任

## 1. 状态与目标

本文定义 Blankspace 产品在开发、构建、部署和运行时的责任边界。当前没有可部署的 Blankspace 应用，文中的命令是 Phase 1 目标接口。

当前生产部署结论是 **No-Go**：Identity、安全、迁移、发布门禁及可运行实现均未完成。本文只能用于设计和未来实现验收，不能作为当前上线手册。

供应链发布门禁见[软件供应链政策](supply-chain.md)。受审查依赖、SBOM、provenance 和撤销流程未落地前同样保持 No-Go。

镜像发现、渐进发布、客户端更新、回滚、服务状态、告警和第二轮生产能力清单见 [Platform Operations 与持续交付](platform-operations.md)及 [RFC-0026](rfcs/0026-operations-plane-and-progressive-delivery.md)。本页聚焦单个 Product Runtime 和部署团队的基础责任；RFC-0026 进一步定义进程外 Deployment/Operations Plane。

Phase 1 只覆盖 Web、Server 和 remote-only PostgreSQL SaaS。Desktop、Mobile、Local Workspace、复制和多 Server 客户端在后续阶段扩展。

## 2. 环境分层

| 环境 | 用途 | 数据与外部依赖 |
| --- | --- | --- |
| local | 日常开发和快速测试 | 本机或容器 PostgreSQL、测试凭据 |
| test | 自动 fixture 和集成测试 | 隔离数据库、确定性时钟/网络替身 |
| preview | 每个变更的可部署审查环境 | 独立 namespace、非生产数据 |
| staging | 生产前升级和迁移演练 | 接近生产拓扑、脱敏或合成数据 |
| production | 最终用户流量 | 受控 secret、备份、监控和发布审批 |

配置结构在环境间保持一致，值由部署系统提供。环境差异不能通过条件 import 改变 Product Graph 的公共语义；确实不同的 adapter 或 capability 必须进入配置、lock 和兼容报告。

## 3. 构建输入与产物

可复现构建固定：

- source revision；
- Node.js、pnpm 和工具版本；
- package manager lockfile 与 `blankspace.lock`；
- RFC baseline；
- 规范化 Product 配置、manifests 和 schema；
- target 与允许的公开构建配置。

构建输出包括 Web/Server 产物、Product Graph、Executable Registry、版本信息、bundle trace 和 schema/diagnostic 版本。构建过程不能解析生产 secret；secret 仅在 Server 启动时由 host provider 解析。

发布物必须能追溯到上述输入。运行容器不能在启动时重新安装 packages、扫描 Product Modules 或重新选择 Kit provider。

## 4. Server 启动顺序

```text
读取不可变构建元数据
→ 校验环境与 SecretRef
→ 检查 package/blankspace lock identity
→ 初始化 host 拥有的 Secret Provider，并解析必需 SecretRef
→ Runtime register/factory/start（Database Kit 在自己的 start 中打开数据库连接并验证 migration 状态）
→ host 绑定监听地址
→ ready
```

Server 在必需 secret、数据库连接、Graph/Registry、migration 或 Runtime entry 未通过时不得 ready。是否自动执行 migration 由部署策略显式决定；默认生产启动只验证状态，migration 使用独立 job。

Runtime 是业务 entry 和 Kit 资源的唯一生命周期 owner。Database、队列和供应商连接只能由相应 entry 的 `start` 打开。Secret Provider 是 host capability；若其自身持有连接，host 在 Runtime 完成反序 stop 后关闭它。任何 Runtime 启动失败都沿同一顺序清理，不能在 Runtime 外预先打开无人负责的业务连接。

监听端口应尽量晚于关键预检。若 host 必须先绑定端口，readiness 在完整启动前保持失败，并拒绝业务请求。

## 5. 健康检查

| 检查 | 回答的问题 | 失败行为 |
| --- | --- | --- |
| liveness | 进程事件循环和 host 是否仍可响应 | 持续失败可由平台重启 |
| readiness | 当前实例能否接收新业务请求 | 从负载均衡摘除，不立即杀进程 |
| startup | 冷启动/migration 检查是否仍在允许窗口 | 超时才判启动失败 |

Liveness 不执行昂贵数据库查询，也不因单个下游短暂故障触发重启风暴。Readiness 可以反映必需依赖和 Runtime 状态；可选 adapter 降级进入 diagnostics 与产品状态，不必让整个实例退出。

健康端点不得泄漏版本约束、连接串、secret 名称、stack 或租户数据。详细诊断只进入受保护的运维接口。

## 6. 配置与 secret

- 非秘密配置进入版本化部署清单或环境配置；
- server secret 由 secret manager 注入并通过 SecretRef 名称解析；
- 生产 secret 不写入镜像、仓库、Graph、日志或升级计划；
- secret rotation 应支持重启切换；需要无重启轮换的 adapter 必须显式声明能力；
- 缺失、空值、格式错误和作用域错误在接收流量前失败；
- 客户端公开配置在构建/部署时单独列出，按公开信息对待。

`.env` 只用于本地开发且不提交真实值；`.env.example` 记录名称、用途和是否必需，不提供默认生产凭据。

生产部署必须为每个必需 SecretRef 保存受审查的控制记录：owner、consumer workload、环境、secret manager 路径、允许操作、当前版本、轮换周期、撤销与泄漏响应 runbook，以及最近一次演练证据。工作负载身份遵循最小权限，只能读取本环境、本 workload 明确声明的 secret；所有读取和管理操作进入 secret manager 审计。轮换采用版本化新值，先验证依赖使用新版本，再撤销旧版本；不能把“覆盖同名值”当作完整撤销。缺失值、已撤销版本、越权读取或不允许的旧版本必须阻止 readiness。泄漏响应至少能定位消费者、立即轮换、撤销旧值并验证所有依赖恢复。

## 7. 数据库与 migration

每个 Kit/Module 拥有独立 migration namespace。生产流程：

```text
备份与恢复点验证
→ 获取全局 advisory lock
→ 校验 pending migration ID/hash/order
→ 执行显式 migration job
→ 验证 schema 与数据不变量
→ 部署兼容应用版本
```

实际顺序依据 compatibility manifest。应用发布与 migration 不能假定同时发生；需要 expand/contract、双读或双写时必须写入升级计划。

失败默认停止后续 migration。已执行内容不得修改，package downgrade 不自动回滚数据，移除 Kit 不自动删除 schema。恢复演练必须验证备份可读，而不只检查备份任务返回成功。

单事务 migration 失败后回滚事务。非事务 migration 必须是 descriptor 声明的 `checkpointed` 模式，持久记录处理范围并支持幂等重入。失败时 owner 按已审查 runbook 选择：从检查点 forward-fix、恢复备份，或保持阻塞等待人工处理。工具不自动选择 PITR；PITR 可能丢失恢复点后的其他租户写入，必须由产品运维负责人审批。应用回退只在 descriptor 声明当前部分状态仍兼容旧版本时允许。

每个生产 migration 的审批证据包括 descriptor/content hash、执行 owner、备份恢复验证、预计数据量、检查点策略、兼容应用版本、恢复决策人和 runbook hash。缺少任一项时部署门禁失败。

## 8. 日志、指标与追踪

结构化日志至少包含：

- timestamp、level、service/version、runtime target；
- requestId、correlationId、eventInstanceId；
- serverId、accountId、workspaceRef 等经过策略允许的作用域 ID；
- 稳定 diagnostic code 和 owner/entry/handler ID；
- latency、result category 和 retry count。

禁止记录 secret、session token、Authorization header、完整支付/个人数据、数据库连接串和未经限制的请求体。字段级 allowlist 优先于事后字符串脱敏。

指标覆盖请求率/错误率/延迟、连接池、队列、Event handler、migration、Runtime start/stop、资源使用和 adapter 外部调用。高基数字段不进入 metric labels；详细 identity 留在受控 trace/log。

### 日志与安全审计策略

产品/部署团队在每个环境冻结机器可审查的日志策略：事件类别与字段 allowlist、读取角色、break-glass 流程、保留与删除期限、存储区域、传输加密、完整性保护、导出目的地、查询可用性目标，以及 sink 不可用时的背压/降级/停机选择。普通业务日志可以按产品可用性策略有界丢弃；登录、权限变化、管理员操作、secret 管理和 migration 等安全审计事件不得静默丢失。若可靠审计 sink 无法在有界缓冲内恢复，安全敏感管理操作必须失败关闭，普通请求则按已冻结策略降级并产生可观测告警。

审计存储使用追加写或等效防篡改控制，限制删除和修改权限，并记录查询、导出、保留策略变更及 break-glass 访问。保留期限依据数据分类、法规和取证需求由产品决定，Blankspace 不提供一个普适天数。发布证据必须证明允许角色可在目标时间内按 correlationId、actor 和 target 检索事件，同时未授权角色不能读取或导出审计数据。

## 9. 关闭与发布

收到终止信号后：

```text
readiness = false
→ 停止接收新请求和 Event publish
→ 在 deadline 内排空活动请求/dispatch
→ Runtime 反序 stop
→ 关闭 host 与基础设施连接
→ 退出并报告未完成资源
```

重复 signal 和重复 stop 必须幂等。达到 deadline 时记录未完成 owner，按平台策略终止；不能报告 clean shutdown。滚动发布的 termination grace period 必须大于应用关闭 deadline 和网络摘除传播时间。

应用不得在 Runtime 内轮询 registry 并替换自身镜像。镜像发现、签名/provenance 校验、desired state、traffic shift 和 rollback 由进程外 Deployment Plane 执行。生产镜像固定 digest；`latest` 或其他浮动 tag 只能用于发现候选。所谓无感更新必须证明副本/双环境、readiness、drain、容量和数据兼容条件，不能只证明容器重启成功。

## 10. 故障与降级

依赖分为必需和可选。必需依赖在启动时不可用会阻止 ready；运行中失效时根据数据一致性要求进入 not-ready 或拒绝相关操作。可选 adapter 失效只禁用对应能力，并向产品 UI/diagnostics 暴露明确状态。

重试只用于可判定为暂时且具备幂等性的操作，采用有上限的指数退避与抖动。认证、授权、schema、配置和永久业务错误不重试。熔断与降级是 adapter/host 策略，必须保留原始 diagnostic category。

## 11. 多租户运行

- 每次请求和后台任务携带明确 account/Workspace/resource scope；
- 数据库查询、缓存 key、对象存储 key 和队列消息包含租户边界；
- 管理操作使用独立权限和审计，不复用普通用户路由；
- preview/test 环境不能连接生产数据库或 secret provider；
- 导出、删除、邀请和权限变更记录 actor、target、结果和 correlationId。

租户隔离由 Identity/Workspace/Product Contracts 和数据层共同实现，不能只依赖 Web route middleware。

## 12. 部署门禁

目标发布流程至少运行：

```bash
# 目标命令，当前尚未实现
blankspace check --json
blankspace test --all
blankspace build --all-targets
blankspace migrations verify
blankspace upgrade --verify <plan-path> --json
```

同时校验完整 conformance fixtures、bundle trace、安全回归、数据库兼容、上一版本 Product Overlay 和恢复演练。`test --affected` 只用于本地反馈，不能替代发布全量验证。

发布安全门禁还必须提供两组环境证据：

- 审计 fixture：RFC-0014 要求的认证事件、权限/管理员操作、secret 管理和 migration 事件完整可查，禁止字段确实缺失；未授权查询被拒绝；完整性控制能检测篡改；sink 中断时的缓冲、告警、失败关闭或降级行为与冻结策略一致；
- Secret fixture：生产工作负载身份不能读取其他环境或 workload 的 secret；缺失、撤销和不允许的旧版本阻止 readiness；新旧版本切换、旧值撤销与泄漏应急轮换按 runbook 演练，并验证全部依赖恢复。

任一证据缺失或失败都保持生产发布 No-Go。

## 13. 备份、恢复和灾难演练

产品部署策略必须定义 RPO、RTO、备份频率、保留、加密、区域和访问审计。Blankspace 不提供一个对所有 SaaS 都正确的默认数值。

恢复演练至少覆盖：数据库时间点恢复、对象文件一致性、migration 中断、错误版本回退、secret rotation 和升级计划恢复。演练在隔离环境运行，验证用户可见不变量，而不是只验证服务能启动。

## 14. 责任边界

| 责任 | Blankspace | 产品/部署团队 |
| --- | --- | --- |
| Graph、Registry、生命周期和 diagnostics Contract | 定义与验证 | 使用并监控 |
| 官方 Kit/adapter 的兼容声明 | 发布 | 选择并固定版本 |
| 依赖审查、SBOM、provenance 与撤销清单 | 定义格式并发布官方证据 | 审查产品新增依赖并响应撤销 |
| 产品授权和数据分类 | 提供机制 | 定义政策并测试 |
| 云资源、网络、域名和区域 | 提供参考 adapter/说明 | 配置和运营 |
| secret 值、最小权限和轮换/撤销 | 提供 SecretRef/provider 边界与 fixtures | 管理凭据、访问策略、审计、runbook 和演练证据 |
| 日志与安全审计 | 定义事件/字段边界和验证 fixtures | 冻结访问、保留、完整性、导出与 sink 故障策略并运营 |
| 备份 RPO/RTO 和恢复审批 | 提供 hooks/fixtures | 决定、执行和审计 |
| 生产 migration | 提供 descriptor/verify | 审批和执行 |
| 告警值班与事故响应 | 提供结构化信号 | 建立流程并负责响应 |

## 15. 后续阶段

Desktop/Mobile 需要签名、自动更新、系统权限和本地密钥存储；Local-first 需要本地备份、设备撤销、同步积压和 quarantine 运维；多 Server 客户端需要每 Server 独立 session、协议和故障状态。进入对应阶段前扩展本文及安全模型。

Web、Electron、iOS 和 Android 的更新不能使用同一安装器抽象。统一 Update Service 只管理 channel、版本兼容、公告和 rollout metadata；Web 原子部署、Desktop 签名 updater 与移动商店分发分别由 Client Runtime 实现并验证。

日志字段和敏感信息处理参考 [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)；框架安全开发与供应链证据参考 [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)。
