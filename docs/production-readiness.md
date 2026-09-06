# Production Readiness Gate

## 1. 定位

功能 Phase 与生产资格分离。Phase 1B 能运行 Reference SaaS 不等于可以处理真实客户数据；任何产品进入共享或生产环境前必须通过本 Gate。Blankspace 当前没有可运行框架，因此当前结论仍是 No-Go。

## 2. 基础 SaaS 必需门禁

目标命令 `blankspace verify production --manifest <deployment>` 生成 `ProductionReportV1`：deployment/product/lock hashes、启用 capabilities、每项 `pass | fail | not-applicable`、evidence URI/hash/生成时间、owner、有效期、waiver 和阻断诊断。Tenant/AuthZ、Identity、Database、Supply Chain 与 Operations 核心项不得用普通 waiver 跳过；enabled-only Kit 未启用时才允许 `not-applicable`。证据过期或输入 hash 变化自动失效。该命令与 schema 当前尚未实现。

| Gate | 最小证据 |
| --- | --- |
| Tenant/AuthZ | 明确 isolation root；Service + scoped DAL/RLS；route/DAL 必需负例；cache/search/job 启用时增加负例 |
| API | RFC-0022 contracts、bindings、错误/分页/幂等和兼容 fixtures |
| Identity | session rotation/revocation、多实例一致性、邮件可靠路径、rate-limit 与审计 |
| Reliable effects | RFC-0023 outbox、重复/崩溃/DLQ/tenant fairness 和 worker drain |
| Database | 在线 migration profile、timeout/fencing、备份、恢复和旧应用兼容窗口 |
| Deployment | TLS/ingress、私网数据服务、workload identity、health/readiness、滚动发布、资源限制 |
| Release safety | immutable digest、signature/provenance/SBOM、release candidate、渐进发布、last-known-good、回滚演练与 migration compatibility |
| Observability | SLI/SLO、burn-rate alert、dashboard、runbook、pager/synthetic 演练 |
| Supply chain | lock、依赖审查、SBOM、provenance、签名、撤回和紧急发布 |
| Operations | 特权控制面、MFA/JIT/break-glass、审计、事故响应和恢复演练 |
| Platform lifecycle | image/update detection、certificate/secret rotation、drift、capacity、cost/quota、dependency EOL 与维护窗口 |
| Data governance | inventory、classification、retention、export/delete、legal hold、residency 与 subprocessor |

Files、Search、Billing、AI、local-first 等只有在产品启用时增加对应 Gate；未启用不阻塞基础 remote SaaS。启用 Billing 必须通过 RFC-0024，不能只证明 checkout 页面成功。

ProductionReport 还必须关联 RFC-0026 的 ReleaseCandidate、deployment plan、rollout/analysis receipt 和上一已知健康版本。单实例或不支持流量切换的 profile 可以进入受约束生产，但必须把零停机、自动回滚等能力标为 `not-supported`，不能以 waiver 伪造通过。

## 3. 参考部署

Phase 1C 后必须提供 vendor-neutral 的单区域参考拓扑和至少一个可运行实现：Web/API replicas、PostgreSQL、migration singleton、worker、secret provider、observability sinks、backup job 与 restore environment。Docker Compose 可以用于本地/单机验证，但不能作为 HA 证据；Phase 3 再增加多 Server/自托管 Workspace，不再推迟基础 SaaS 部署闭环。

## 4. Phase 5 关闭方式

Phase 5 不再作为一个无法判定的“大功能阶段”。Files、Jobs、Notifications、Search、Billing、Editor 等各自拥有独立 gate：RFC、reference adapter、机器 schema、失败矩阵、安全审查、迁移/退出路径、上一版本 fixture 和真实产品证据。`blankspace verify kit <id>` 只关闭单 Kit；产品的 production report 汇总它实际启用的 Gates。

## 5. 仍由产品决定

Blankspace 提供结构、检查器和参考值来源，不替产品决定 RPO/RTO、SLO、数据区域、保留期限、合规范围、管理员审批政策和供应商。产品必须在部署 manifest 中冻结这些值，并由明确 owner 评审。
