# Phase 1 实施蓝图

首次阅读时可配合[核心术语](glossary.md)理解 Product Graph、Executable Registry、assemblyId 和 bundle trace 等名词。

## 1. 状态

本文是基于 Proposed RFC 的实施顺序，不代表框架已经实现。技术栈确定后，实际目录和命令可以调整，但门禁与责任边界必须保持。

Phase 1A 正式实现超出可删除 spikes 前，必须在仓库根生成 `rfc-baseline.json`，记录全部 RFC 文件及 SHA-256，作为仓库完整性目录。具体里程碑任务只锁定“本里程碑 RFC + 传递依赖闭包”的 hashes；未启用的未来 Kit RFC 变化不使 Phase 1 实现失效。每项验证记录 `required | enabled-only | not-applicable`，不存在的能力不能用空 fixture 假装通过。hash 直接计算每个 RFC 的 UTF-8 bytes，不做 Markdown canonicalization；`selection: all-numbered-rfcs` 只约束完整目录。目标命令 `blankspace rfc baseline --write` 尚未实现。

## 2. 目标

Phase 1 只证明一件事：开发者能够通过 Blankspace 构建一个 remote-only SaaS，在 Product Overlay 中完成业务，并能看懂装配结果、让 AI 安全修改、验证一次小版本升级。

不在 Phase 1 实现 Local Workspace、复制、CRDT、Desktop/Mobile、Billing、Editor 或运行时插件。

## 3. 里程碑 1A：Assembly

### 交付物

```text
packages/
├── contracts/
├── compiler/
├── runtime/
├── testing/
└── cli/
fixtures/
├── minimal-web/
├── minimal-server/
├── benchmarks/phase-1/
└── invalid-products/
```

物理 packages 可以临时合并，但依赖方向必须满足 RFC-0001。

最小实现面：

- `RuntimeTarget = web | server`；
- Kit/Module manifest 静态加载；
- Service requirement/declaration/binding；
- Event declaration/subscription；
- Optional feature 规范化为硬依赖；
- Product Graph 与 Executable Registry；
- assemblyId、inputHash 和稳定排序；
- Registry Draft、串行 start、反序 stop；
- public/internal、target 和 SecretRef 边界；
- diagnostics JSON。
- 不含业务能力的 Phase 1 benchmark harness 与固定期望 Graph。

### 必须通过的失败夹具

- 缺失、重复和多候选未选择的 Service provider；
- version range、target 或 capability 不兼容；
- 硬依赖循环；
- register 少报/多报 binding；
- 第三个 entry 启动失败并完整清理；
- server SecretRef 流向 web；
- dynamic import、symlink 或相对路径越过 internal boundary；
- Graph/Registry assemblyId 不匹配；
- 相同工程在不同绝对路径生成不同结果时失败。

### 退出门禁

以下均为目标命令，当前尚未实现：

```bash
blankspace check --json
blankspace inspect graph --json
blankspace test runtime-lifecycle
blankspace test compiler-fixtures
```

命令输出符合版本化 schema；Runtime 不扫描源码、不解析 package 版本，仅凭 Graph 与 Registry 启动两个最小 fixture。

## 4. 里程碑 1B：Product

### 交付物

- `remote-saas-core` 与 `workspace-saas` 两个透明 preset；
- Identity、Database 最小 Kits，以及 workspace preset 使用的可选 Workspace Kit；
- RFC-0021 Authorization adapter boundary 与可替换主体模板；
- RFC-0022 API Contract/bindings；
- RFC-0023 Identity mail outbox/worker；
- Reference SaaS；
- 一个可生成的业务资源 Module；
- 根 `AGENTS.md` 和机器上下文；
- `module create`、`kit add`、`test --affected`。

Reference SaaS 只需要：登录、创建一个产品选择的隔离根、完整 list/create/read/update/archive/restore 一个业务资源。默认 starter 可以使用 remote-only Workspace 作为隔离根，但这不是统一 SaaS 用户模型，也不包含本地副本。列表必须验证 cursor/filter scope，更新必须验证资源版本，所有操作必须有跨租户负面 fixture。

登录、session、请求身份和授权责任必须满足 RFC-0014。进入 1B 实现前冻结 password hash benchmark、session timeout、CSRF/origin、限速和密码重置安全 fixtures；Identity 未通过这些验收时 Reference SaaS 不得对外部署。

`workspace-saas` starter 采用 RFC-0005 的 Phase 1 子集：完整 `WorkspaceRef`、显式 principal、list/create/open/archive 和 Remote-only capability。`remote-saas-core` 不包含 Workspace；选择 organization/account 等隔离根的产品不会携带 Workspace schema、migration、Service 或 Shell。它不实现 Local/Local-replica Provider，也不依赖 RFC-0006～0008。

### 开发者与 AI 场景

1. 人类从创建命令到运行首页；
2. AI 仅从根 `AGENTS.md` 出发创建 `projects` Module；
3. 生成器对已有修改给出零部分写入冲突；
4. 官方 CLI/执行器拒绝 AI 直接修改 generated 或自行批准 package/config change set；根 `AGENTS.md` 只是说明入口，不是安全边界；
5. 修改 Service/Event Contract 后 affected tests 包含直接和传递消费者。

### 退出门禁

- 目标命令 `blankspace verify phase-1b` 尚未实现；最终由它汇总下列检查并返回版本化 JSON；
- RFC-0014 的 10 项 Identity、session、tenant 与安全验收场景全部通过；任何一项失败都阻止 Phase 1B 退出，而不只是阻止对外部署；
- RFC-0021 的两个不同主体模型、embedded/scoped-DAL 数据隔离与授权一致性 corpus 通过；外部关系服务标记 `not-applicable`；
- RFC-0022 的 API schema/binding、分页、幂等、错误与跨租户 corpus 通过；
- RFC-0023 的 Identity mail/outbox 崩溃、重复、乱序、DLQ 与旧 token corpus 通过；
- 产品业务和 UI 未导入 Framework/Kit internal；
- 移除未启用 Kit 后 bundle trace 中不存在其实现；
- 冷/热创建时间、检查时间和 bundle size 使用 1A benchmark harness 冻结、进入 1B 前评审通过的[性能预算与标准环境](budgets/phase-1.md)，超阈值即失败；
- Reference SaaS 可以替换一个 adapter 而不修改消费者代码。
- Phase 1B 只证明功能闭环；真实客户数据仍需通过 [Production Readiness Gate](production-readiness.md)。

## 5. 里程碑 1C：Compatibility

### 交付物

- 默认 App/Auth/Workspace Shell；
- `sidebar-saas` Desktop 和 `mobile-tabs` compact/React Mobile 基础模板；
- 共享 Route/Navigation Contract、nested layout、deep link 与响应式 presentation fixtures；
- 一个布局明显不同的 Product Shell fixture；
- navigation/command/route 三种 semantic contributions；
- 标准 UI 状态与截图/a11y fixtures；
- compatibility manifest；
- `upgrade --check/plan/apply/verify/restore`；
- 上一小版本 Product Overlay fixture。

### 升级演练

```text
发布 fixture v0
→ 添加兼容 Contract 字段与一个可选 contribution
→ 生成 v1 manifest
→ check/plan
→ apply
→ verify Graph、类型、业务、bundle、视觉和 a11y
→ 注入 verify 失败并 restore
```

Phase 1 不执行真实生产 migration，只验证 migration descriptor 能进入报告并被阻止自动执行。

### 退出门禁

- 目标命令 `blankspace verify phase-1c` 尚未实现；最终由它汇总升级、业务、视觉和恢复 fixtures；
- 旧 Shell 在兼容 minor 中无需修改；
- Public Override 始终进入人工复查，AI 不能签发凭证；
- apply 中断、磁盘不足、输入变化和 verify 失败都有确定恢复结果；
- package lock 与 `blankspace.lock` 不一致时构建失败；
- 产品能审计一次升级的所有代码、配置和生成物变化。

恢复 fixture 在受控 workspace 中运行：预检确认 staging 与项目位于同一文件系统、空间足够、无未登记并发 writer，journal 和旧文件恢复空间已经预留。输入变化在 apply 前阻断且零写入；apply 中断通过 journal 恢复；空间前置检查失败时不开始写入；apply 成功但 verify 失败进入 `applied-unverified` 并可由 restore 回到旧版本；任何数据库 migration 均未执行。无法满足前置条件时工具必须拒绝承诺原子升级。

## 6. RFC 追踪

| 实施区域 | 主要 RFC |
| --- | --- |
| Foundation、生命周期 | RFC-0001 |
| Kit、Service、Event | RFC-0002 |
| Product Directory | RFC-0003 |
| Graph、Registry、裁剪 | RFC-0004 |
| UI Shell | RFC-0009 |
| 升级 | RFC-0010 |
| AI 与生成器 | RFC-0011 |
| 指标与证据 | RFC-0012 |
| Identity、Session、请求身份 | RFC-0014 |
| 多客户端 Runtime 与机器契约 | RFC-0015、RFC-0017（后续独立 Runtime milestone） |
| 跨平台 Design System | RFC-0016（后续独立 Renderer milestone） |
| Editor 与 Sync 未来边界 | RFC-0018、RFC-0019（Phase 2/4，不进入 Phase 1） |
| Integration-first 与能力选择 | RFC-0020、RFC-0025 |
| 主体/授权、API、可靠副作用 | RFC-0021、RFC-0022、RFC-0023 |
| Billing adapter | RFC-0024（按启用能力验证） |
| Operations Plane 与渐进交付 | RFC-0026（Phase 1C 后独立运维轨道） |

RFC-0005 仅使用上述 Remote-only 子集；RFC-0006～RFC-0008 只作为未来约束存在，不得为了提前支持 local-first 污染 Phase 1 实现。

## 7. 开始编码前的剩余工具锁定

TypeScript/ESM、Node.js 24 LTS、React-first、Fastify、PostgreSQL、JSON Schema-first 和 JSONC 已由 RFC-0013 选定。仍需通过 spikes 锁定具体工具和版本：

- pnpm、TypeScript、Vite、Vitest 与 Playwright 的具体版本；
- React Shell 的具体 UI libraries；
- PostgreSQL 数据访问层与 migration 实现；
- JSONC parser、canonical serializer 与 JSON Schema 工具；
- import graph 与 bundle trace 使用的解析器；
- 测试、截图和可访问性工具。

锁定标准不是“最流行”，而是能否实现确定性 Graph、严格边界、快速反馈和跨版本 fixtures。

因此当前 go/no-go 为：可以开展 spikes 和不绑定具体领域的 1A 骨架；在 RFC baseline、核心 JSON Schema 与 S1～S7 通过前不开始 1B，S8 未通过前不开始 1C，也不承诺完整 Phase 1 日期。

当前执行状态：S1 已取得 [provisional pass](./spikes/S1-config.md)。Node.js 24.20.0 下已重新通过 S1 Node tests、TypeScript typecheck、Ajv 文档 schema 编译和最小 Product Graph 的 Vitest；S1 corpus 仍使用 Node test runner，最终 validator、完整 Vitest evidence 和原 S1 文档要求的跨平台环境尚未全部关闭，因此不计入正式通过，也不解除 1B gate。

Phase 1A 已实现内存 `buildMinimalProductGraphs` 前置切片、正式 `ResolutionRecordV1`、workspace source resolver、target/dynamic import policy，以及通过 Linux/macOS/Windows 门禁的 S2 native resolution trace、S3 bundle/artifact trace 和 S4 Executable Registry conformance。S5 串行 lifecycle core、资源账本、启动失败回滚、稳定 Event dispatch、嵌套深度限制和活动 dispatch 排空已取得 macOS arm64 provisional evidence；完整 Runtime 与 CLI 仍未完成，当前工作项为 `A1-S5-03`。

S2 的[统一解析矩阵](./spikes/S2-resolver.md)、S3 的[Bundle Trace Matrix](./spikes/S3-bundle-trace.md)和 S4 的[Graph/Registry 对账](./spikes/S4-registry.md)均已在 Linux、macOS、Windows 上取得 Pass。S5 lifecycle 与 Event dispatch 已完成本地 provisional gate；当前下一门禁是三平台运行同一 frozen corpus 并对账 canonical hashes。shutdown deadline 与 host 强制终止不属于 `A1-S5-03`。贡献流程和证据格式分别见[框架贡献指南](contributing.md)与[验证策略](testing-strategy.md)。

## 8. Adopter Preview Gate

Phase 1A～1C 是进入外部采用验证的前置条件，不直接等于可宣传的 SaaS MVP starter。随后执行 [SaaS MVP 采用策略](mvp-adoption.md)定义的 Adopter Preview：

- 从干净环境创建 Personal SaaS 与 Team SaaS；
- 完成一个业务 Module、Coordinator 和明显不同的 Product Shell；
- 用 Product Overlay Launch Recipe 验证 checkout、object storage、analytics、error monitoring 和产品邮件；
- 创建 vendor-neutral preview deployment，并检查 migration、health、logs 和发布摘要；
- 由至少三名未参与 Blankspace 设计的开发者独立完成 journey；
- 记录耗时、失败、求助点、internal 修改和升级恢复证据。

Launch Recipe 是 provider-native 的可执行集成方案，不是稳定 Kit。只有经过不同产品验证且确有可替换价值时，才按 RFC-0025 晋级。Adopter Preview 仍不允许处理真实客户数据；产品必须另外通过 Production Readiness Gate。
