# Blankspace 开发路线图

## 1. 路线原则

Blankspace 的能力上限是承载 AFFiNE 级完整产品，但实现必须从最小纵向切片逐步推进。每个阶段都应产生可运行结果，避免同时建设框架、编辑器、同步平台和插件生态。

当前状态：架构设计与 Phase 1A spike 阶段。S1 为 provisional pass，S2 已通过跨平台 resolver 矩阵，当前进入 S3 bundle trace 冻结工作；仓库仍不存在可运行框架或产品脚手架。各阶段优先集成成熟领域项目；Blankspace 不把开发编辑器、搜索引擎、认证协议或支付网关列为路线交付物。

## 2. Phase 0：决策与风险原型

目标：固化最小概念，并尽早验证最危险的数据假设。

交付物：

- RFC：Foundation 的最小边界与 packages；
- RFC：Kit、Service Contract、Event 和生命周期；
- RFC：Product Directory 与目录模块边界；
- RFC：Workspace Provider、Server Scope 和 WorkspaceRef；
- RFC：参考产品第一条纵向切片；
- RFC：Public Extension Surface 与上游兼容策略；
- 开发者黄金路径和 AI context package 原型；
- `upgrade --check` 兼容报告格式原型；
- AFFiNE 能力矩阵及 UI、性能、数据规模等可验证验收指标；
- Product Shell Contract 与标准视觉状态原型；
- 一个极小同步 spike，验证本地写入、重复投递、乱序和恢复；
- 技术栈、许可证和威胁模型初稿。

当前威胁模型初稿见[安全模型与信任边界](security.md)，部署责任见[部署与运行责任](operations.md)。根 OSI 许可证、第三方 notice/license policy 必须成为 Phase 0 退出条件；在完成前不得假定 Blankspace 或参考产品可被合法作为开源框架 fork、修改或再分发。

退出条件：根 OSI 许可证与第三方 policy 已确定；团队可以在不使用 Command Bus 或 Workflow DSL 的情况下，清晰描述一个产品请求如何穿过 Module、Service、Kit 和 storage；目标开发者还能从状态矩阵区分已实现能力与远期能力，并用原型验证黄金路径、UI 扩展和一次模拟升级。

## 3. Phase 1：Foundation 与远端 SaaS

目标：证明 Blankspace 能以简单方式构建传统 Web SaaS。

Phase 1 分为三个顺序门禁，避免一次实现全部承诺：

1. **1A Assembly**：contracts、web/server Graph、Executable Registry、Service/Event、串行生命周期和 diagnostics；
2. **1B Product**：`remote-saas-core`/`workspace-saas` presets、Identity/Database/可选 Workspace、一个 CRUD Module 与 AI context；
3. **1C Compatibility**：Product Shell 原型、上一小版本 fixture、upgrade check/verify 和 bundle trace。

此外建立独立的 **Platform Operations Track**：Phase 1C 后交付 single-host/managed-container 的 release evidence 与健康/回滚最小闭环；首个共享生产环境前交付 production profile；Kubernetes/GitOps/progressive delivery reference profile 可与 Phase 5 平台能力并行。该轨道包含[多产物 CI/CD](ci-cd.md)：先实现 Web/Server OCI candidate，再随各 Runtime milestone 独立接入 Electron、iOS 与 Android 签名/商店发布。它不扩大 Phase 1A Foundation，但 Production Readiness 不允许跳过。

Phase 1C 后增加 **Adopter Preview Gate**，它不是新的 Foundation 功能阶段，而是面向外部开发者的采用验证。它要求 Personal/Team 两种主体模型、差异化 Product Shell、preview deployment、常见上线 Launch Recipes 和独立开发者 journey 全部形成证据。完整门禁见 [SaaS MVP 采用策略](mvp-adoption.md)。未通过前不得宣传 Blankspace 可以快速搭建并上线 SaaS MVP。

Phase 1C 的默认 Shell 明确交付 `sidebar-saas` Desktop 与 `mobile-tabs` Mobile/compact 模板、共享 Route/Navigation Contract 和标准 CRUD/Auth/Settings 页面 recipes。Mobile 模板先作为 React Web compact/React Mobile fixture，不因此提前承诺 Capacitor 或原生商店发布。

只有 1A 稳定后才开始 1B；只有真实 Product Overlay 跑通后才冻结 1C 的公共兼容面。各 RFC 可以先保持 Proposed，不要求所有长期 RFC 同时 Accepted；RFC-0015/0016/0017 尤其不属于 Phase 1 退出条件。

具体交付物、失败夹具和门禁见 [Phase 1 实施蓝图](phase-1-blueprint.md)。

最小范围：

- Product 配置和 Preset 展开；
- Kit 硬依赖图与初始化顺序；
- Service Contract 与 Event；
- Product Module 目录扫描和导入边界；
- shared、web、server 入口裁剪；
- 类型安全的基础 API；
- 配置 schema 与 secret 边界；
- Product Graph 和可读诊断；
- `check`、`inspect graph`、`doctor` 的最小 CLI；
- 机器可读 Contracts、commands 和错误诊断；
- 一个旧版本 Product Overlay 的升级兼容测试；
- Identity、Database 两个 core Kits，以及 `workspace-saas` 使用的可选 Workspace Kit；
- RFC-0021 的可替换 authentication/authorization 边界与一个不固定 Organization 模型的 starter；
- RFC-0022 的 Phase 1 API Contract、server binding 与 TypeScript client；
- RFC-0023 的 Identity 邮件 outbox/worker 最小路径；
- 一个普通 remote-only SaaS 纵向流程。

暂不引入：本地数据库、CRDT、同步、移动端、运行时插件和通用 Workflow。

退出条件：参考产品可以通过 Product Overlay 实现注册、创建产品选择的隔离根和一个业务资源，且不修改 Foundation 或 Kit 内部源码；认证邮件、API 幂等、跨租户负面 fixtures 和可靠 worker 路径全部通过。功能退出不代表 production-ready，处理真实客户数据还必须通过 [Production Readiness Gate](production-readiness.md)。

### Adopter Preview：MVP 采用闭环

Phase 1A～1C 关闭后，必须再由未参与框架设计的开发者验证创建、业务修改、Shell 定制、常见集成、preview 部署、诊断和升级。支付、文件、分析、错误监控和产品邮件先以 Product Overlay 拥有的 Launch Recipe 交付；它们不会因为 MVP 常见就自动成为稳定 Kit。Adopter Preview 证明“可以使用”，仍不替代具体产品的 Production Readiness。

### 跨阶段 Client Runtime Track

Phase 1C 之后可以与数据 Phase 2～4 并行推进客户端 Runtime，不把全部客户端实现塞进 Phase 1 退出门禁：

1. Electron Host：与 Web 共享 React Desktop renderer，验证 typed IPC、安全、打包和签名；
2. Capacitor Host：使用独立 React Mobile renderer，验证 native bridge、safe area、生命周期和发布；
3. Native Contracts：生成 Swift/Kotlin models/clients，验证 SwiftUI/Compose Shell 和一个业务纵向切片；
4. 平台 Design System：Theme Compiler、Apple/Android/Web Renderer 与 accessibility fixtures；
5. Local-first client engine feasibility：Phase 2 确定 Editor/storage 最小边界后立即执行 N1，在 Phase 4 Sync Protocol 正式实现前用至少一个原生 probe 决定各端实现、共享 Rust core 或混合路线。

每个 Runtime 单独取得 official/verified evidence；Electron 或 Capacitor 通过不能替代 SwiftUI/Compose 验证。详见 [RFC-0015](rfcs/0015-client-runtimes.md)与 [RFC-0016](rfcs/0016-cross-platform-design-system.md)。

## 4. Phase 2：Local Workspace

目标：增加纯本地 Workspace，而不改变 remote-only 产品的数据语义。

最小范围：

- Workspace Provider Contract；
- Local Provider；
- Web IndexedDB 与 Desktop SQLite 候选实现；
- 本地 migration、备份、恢复和导出；
- Client-generated IDs；
- 按 RFC-0018/0020 完成 E1a harness，并在真实 Local Provider 上完成 E1b experimental Editor adapter，不实现编辑器引擎；
- AFFiNE 参考产品的 Block 文档最小切片。

退出条件：E1b 的 create/open/transaction/extension/blob/index/恢复边界在真实 Local Provider 上通过；断网启动、创建、编辑、关闭、重启恢复和导出均通过测试。此处不等待 Phase 5 的第二引擎用例或稳定 Editor Kit。

## 5. Phase 3：Server Registry 与 Cloud Workspace

目标：客户端能连接官方托管或自托管 Server，并打开属于该 Server Provider 的 Workspace。

最小范围：

- Server Registry 与 feature discovery；
- 每台 Server 的独立 Account Session；
- Cloud Workspace Provider；
- `{ sourceId, workspaceId }` 消歧；
- Remote-only 与 Local-replica 两种 provider；
- Docker 参考部署；
- Local → Cloud 迁移的可恢复原型。

退出条件：一个客户端能同时管理 Local、官方和自托管 Workspaces，身份、缓存、认证与路由不会串联。

## 6. Phase 4：可靠复制与协作

目标：让 Local-replica Workspace 在离线状态下工作，并可靠同步到单一 Server。

开始前必须确定：

- 变更、冲突和删除语义；
- 本地数据与 outbox 的原子提交；
- schema 演进和旧客户端兼容；
- 附件传输与失败恢复；
- 权限变化和离线写入；
- 同步协议版本协商。

这些输入由 RFC-0019 和 Y1 matrix 冻结；N1 必须先证明至少一个原生客户端可以执行相同 storage/sync transcript，避免只在 TypeScript 环境得到不可移植结论。

建议顺序：

1. 单用户、单资源类型增量复制；
2. 幂等、断线重连、重复和乱序；
3. 多设备冲突与删除传播；
4. 文件与大对象；
5. 实时 awareness；
6. 对需要收敛编辑的数据采用 CRDT；
7. 多用户实时协作。

退出条件：网络分区、进程崩溃、客户端版本差异和服务端恢复均有自动化测试。

## 7. Phase 5：更多 Kits 与平台能力

只根据真实产品需求扩展：

- Files、Jobs、Notifications、Search；
- Feature Flags、Observability、Product Analytics、Admin accelerators 与可选 AI Kit；
- AI Model、Knowledge、Web Research 与 Document Intelligence 分别形成 Kit；Agent Runtime 只在普通 Coordinator 无法满足的持久长流程出现后启动；
- 将 Phase 2 experimental Editor boundary 经 Tiptap 类富文本与 BlockSuite 类 Page/Edgeless 等不同真实用例验证后晋级为稳定 Editor Kit，并按证据维护官方参考 adapter；
- Billing Kit 与支付 adapters；
- 未在 Client Runtime Track 完成的客户端 Runtime；
- 相机、分享、安全存储、多窗口、菜单等平台 Capability adapters；
- 第三方 Runtime conformance 与支持等级证据。
- RFC-0026 的 Deployment Adapter、镜像发现、渐进发布、状态/事故聚合与 Kubernetes reference profile。

每个官方 Kit 至少经过两个不同产品或两个明显不同用例验证后再承诺稳定 API。

Phase 5 按 Kit 独立关闭，不再用一张开放式能力清单代表整体完成。Files、Jobs、Notifications、Search、Billing、Editor 分别需要 RFC、reference adapter、机器 schema、失败矩阵、安全审查、迁移/退出路径和上一版本 fixture；产品只验证实际启用的 Gate。Billing 首批候选至少比较 Stripe 与 Waffo Pancake，见 RFC-0024。

所有候选先进入 [SaaS Capability Catalog](capability-catalog.md)，再按 RFC-0025 经过 selection record 和领域 conformance 晋级。增加候选不会自动把依赖加入 Preset，也不会把 `candidate` 变成 Blankspace 的支持承诺。

## 8. Phase 6：生态能力（可选）

只有真实第三方需求出现后才评估：

- 外部 Kit package 兼容策略；
- Kit 目录或分发规范；
- 面向最终用户的 External Plugin；
- 权限、签名、沙箱和故障隔离；
- 稳定 SDK 和版本矩阵。

构建时 Kit 与运行时 External Plugin 必须保持两个独立信任模型。

## 9. 第一条 AFFiNE 验证链

参考产品的终点是完整 AFFiNE 级能力，但第一条可运行链只验证架构：

```text
创建 Local Workspace
→ 创建和编辑 Block 文档
→ 持久化到本地
→ 选择目标 Server
→ 创建 Cloud Workspace
→ 迁移文档和文件
→ 建立本地副本与单 Server 同步
→ 另一客户端打开
```

这条链足以验证 Foundation、Workspace Kit、Editor 边界、Local-first Kit、Server Scope、Workspace Provider 和迁移设计，同时不要求第一阶段实现白板、数据库视图、AI 或完整协作。

其中 Editor 边界在 Phase 2 先按 RFC-0018 experimental 实现，Phase 5 才评估稳定通用 Kit；同步 wire contract 在 Phase 4 前按 RFC-0019/Y1 冻结。两者不再互相等待。

## 10. 首批 RFC

1. `RFC-0001`：Foundation 最小边界；
2. `RFC-0002`：Kit、Service Contract 与 Event；
3. `RFC-0003`：Product Directory 与 Module Boundary；
4. `RFC-0004`：Product Graph 与 Runtime Entries；
5. `RFC-0005`：Workspace Provider 与 Server Scope；
6. `RFC-0006`：Local、Remote、Replicated 数据模式；
7. `RFC-0007`：AFFiNE 参考产品首个纵向切片；
8. `RFC-0008`：Local → Cloud 迁移与恢复；
9. `RFC-0009`：Public Extension Surface 与 UI Shell；
10. `RFC-0010`：升级计划、compatibility manifest 与 codemod；
11. `RFC-0011`：AI context package 与结构化 CLI；
12. `RFC-0012`：AFFiNE 能力矩阵与非功能验收基准；
13. `RFC-0013`：Phase 1 技术栈与验证 Spikes；
14. `RFC-0014`：Identity、Session 与请求身份；
15. `RFC-0015`：多客户端 Runtime、UI Family 与 Screen Contract；
16. `RFC-0016`：跨平台 Design System 与 Token Resolver；
17. `RFC-0017`：多客户端 Graph V2、分发、工具与证据机器契约。
18. `RFC-0018`：experimental Editor Engine 最小边界；
19. `RFC-0019`：Sync Protocol V1 机器边界；
20. `RFC-0020`：Integration-first Kit、薄适配与上游责任边界。
21. `RFC-0021`：身份、产品主体与可替换授权引擎；
22. `RFC-0022`：Phase 1 API Contract V1；
23. `RFC-0023`：可靠副作用、Jobs 与身份邮件；
24. `RFC-0024`：Billing 状态机与 Payment Adapter。
25. `RFC-0025`：Capability Catalog、交付/许可证分类与集成选型。
26. `RFC-0026`：Operations Plane、镜像更新、渐进交付、客户端更新与回滚。

`RFC-0001` 至 `RFC-0026` 已形成 Proposed 草案，见 [RFC 索引](rfcs/README.md)。它们仍需原型证据才能 Accepted。

## 11. 复杂度预算

Phase 1 明确不建设：

- Command Bus 或 Query Bus；
- Workflow/Saga DSL；
- 分布式事务；
- 通用多 Server 同步；
- 统一所有数据路径的 Operation API；
- 运行时 Kit 安装；
- 插件市场；
- 通用编辑器或通用 CRDT 引擎。

新增任何上述能力前，必须先给出普通 Service、Event、Coordinator 和后台任务无法解决的真实案例。
