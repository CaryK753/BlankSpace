# Platform Operations 与持续交付

## 1. 定位

现代 SaaS 不能止于“应用能启动”。Blankspace 还需要让产品团队安全地发现更新、验证产物、迁移数据、渐进发布、观察健康、回滚、恢复数据并响应事故。

这些能力分属三个平面：

```text
Product Runtime
健康 / 版本 / 诊断 / 优雅关闭 / migration compatibility
        │
        ▼
Deployment Plane
desired state / image policy / rollout / traffic / rollback / client distribution
        │
        ▼
Operations Plane
telemetry / alert / status / incident / backup / secrets / certificates / capacity
```

Deployment/Operations Plane 在应用进程之外运行，不是普通 Optional Kit。应用不能在进程内拉取镜像并替换自己，也不能拿到集群管理员、registry 或签名根权限。Blankspace 提供标准 contracts、参考 deployment profiles、检查器和 evidence；Kubernetes、GitOps controller、云平台或用户已有系统执行实际控制。

## 2. “自动且无感更新”的准确含义

Blankspace 将目标定义为：**自动发现、受策略控制、对正常请求无可见中断的渐进发布**，而不是看到 `latest` 就立即重启全部实例。

完整流水线：

```text
registry discovery
→ channel/version policy
→ digest + signature + provenance + SBOM + compatibility verify
→ 生成不可变 ReleaseCandidate
→ staging/preflight + migration plan
→ canary/blue-green/rolling rollout
→ readiness + synthetic + SLO analysis
→ promote 或自动停止/应用回滚
→ 写入发布审计与状态页
```

“无可见中断”必须满足：至少两个可用副本或等价双环境、readiness gate、连接排空、兼容数据库变更、容量余量和客户端/服务端协议重叠。单实例重启、破坏性 migration、外部依赖故障和有状态主节点切换不能被文档宣称为零停机；工具应报告具体阻断原因。

## 3. 镜像发现与更新策略

### 3.1 发现不等于部署

Image watcher 读取 registry metadata，只产生候选：

- 允许的 registry/repository；
- stable/beta/nightly 或产品自定义 channel；
- exact/semver/calver/regex policy；
- 当前 digest、候选 digest、发布时间和 EOL；
- signature/provenance/SBOM/漏洞状态；
- compatibility manifest 和 migration 风险。

生产 desired state 固定 OCI digest。浮动 tag 可以用于发现，但不能成为最终部署 identity；同一 tag 指向新 digest 时必须视为新候选并重新验证。

Flux 等 GitOps 工具可扫描 registry、按策略修改 Git 中的镜像引用并留下提交历史。Blankspace 的 reference adapter 可以生成相应声明，但不把 Flux 写入 Foundation，也允许 Argo CD、平台原生 controller 或用户 CI/CD 实现相同 Contract。

### 3.2 自动化等级

| 等级 | 行为 | 推荐环境 |
| --- | --- | --- |
| `notify` | 发现、验证、生成报告，不部署 | production 默认起点 |
| `staging-auto` | 自动部署 staging，等待 production 审批 | 一般 SaaS 默认 |
| `patch-auto` | 合格 patch 自动 canary，异常自动停止/回退 | 已有成熟 SLO/evidence 后 |
| `channel-auto` | channel 内自动发布 | preview/internal 或充分成熟系统 |

Major、破坏性 migration、权限扩大、license 改变、未知 compatibility、签名或 provenance 不通过时不能自动推进。所谓自动更新必须可以暂停、冻结维护窗口、跳过版本和执行紧急 denylist。

## 4. Release Contract

ReleaseCandidate 的上游构建图、各客户端签名与商店状态由[多产物 CI/CD](ci-cd.md)定义；本文从已形成不可变候选之后开始负责部署、晋级、回滚和运行 evidence。

每次发布生成不可变记录。下列 TypeScript 仅为阅读投影；字段权威来源是 proposed [`release-candidate-v1.schema.json`](schemas/proposed/release/release-candidate-v1.schema.json)：

```ts
interface ReleaseCandidateV1 {
  id: string;
  productGraphHash: string;
  sourceRevision: string;
  inputHash: string;
  artifacts: Array<{
    target: string;
    uri: string;
    unsigned: { uri: string; digest: string };
    distributed: { uri: string; digest: string };
    evidence: Array<{ kind: string; uri: string; digest: string; subjectDigest: string }>;
  }>;
  compatibilityManifest: string;
  migrationPlan?: string;
  rolloutPolicy: string;
  rollbackTarget: string;
  expiresAt: string;
}
```

Release Controller 必须拒绝 mutable artifact、证据输入 hash 不匹配、候选过期、目标环境不匹配、缺失 rollback target 或 ProductionReport 失效。Artifact promotion 在环境间复用相同 digest，不为 production 重新构建。

## 5. 渐进发布与流量控制

支持能力而非绑定编排器：

| capability | 最小语义 |
| --- | --- |
| `rollout.rolling` | max unavailable/surge、progress deadline、pause/resume |
| `rollout.canary` | step、traffic/replica weight、analysis、promotion |
| `rollout.blue-green` | preview、active/preview service、cutover、abort |
| `traffic.drain` | readiness false、pre-stop、request/WebSocket/worker drain deadline |
| `rollout.analysis` | query、window、threshold、missing-data policy、result evidence |

推荐路径是 preview/staging → 小流量 canary → 分阶段扩流 → 全量。分析同时使用 readiness、错误率、延迟、关键业务 synthetic、队列积压和产品 SLI，不能只看“容器还活着”。低流量环境必须定义缺少样本时等待、人工确认或失败关闭，不能把无数据当作成功。

Kubernetes Deployment 能执行 rolling update、暂停和回滚，但 `ProgressDeadlineExceeded` 主要报告状态，不会自动替产品做安全回滚；更高层 controller 才能结合指标采取动作。因此 Blankspace 将 rollout execution 与 analysis/rollback policy 分开建模。

## 6. 回滚与恢复

回滚分为四类，不能用一个按钮混淆：

| 类型 | 目标 | 自动条件 |
| --- | --- | --- |
| traffic rollback | 流量切回仍在运行的旧版本 | blue-green/canary 旧版本健康 |
| application rollback | 重新部署旧 digest/config | 数据和协议仍向后兼容 |
| configuration rollback | 恢复上一已审查配置版本 | secret/version 引用仍有效 |
| data recovery | forward-fix、PITR 或备份恢复 | 永不由一般 rollout controller 自动决定 |

自动回滚只能操作 deployment/config，并且 compatibility manifest 明确旧应用可读取当前 schema/数据。已经执行的 migration、发送的邮件、支付、webhook 和外部副作用不会因镜像回滚消失；它们需要 forward-fix、reconciliation 或受审批的数据恢复。

回滚成功条件不是“旧 Pod 已启动”，而是旧版本 ready、synthetic/SLI 恢复、workers 状态明确、用户写入没有进入分叉状态且事故记录已经创建。回滚失败必须升级为 incident，不可循环重试版本切换。

## 7. Web、Desktop 与 Mobile 更新

不同客户端不共享同一更新机制：

### Web

- HTML/bootstrap 使用短缓存或版本感知策略；hash assets 可长期 immutable cache；
- 新旧 API 保持协议重叠；Service Worker 不得永久固定不兼容 shell；
- 发现新版本时安全刷新，编辑/上传等未提交状态必须先保存或提示；
- 可紧急停用有风险版本，但不能远程执行未签名代码。

### Electron/Desktop

- 使用签名 update manifest 与签名安装包；channel、分阶段发布和最低支持版本显式配置；
- 下载、校验、安装和重启是不同状态，支持断点、失败恢复和用户维护窗口；
- 强制安全更新必须有截止日期、数据兼容和离线用户策略；
- 更新服务只发布元数据/产物，客户端仍验证签名、platform、architecture 和版本单调性。

### iOS/Android

- 二进制更新遵循 App Store/Google Play 等平台分发；Blankspace 不绕过商店静默安装；
- 服务端 capability discovery、minimum-supported、recommended version 和 feature flag 可控制兼容性；
- push notification 可以通知用户更新，但不能替代商店审核和签名；
- CodePush/动态代码等能力必须按平台政策独立审查，不能作为通用默认。

统一的 Update Service 只管理 release channel、版本兼容、公告、最低版本、下载元数据和 rollout 状态；每个平台 renderer/host 执行自己的安全安装流程。

## 8. 服务状态与健康模型

### 8.1 实例健康

应用公开不含敏感信息的：

- `/livez`：进程是否需要重启；
- `/readyz`：是否可以接收新流量；
- `/startupz`：启动是否在预算内推进；
- `/version`：公开 release ID、contract/protocol version，不泄漏依赖或 secret。

详细 dependency state 进入受保护的 operations API。每项状态包含 stable ID、required/optional、`healthy | degraded | unavailable | unknown`、最后成功时间、观测时效和 diagnostic code。

### 8.2 服务级状态

Service Status Aggregator 聚合实例、区域、数据库、队列、对象存储、身份、支付、邮件和第三方依赖，产生：

- internal service/region/dependency map；
- SLI/SLO 与 error budget；
- synthetic journeys；
- customer-facing component status；
- maintenance、incident 和 postmortem references。

公共状态页只发布经过映射的组件和影响，不暴露内部拓扑、租户或攻击面。组件可以 degraded 而整个产品仍 available；状态不能只由人工文本决定，也不能把单次探测失败立即升级为全面事故。

## 9. 日志、指标、追踪与事件

Blankspace 应默认提供 OpenTelemetry instrumentation profile，并允许 Loki/OpenSearch/云日志、Prometheus-compatible metrics、Tempo/Jaeger/托管 APM 等 sinks。统一的是结构化语义和 redaction，不是存储后端。

必须额外明确：

- 日志 stdout/stderr 或平台 transport，不写入容器临时磁盘作为唯一副本；
- level、sampling、retention、region 和 PII allowlist 可按类别配置；
- correlation 跨 HTTP、job、event、webhook 和 external call 传播；
- log/trace sink 故障不能无限阻塞业务线程；安全审计使用独立可靠路径；
- telemetry pipeline 自身有 dropped、queue、export latency 和 last-success 指标；
- 支持动态提高特定 service/correlation 的日志级别，具备时限、授权和审计，禁止全局长期 debug。

`blankspace ops logs`、`status`、`trace` 是目标聚合命令，不意味着 Blankspace 自建日志数据库。它们通过 deployment adapter 查询用户选择的 backend，并输出稳定 envelope。

## 10. 告警、值班与事故

监控没有可执行响应就不构成运维能力。Production profile 必须定义：

- symptom-based alerts、SLO burn-rate、告警窗口和去重；
- owner、severity、值班 route、ack/escalation 和通知失败 fallback；
- 每个 page 的 runbook、dashboard、最近变更和 rollback candidate；
- maintenance/silence 的 owner、范围、到期时间与审计；
- incident commander、沟通、状态页、时间线和 postmortem；
- 定期 synthetic、restore、rollback、secret/certificate rotation 与值班演练。

自动 rollback 只适合“新 release 与回归高度相关、旧版本兼容、信号可靠”的情形。数据库不可用、证书过期、区域故障或外部支付异常可能需要 failover/降级而非回滚应用。

## 11. 第二轮缺口清单

除更新、日志和状态外，完整 SaaS 平台还需要以下能力：

| 领域 | 必需能力 | 参考实现候选 |
| --- | --- | --- |
| Infrastructure as Code | environment/region/network/database/object-store/identity desired state、plan/apply evidence | OpenTofu/Terraform/Pulumi、云原生声明 |
| GitOps / drift | desired/actual diff、approved reconciliation、manual drift alert | Flux、Argo CD 等 |
| Secret/KMS | workload identity、secret version、rotation、revocation、audit | Vault、External Secrets、云 secret manager/KMS |
| DNS/TLS | domain ownership、certificate issuance/renewal、expiry/CAA/DNS monitoring | cert-manager、ACME、DNS provider |
| Backup/DR | DB PITR、object/versioning、cluster config、cross-region copy、restore rehearsal | 数据库原生工具、Velero 等 |
| Capacity/autoscaling | requests/limits、HPA/queue scaling、quota、connection budget、load/shedding | Kubernetes/cloud autoscaling、KEDA 等 |
| Edge/security | ingress、WAF、DDoS、rate limit、bot/abuse、egress policy | cloud/edge provider、自托管 gateway |
| Vulnerability/patch | dependency/image/IaC scan、runtime advisory、emergency channel、EOL | OSV/Trivy/Grype 等候选 |
| Cost/quota | cost allocation、budget alert、tenant/provider quota、anomaly | OpenCost/云成本工具 |
| Data operations | retention/delete/export、reindex/backfill、schema/data repair、legal hold | Kit-owned jobs + audited operations |
| Email/domain health | SPF/DKIM/DMARC、bounce/complaint/suppression、provider reputation | 邮件 provider + DNS diagnostics |
| Webhook/API operations | signing keys、replay、DLQ、delivery log、rate/quota、consumer compatibility | RFC-0023 inbox/outbox 扩展 |
| Support control plane | tenant lookup、impersonation/JIT、data export、account recovery、audit | Product-owned admin UI + Authorization |
| Quality/resilience | load/soak/chaos/failover tests、synthetic journeys、dependency fault injection | k6、Playwright、Chaos Mesh/Litmus 等候选 |
| Data pipeline | scheduled import/export、CDC、warehouse sink、lineage、replay | Debezium/Airbyte/Temporal 等按需 |
| Compliance evidence | asset/data inventory、access review、change record、policy/evidence expiry | 外部 GRC 或机器 evidence registry |

这些不是全部进入 Foundation。IaC、GitOps、secret、certificate、backup 和 observability 属于 deployment profiles；数据操作和 webhook 可由相应 Kit 提供；支持后台和产品政策属于 Product Overlay；具体云资源和 on-call 仍由部署团队负责。

## 12. Reference Deployment Profiles

Blankspace 应提供可选、可替换的 profiles，而不是假设所有用户都有 Kubernetes：

| Profile | 目标 | 更新/回滚能力 |
| --- | --- | --- |
| `single-host` | 小型自托管/验证环境 | Compose/systemd、维护窗口、健康检查、上一 digest 回退；不声称 HA |
| `managed-container` | Cloud Run/ECS/Fly/Render 等 | 使用平台 revision、traffic split、health 与 rollback capability |
| `kubernetes` | 需要可移植控制面的 SaaS | GitOps、rolling/canary/blue-green、autoscaling、secret/TLS/backup adapters |
| `custom` | 企业已有平台 | 实现 Deployment Adapter conformance |

所有 profile 输出相同的 Release/Deployment/Operations evidence envelope，但 capability 可以不同。`single-host` 缺少零停机条件时必须明确显示，不用第二套隐藏容器临时冒充高可用。

## 13. 目标 CLI

```bash
blankspace release discover --channel stable --json
blankspace release verify <candidate> --json
blankspace deploy plan <candidate> --environment staging
blankspace deploy rollout <plan> --watch
blankspace deploy promote <rollout>
blankspace deploy rollback <rollout>
blankspace ops status --environment production --json
blankspace ops logs --service api --since 30m
blankspace ops incidents create --from-alert <id>
blankspace restore verify --deployment production
```

当前这些命令尚未实现。CLI 默认只读；rollout、promote、rollback 和 restore 是不同权限，production 变更要求明确 environment、immutable plan、操作者身份和审计记录。

## 14. 官方依据

Kubernetes 官方文档说明 Deployment 可渐进替换 Pod、暂停、恢复和回滚，readiness 失败会停止向实例发送流量；它也明确 stalled deployment 只产生状态，更高层系统才可能据此自动回滚。[Kubernetes Rolling Update](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/)、[Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)、[Probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/)

Flux 官方 image automation 能扫描 registry、按策略选择 tag、更新 Git manifest 并触发 rollout；Sigstore Cosign 验证会校验签名身份及镜像 digest。这支持“发现 → 可审计 desired state → 完整性验证 → 发布”，而不是运行容器直接拉取 `latest`。[Flux Image Automation](https://fluxcd.io/flux/guides/image-update/)、[Cosign Verify](https://docs.sigstore.dev/cosign/verifying/verify/)

cert-manager 可以在证书过期前自动续期；Velero 可备份/恢复 Kubernetes resources 和 persistent volumes。但平台资源备份不能替代 PostgreSQL PITR、对象一致性和产品不变量恢复测试。[cert-manager](https://cert-manager.io/docs/usage/certificate/)、[Velero](https://velero.io/docs/main/)

## 15. 当前状态

本文是目标架构。仓库当前没有 Deployment Adapter、Release Controller、Update Service、operations backend 或 reference deployment profile，不能据此宣称已具备自动更新、零停机、自动回滚或生产运维能力。
