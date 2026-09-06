# RFC-0026：Operations Plane 与渐进交付

## 状态

Proposed

## 背景

Blankspace 已定义应用生命周期、升级计划和基础生产门禁，但还没有冻结服务器镜像发现、持续交付、健康分析、回滚和客户端更新的公共边界。如果把这些行为塞进应用 Kit，应用将拥有更新自身和集群的高权限；如果完全交给部署文档，不同平台又无法产生统一诊断与证据。

## 决策

### 1. 建立外部 Operations Plane

系统分为：

- Product Runtime：提供版本、health、diagnostics、migration compatibility 和 drain；
- Deployment Plane：管理 desired state、artifact、traffic、rollout、promotion 和 deployment rollback；
- Operations Plane：管理 telemetry、alerts、status、incident、backup、secret/certificate 和 capacity evidence。

后两者是 host/deployment capability，不是进程内 Optional Kit。Product Runtime 不持有 registry write、cluster admin、signing root 或生产 restore 权限。

### 2. 不可变 Release Candidate

候选必须绑定 source revision、Product Graph hash、每目标 artifact digest、signature、provenance、SBOM、compatibility manifest、rollout policy、rollback target 和 expiry。环境 promotion 使用相同 artifact digest，禁止重新构建。

浮动 tag 只用于发现。部署 desired state 必须固定 digest；tag 指向新 digest 时作为新候选重新验证。

### 3. 更新状态机

```text
discovered
→ verified
→ planned
→ deploying
→ analyzing
→ promoted
```

任何阶段可以进入 `rejected | paused | aborted | rollback-required | failed`。状态转换保存 actor/controller、输入 hash、原因、时间和 evidence。重复请求按 candidate/plan ID 幂等，不允许两个 production rollout 无协调并发。

自动化等级为 notify、staging-auto、patch-auto 和 channel-auto。Major、破坏性 migration、签名/provenance 失败、许可证变化、未知 compatibility 或权限扩大不能自动进入 production。

### 4. 渐进交付 Contract

Deployment Adapter 按能力声明 rolling、canary、blue-green、traffic split、pause/resume、analysis 与 rollback。公共 Contract 不镜像 Kubernetes/云平台 API，只要求：

- immutable desired revision；
- step 与 progress deadline；
- min availability/capacity；
- readiness/drain；
- analysis inputs、window、threshold 和 missing-data policy；
- promotion/abort/rollback receipt；
- current/previous known-good revision。

缺少 HA、traffic control 或可靠 analysis 的 adapter 不能声明 zero-visible-downtime 或 automatic rollback。

### 5. 健康与分析

Product Runtime 提供 startup/liveness/readiness 和受保护 dependency diagnostics。Rollout 分析至少组合基础健康、request SLI、关键 synthetic、worker/queue 状态与 schema compatibility。无样本不是成功；策略必须选择等待、人工确认或失败关闭。

可选 dependency 降级不能默认使整个应用 not-ready；必需依赖、数据一致性或授权安全边界失效时必须拒绝相关流量或全局 not-ready。

### 6. 回滚边界

自动回滚只处理 traffic、application artifact 和兼容 configuration。满足以下全部条件才允许：

1. previous revision 仍受支持且健康；
2. compatibility manifest 证明旧版本可读取当前数据；
3. migration/外部副作用不要求 data recovery；
4. 回滚不会产生两个 writer split-brain；
5. rollback receipt、post-check 和 incident escalation 已配置。

PITR、备份恢复、不可逆 migration 和外部业务副作用永远不由一般 rollout controller 自动执行。

### 7. 客户端更新分流

Update Service 统一 channel、release metadata、minimum/recommended version、compatibility 和公告，不统一安装机制：

- Web 使用原子部署、cache/version 与 reload safety；
- Desktop 使用平台签名包、update manifest、分阶段下载/安装；
- iOS/Android 使用商店/企业分发和服务端 compatibility policy。

Push 只能通知或触发受平台允许的检查，不能绕过签名、用户政策或商店静默执行二进制。

### 8. Reference Profiles 与 adapters

提供 single-host、managed-container、kubernetes 和 custom profiles。每个 profile 运行 Deployment Adapter conformance 并明确 unsupported。Kubernetes profile 可参考 GitOps、progressive delivery、certificate/secret/backup controllers，但 Foundation 不依赖具体实现。

### 9. Operations evidence

ProductionReport 增加：

- release candidate 与部署 plan hash；
- artifact signature/provenance/SBOM verification；
- health、drain、rollout、rollback rehearsal；
- telemetry pipeline、SLO/alerts/runbook/on-call route；
- backup/restore、secret/certificate rotation；
- last-known-good、incident/status integration；
- evidence freshness 和 owner。

证据过期、部署输入变化或上次演练失败会撤销对应生产资格。

## 验收条件

1. 更新发现不会直接改变 production desired state；
2. 未签名、digest 变化、证据过期和不兼容 migration 被阻断；
3. staging 自动发布和 production 审批使用同一 artifact；
4. canary 异常自动停止，兼容时回滚并验证 SLI 恢复；
5. 不兼容数据状态只产生 rollback-required/incident，不自动 PITR；
6. 单实例 profile 明确拒绝 zero-visible-downtime 声明；
7. Web、Desktop、iOS、Android 分别通过更新状态和签名/平台 fixtures；
8. 日志、健康、状态、告警和事故能够通过同一 release/correlation identity 关联；
9. deployment adapter 更换不修改 Product Overlay 业务代码。

## 非目标

- 在 Foundation 内实现 Kubernetes、GitOps、日志数据库或值班平台；
- 保证所有产品和 migration 零停机；
- 运行容器自行更新镜像；
- 自动批准 production major、权限扩大或数据恢复；
- 绕过 App Store/Google Play 的平台分发规则；
- 用应用回滚替代备份恢复和 reconciliation。

## 重审触发条件

目标平台无法提供不可变 revision、渐进流量或 health evidence，客户端平台更新政策变化，或真实产品需要跨区域 active-active 发布时重审。
