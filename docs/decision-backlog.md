# 决策与门禁台账

本文集中追踪尚未冻结、尚未实现或需要产品策略的事项。领域文档仍定义技术约束；本页只回答“谁在什么时点产出什么证据，缺失时阻止什么”。项目与 Spike 状态以 [`status/project-status.json`](status/project-status.json) 为准，RFC 完整性以 RFC baseline 为准，结论仍必须有可复现 evidence。

## 状态规则

| 状态 | 含义 |
| --- | --- |
| Blocked | 缺少前置实现、环境或真实需求，当前不能合理冻结 |
| Ready for decision | 输入和 owner 已具备，可以提交 RFC/策略 |
| Draft matrix | 验证范围已起草，工具、fixture 或阈值尚未冻结 |
| Matrix frozen | 输入、命令、成功条件和失败选择已冻结，等待执行 |
| Resolved | 已由 Accepted RFC、冻结策略或通过证据关闭；关闭项移入变更记录 |

角色 owner 必须在对应实施任务开始前映射到具体维护者并写入阶段任务；未完成映射时不能开始执行或标记 Resolved，但不妨碍设计矩阵进入 Draft/Matrix frozen。文档作者不能代替 Security、Legal、Product 或 Release owner 批准决策。

## 当前台账

| ID | 事项 | 当前状态 | 触发时点 | Owner | 必需产物 | 阻断范围 |
| --- | --- | --- | --- | --- | --- | --- |
| DEC-001 | S1 生产 validator 与跨平台 evidence | Blocked | 选定生产 JSONC/schema validator 且跨平台 runner 可用 | Compiler owner | 最终 validator corpus、Windows/Linux/macOS 或批准矩阵、版本、日志和证据 hash | S1 Pass、Phase 1B |
| DEC-002 | S2 resolver 执行矩阵 | Pass | 2026-09-06 三平台 GitHub-hosted runner 完成 | Compiler owner | OS/pnpm/路径矩阵与 resolution trace | 已关闭；保持为 S3 与 Phase 1B 回归门 |
| DEC-003A | S3～S7 工具与 fixture 冻结 | Matrix frozen | S3～S6 已通过；S7 于 2026-09-08 冻结 exact package/image 与 14 场景 | 对应 Compiler/Runtime/Database owner | S3～S7 精确工具、fixture、deadline、diagnostics 与失败选择 | S7 Pass、Phase 1B entry |
| DEC-003B | S8 UI 工具与 fixture 冻结 | Draft matrix | React/UI/浏览器候选可安装且 UI fixture owner 指派 | UI owner | S8 “尚待冻结”所列输入 | S8 Pass、Phase 1C entry |
| DEC-004 | Phase 1 性能预算 | Blocked | S1～S7 Pass 且 benchmark harness 可运行 | Performance owner | 标准环境、原始样本、算法版本、阈值与评审 | Phase 1B exit |
| DEC-005 | Phase 1A 依赖审查基线 | Blocked | 开始保留生产实现依赖 | Security + Build/Release owner | dependency schema/记录、lock/install-script/过期审查 fixtures 与 doctor/CI diagnostics | 受审查依赖基线、公开 release |
| DEC-006 | SC1 发布完整性 | Draft matrix | Phase 1C 发布流水线和 registry 可验证 | Security + Build/Release + Resolver owner | source approval、artifact digest/file manifest、SBOM、compatibility manifest、provenance/签名、撤销、公开 registry、凭据隔离、release/security/conformance evidence | 公开 release |
| DEC-007 | 根许可证 | Ready for decision | 对外协作或分发前 | Repository owner + Legal reviewer | LICENSE、依赖兼容复核、分发策略记录 | 对外复制、修改和发布 |
| DEC-008 | Identity MFA/passkey/外部 IdP | Blocked | 产品需要强身份或企业登录 | Identity + Security + Product owner | 身份扩展 RFC、恢复与降级 fixtures | 对应 Identity 能力 |
| DEC-009 | 离线身份与 Local-first 密钥治理 | Blocked | Phase 2 Local Workspace 开工前 | Identity + Local-first + Security owner | 密钥存储、加密、恢复、设备撤销 RFC | Local-first 发布 |
| DEC-010 | 第三方 Kit 信任 | Blocked | 出现第一个真实第三方 Kit 候选 | Security + Kit owner | publisher、权限、签名、隔离、撤销与事故 RFC | 第三方 Kit stable support |
| DEC-011 | External Plugin 沙箱 | Blocked | 开始设计最终用户动态安装 | Security + Runtime owner | 用户授权、沙箱、故障隔离和动态撤销 RFC | Runtime plugin support |
| DEC-012E | Electron 发布安全 | Blocked | Electron Runtime milestone 开工 | Electron Runtime + Security + Release owner | Electron threat model、密钥存储、entitlements、签名、更新与打包 fixtures/evidence | Electron official |
| DEC-012C | Capacitor 发布安全 | Blocked | Capacitor Runtime milestone 开工 | Capacitor Runtime + Security + Release owner | Capacitor threat model、WebView/bridge 权限、密钥存储、签名、更新与商店 fixtures/evidence | Capacitor official |
| DEC-012I | SwiftUI/iOS 发布安全 | Blocked | SwiftUI Runtime milestone 开工 | Apple Runtime + Security + Release owner | Apple threat model、Keychain、entitlements、签名、更新与 App Store fixtures/evidence | SwiftUI/iOS official |
| DEC-012A | Compose/Android 发布安全 | Blocked | Compose Runtime milestone 开工 | Android Runtime + Security + Release owner | Android threat model、Keystore、permissions、签名、更新与 Play fixtures/evidence | Compose/Android official |
| DEC-013 | SaaS 备份、区域和合规策略 | Blocked | Reference SaaS 准备部署到共享环境 | Product Operations + Security + Legal owner | RPO/RTO、保留、区域、恢复演练与适用控制记录 | 共享/生产部署 |
| DEC-014 | CR1/DS1 多客户端契约冻结 | Draft matrix | 选择对应客户端路线 | Client Runtime/Design System owner | 真实 SwiftPM、Gradle、Electron、Capacitor 与 Renderer corpus | Proposed schema 晋级、对应客户端支持 |
| DEC-015 | E1 Editor Boundary | Draft matrix | Phase 2 Block 文档实现前 | Editor + Local-first + Product owner | RFC-0018 schema、真实 adapter、第二用例、事务/崩溃/升级 evidence | Phase 2 Block 文档、稳定 Editor Kit 候选 |
| DEC-016 | Y1 Sync Protocol V1 | Draft matrix | Phase 4 实现前 | Sync + Data Domain + Security owner | RFC-0019 schema、故障 runner、跨 transport transcript 与恢复 evidence | Phase 4 replicated/sync |
| DEC-017 | N1 Native Storage/Sync | Draft matrix | Phase 2 storage boundary形成后、Phase 4 实现前 | Client Runtime + Local-first + Sync owner | Web/Desktop/一个原生 probe、canonical transcript、ABI/所有权与路线决策 | Phase 4 跨端实现、原生 local-first official |
| DEC-018 | 首批 integration-first adapter 选型 | Draft matrix | 对应 Kit 开始实现前 | Kit + Product + Security/Legal owner | 候选许可证、平台、格式出口、兼容/安全/性能矩阵与 direct integration 对照 | official-reference 支持等级与 preset 默认值 |
| DEC-019 | AuthN/AuthZ official-reference 选型 | Draft matrix | Phase 1B Identity/Authorization 实现前 | Identity + Authorization + Security owner | Better Auth/OpenFGA/SpiceDB/Casbin license、部署、一致性、迁移与安全矩阵 | official adapter 与 starter 模板 |
| DEC-020 | Production Readiness 参数 | Blocked | 首个产品准备处理真实客户数据前，且必须早于数据模型冻结 | Product Ops + Security + Legal owner | isolation root、SLO、RPO/RTO、数据治理、特权控制面、事故与恢复演练 | production-ready 声明 |
| DEC-021 | Capability Catalog 首批 reference adapters | Draft matrix | 每个领域 Kit 开始实现前 | 对应 Kit + Product + Security/Legal owner | selection record、delivery/license/support/portability 元数据、领域 conformance 与退出演练 | official-reference、verified 与 preset 纳入 |
| DEC-022 | Platform Operations reference profiles | Draft matrix | Phase 1C 完成后、首个共享生产部署前 | Platform + Release + SRE + Security owner | ReleaseCandidate schema、single-host/managed-container/kubernetes adapters、rollout/rollback/update/status fixtures | 自动更新/回滚声明、production profile |
| DEC-023 | Production SLO、值班与事故策略 | Blocked | 首个产品的流量模型和业务 SLI 已知 | Product Ops + SRE owner | SLI/SLO、error budget、alerts、escalation、status mapping、runbooks 与演练 | pager 上线、自动 rollout analysis |
| DEC-024 | Backup/DR 与跨区域策略 | Blocked | 数据 inventory、RPO/RTO 与目标部署拓扑确定 | Data + Platform + Product Ops owner | DB PITR/object/cluster backup、restore/failover fixtures、数据损失审批 | production DR 声明、自动 failover |
| DEC-025 | MVP Adopter Preview journeys | Blocked | Phase 1A～1C 可运行且 preview deployment 可创建 | Developer Experience + Product + External adopter owner | Personal/Team overlays、三名外部开发者 journey、耗时/求助点/internal 修改/升级恢复 evidence | “快速搭建并上线 SaaS MVP”声明 |
| DEC-026 | 首批 Launch Recipes | Draft matrix | Reference SaaS 与 Product Overlay generator 可运行 | Product Integration + Security + Developer Experience owner | checkout、object-storage、analytics、error-monitoring、transactional-email recipes 的版本、SecretRef、失败测试、删除/出口和干净目录复现 | Adopter Preview；不阻断 Phase 1A～1C |
| DEC-027 | AI/Knowledge 首批 adapters | Draft matrix | AI reference overlay 开始实现前 | AI + Knowledge + Security + Product owner | Vercel AI SDK/LangChain/LangGraph、WeKnora、Exa/Tavily、Docling/MinerU/DocReader/PaddleOCR selection records，包含 capability、许可证、部署、成本、eval、安全与退出矩阵 | AI recipe、official-reference 与 production AI 声明 |
| DEC-028 | 基础 UI Shell 与 Router 选型 | Draft matrix | S8 fixture 开始实现前 | UI + Client Runtime + Accessibility owner | React/Router/primitives 版本，sidebar/mobile templates，route/navigation schema，responsive/deep-link/back-stack/visual/a11y matrix | S8 Pass、Phase 1C Shell 与 MVP UI starter |
| DEC-029 | 多产物 CI/CD 与发布渠道 | Draft matrix | Web/Server 或任一客户端 Runtime 形成首个可打包纵向切片 | Build/Release + Client Runtime + Security owner | release-plan 正式 schema、固定 Actions/toolchains、OCI multi-arch、Desktop 签名/公证、iOS/Android 商店、promotion-only、撤销与真实 runner evidence | 自动 publish、official client distribution、stable channel |

## 更新协议

1. 创建实施任务时引用台账 ID，并写入具体负责人、目标阶段和 evidence 路径；
2. 输入具备后，从 Blocked 推进到 Ready for decision 或 Draft/Matrix frozen，不能直接标 Resolved；
3. 决策改变公共契约时提交 RFC，更新 `rfc-baseline.json` 和兼容性分类；
4. 实验结果只在对应 spike 中保存，本页链接状态，不复制未经验证的结论；
5. 关闭项目必须记录决策日期、产物路径、评审人角色和证据 hash，再从当前表移入本页末尾的变更记录。

## 变更记录

当前没有已迁出的关闭项。已冻结的基础架构决策仍保留在 RFC 索引，不在本台账重复维护。
