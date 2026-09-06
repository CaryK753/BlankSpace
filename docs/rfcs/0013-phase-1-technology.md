# RFC-0013：Phase 1 技术栈与验证 Spike

## 状态

Proposed

## 背景

Blankspace 需要尽快实现 Phase 1A，但技术选型必须服务于确定性 Product Graph、严格 import 边界、快速反馈、深度 UI 定制和跨版本 fixtures。AFFiNE 证明 TypeScript、React、Vite/Vitest、Playwright 与 Node 服务端生态可以承载大型 local-first 产品，但 Blankspace 不复制其完整 monorepo 或业务框架。

参考核对日期：2026-09-04。

- [AFFiNE frontend core package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/core/package.json)
- [AFFiNE TypeScript configuration](https://github.com/toeverything/AFFiNE/blob/canary/tsconfig.json)
- [AFFiNE backend NestJS controller](https://github.com/toeverything/AFFiNE/blob/canary/packages/backend/server/src/core/user/controller.ts)
- [Vitest 官方说明](https://main.vitest.dev/)
- [Playwright 官方文档](https://playwright.dev/docs/intro)

## 决策摘要

| 区域 | Phase 1 决策 | 状态 |
| --- | --- | --- |
| 语言 | TypeScript strict、ESM | 采用 |
| Runtime | Node.js 24 LTS | 采用，具体 patch 由工具文件固定 |
| Workspace | pnpm workspace | 候选首选，需隔离 spike |
| Web | React-first Product Shell | 采用 |
| Web dev/build | Vite | 候选首选，需 trace spike |
| Unit/integration | Vitest | 候选首选 |
| Browser/E2E/visual | Playwright | 候选首选 |
| Server host | Fastify host adapter | 采用 |
| Database | PostgreSQL；Kysely 与 Drizzle 二选一 spike | PostgreSQL 采用，访问层未冻结 |
| Schema | 边界格式 JSON Schema-first，生成 TypeScript | 采用 |
| Compiler input | JSONC manifests | 采用 |
| Monorepo orchestrator | 先只用 package manager scripts | 采用 |
| Desktop/Mobile/local-first | Phase 1 不实现；目标 Runtime 见 RFC-0015 | 独立里程碑验证 |

## 1. TypeScript 与 ESM

Foundation、官方 Kits、CLI、reference products 使用 Node.js 24 LTS 和同一 TypeScript 生态，启用 strict、isolated modules、verbatim module syntax、no implicit returns 和 casing 检查。仓库用 `.node-version` 与 package manager 配置固定具体 patch，CI 验证偏差。禁止通过全局 `skipLibCheck`、整文件 `ts-nocheck` 或宽泛 lint disable 掩盖公共 Contract 错误。

选择 TypeScript 的主要理由不是共享语法，而是：

- 边界 JSON Schema 可以生成 TypeScript types、validators 和 AI 上下文；
- Compiler 能使用真实 module resolver 分析 package exports 和 type-only imports；
- Web 与 Server 可以共享纯 Contract，但仍由 target graph 强制隔离；
- Product Overlay 保持普通代码，不引入专用 DSL 语言。

接受的代价是大型 monorepo 类型检查和构建性能需要持续预算，且运行时 schema 不能只依赖擦除后的 TypeScript 类型。

## 2. React-first，而非 UI-framework-agnostic

Phase 1 的 Product Shell、UI contributions 和 reference products 采用 React。React component types 只能存在于独立 `@blankspace/ui-react-contracts` 与 UI Runtime packages；核心 contracts/compiler 的 Graph 只保存 framework discriminator、contribution ID 和可序列化 metadata。

拒绝 Phase 1 同时支持 React/Vue/Svelte：这会迫使 Product Shell 降级为最低公分母，并使视觉、焦点、overlay、SSR 和错误边界测试倍增。未来如果第二种 UI 技术有真实产品需求，可通过独立 UI Runtime Kit 添加，不追求同一组件跨框架运行。

这不表示长期只支持 React。RFC-0015 已将 Electron React、Capacitor React Mobile、SwiftUI 与 Compose 定义为后续 Client Runtime 路线；RFC-0016 定义跨 Renderer Design System。它们共享语义 Contracts，不进入 Phase 1 的实现门禁。

## 3. Vite、Vitest 与 Playwright

Vite 作为 Reference Web 的开发服务器和生产构建候选；Vitest 负责 Contracts、Compiler、Runtime 和 Kits 的单元/集成测试；Playwright 负责黄金路径、截图、键盘和浏览器级升级 fixtures。

采用前必须证明：

- Vite/Rollup 的 resolve 结果能导出稳定 module trace；
- 自定义 plugin 能拒绝 server SecretRef 与 internal import，而不是只发 warning；
- Vitest 与生产 resolver 对 aliases、exports 和 conditions 的结果一致；
- Playwright fixtures 能固定字体、时区、locale、动画和 viewport，控制视觉噪声；
- 工具版本进入 `blankspace.lock` 和升级报告。

Foundation Compiler 不能成为只在 Vite 内运行的 plugin。核心 Graph 编译是独立 package；Vite adapter 只消费其结果并验证 bundle trace。

## 4. pnpm workspace，但不引入额外任务平台

pnpm 是 Phase 1 首选，因为 workspace protocol 和较严格的依赖可见性有助于暴露未声明 imports。必须通过 spike 证明 symlink/virtual store 不会让路径规范化和跨目录 hash 不稳定。

Phase 1 不先引入 Nx、Turborepo 或 Bazel。五个 Foundation packages 和少量 fixtures 可以由 pnpm scripts 组织；只有 CI 时间或 affected task graph 出现真实瓶颈后才增加 orchestrator。Blankspace 自己的 Product Graph 也不应被误用成通用 monorepo task runner。

## 5. Server Host 保持 adapter

候选：

| 方案 | 优点 | 风险 |
| --- | --- | --- |
| Fastify | 小、显式、适合证明 host adapter 边界 | 认证、模块组织等默认能力少 |
| NestJS | 生态完整，AFFiNE 已证明可扩展 | 自带 DI/module 生命周期可能与 Blankspace Runtime 重叠 |

Phase 1 采用 Fastify，因为 Foundation 已拥有装配与生命周期，不应再让第二套 DI 容器决定 Service 图。Runtime 是唯一生命周期 owner：负责 register/start/ready/stop、signal 处理和关闭 deadline；Fastify adapter 负责监听、请求排空、路由桥接和底层 server close，不提供第二个 Service locator。

S6 验证端口占用、部分启动失败、重复 stop、活动请求排空、关闭超时、signal 和异常传播。若 Fastify 无法在不破坏 Runtime 生命周期的前提下通过矩阵，再用 RFC 重开 NestJS 选项。

## 6. PostgreSQL 与数据访问层

Reference SaaS 采用 PostgreSQL，开发环境允许容器启动。它提供足够真实的 transaction、schema、索引和 migration 条件，同时不决定未来 Local Workspace 的 SQLite/IndexedDB 选择。

不采用单一全局 ORM schema 作为所有 Kits 的事实源，因为这会破坏 Kit migration 所有权。候选访问层必须满足：

- 每个 Kit 拥有独立 migration namespace；
- 可检查生成 SQL，不依赖运行时 schema push；
- transaction 可以显式传入 Service；
- PostgreSQL schema 或命名前缀可以表达所有权；
- migration hash 和顺序能进入 Product Graph/lock；
- 不迫使 browser/shared entry 引入数据库实现。

Migration runner 由 Database Kit 拥有，而不是 ORM：Compiler 汇总 descriptor 并按显式依赖稳定排序；Server runner 获取全局 advisory lock，记录 migration ID、owner、hash、started/completed 状态，拒绝重复 ID、已执行内容变化和并发 runner。单 migration 的事务边界由 descriptor 声明；失败默认停止后续项，不自动降级；移除 Kit 仍保留历史和数据。

Kysely 倾向更薄、更接近 SQL；Drizzle 倾向 schema/type 集成更完整。二者用同一 Identity/Workspace migration fixture 比较后决定；若任何方案迫使所有 Kits 共用一个 schema 源，则选择直接 SQL + typed query adapter。

## 7. Runtime Schema

所有 public manifest、Graph、diagnostic、change set 和 compatibility manifest 以 JSON Schema 2020-12 为唯一边界事实源，并从 schema 生成 TypeScript types 和 validators。领域内部类型仍可直接使用 TypeScript；一旦进入公开结构化协议，就不能维护第二份手写 TS 类型。

实现 spike 比较 JSON Schema code generator/validator，重点检查 discriminated unions、semver strings、recursive graph、错误路径、默认值和 schema evolution。生成工具可以替换，但规范化 schema 与兼容测试是稳定输入。

## 8. 配置隔离

Compiler 输入采用 `blankspace.config.jsonc` 与 `product/modules/*/module.jsonc`。JSONC 允许注释和尾逗号，但规范化时解析为 JSON data model；重复 key、非有限数字、schema 外字段和无法解析的 secret reference 都失败。Canonical serialization 固定 UTF-8、对象 key 排序、数组按 schema 语义保序，不包含注释或本机路径。

三个配置层级职责不同：根 `blankspace.config.jsonc` 选择 preset、Kits、adapters、targets 和 Product Directory；`product/manifest.jsonc` 声明产品级 runtime entries 和可选 module allowlist；`product/modules/*/module.jsonc` 声明单个业务模块。Product Shell 和 coordinators 是由对应 runtime entry 导入的普通产品代码，不在 JSONC 中重复声明。allowlist 缺省时启用扫描到的全部一层目录模块，显式存在时排除未列出的候选并拒绝不存在的目录。Compiler 从根入口加载后两层，任何同义字段跨层重复都按 schema 拒绝。

根 schema 只能验证通用 Kit 配置容器；Compiler 必须从解析后的 Kit manifest 加载各自版本化 `configSchema` 做第二阶段校验。未经过 Kit schema 验证的字段、adapter、capability 或 SecretRef 不得进入 Graph。

产品代码仍是 TypeScript，manifest 通过路径引用 entries。编辑器借助 JSON Schema 提供补全，CLI 负责常见变更。未来可以增加生成 JSONC 的 TypeScript authoring helper，但它不是 Compiler 输入，也不能覆盖 canonical manifest。

## 9. 必做 Spikes

| Spike | 成功条件 | 失败后选择 |
| --- | --- | --- |
| S1 Config | JSONC 接受/拒绝 corpus、canonical JSON 和 source diagnostics 跨平台一致 | 收窄 JSONC 方言 |
| S2 Resolver | 固定 resolution matrix 中允许差异被解释，非法 runtime 边均失败 | 使用单一 resolver adapter 或淘汰 Vite |
| S3 Bundle trace | Compiler 拒绝非法源码边；adapter 检查 JS/CSS/worker/WASM/assets 全部产物 | 更换 bundler/分析器 |
| S4 Registry | Graph/Registry assemblyId 不一致时导入前失败 | 调整 registry 生成模型 |
| S5 Lifecycle | register 零业务实例化，第三 entry 失败完整清理 | 收窄 entry contract |
| S6 Server | Fastify 通过唯一 lifecycle owner 的故障矩阵 | 重开 Server host RFC |
| S7 Database | 两 Kits 独立 migration、事务与卸载保留数据 | 选择另一访问层或直接 SQL |
| S8 UI | 两种 Shell 消费相同 contributions 并通过视觉/a11y | 修订 RFC-0009 |

每个 spike 是可删除实验，不直接成为生产实现。开工前先在 `docs/spikes/S<n>-<name>.md` 冻结 corpus/matrix、工具版本、环境、预期输出、阈值和失败分类；结果追加命令、时间、产物与失败证据。S1～S7 全部通过才能进入 1B，S8 通过才能进入 1C。整份 RFC 只有在 S1～S8 全部通过、Phase 1A～1C 的相关集成与兼容 fixtures 通过，并完成 RFC 索引要求的维护者评审后才能从 Proposed 改为 Accepted；不存在只修改状态文字的接受方式。

S2 的 resolution matrix 分别固定 `type`、`web-dev`、`web-build`、`server`、`test` 的 conditions、extensions、aliases、externalization 和 package exports。不同模式可以合法不同，但每个 runtime import 必须在目标模式唯一解析，type resolution 不得掩盖不存在的 runtime export。

S3 使用两层证据：Compiler 的统一 resolver 证明源码边合法；bundler adapter 对最终 chunks、CSS、workers、WASM、assets 与 virtual modules 输出稳定 trace。Tree-shaking 不能把非法 import 变成合法。

pnpm spike 必须覆盖不同 store-dir/linker/hoist 配置、Windows 路径与大小写、peer suffix 和 workspace protocol。Graph 只记录 logical workspace path/package identity，不记录 `.pnpm` 或 store realpath。

## 10. 不选择的内容

- Phase 1 不选择 Electron/Tauri、SQLite/IndexedDB、Yjs 或同步 transport；
- 不引入 GraphQL 作为 Foundation 要求；Reference SaaS 首个 API 可用 typed HTTP；
- 不引入通用 DI framework；
- 不让 ORM entities 成为 Service Contract；
- 不让 UI framework 类型进入非 UI Foundation packages；
- 不为 AI 单独选择另一套构建或测试工具。

## 11. 重审触发条件

- Graph Compiler 无法脱离 Vite 独立运行；
- React UI Contract 阻止第二个真实产品；
- pnpm 路径模型破坏跨目录确定性；
- Node host 无法满足未来 Desktop/local-first 共享 Contract；
- 数据访问层无法维持 Kit migration 所有权；
- AI 无法从生成 schema 正确构造和修复项目。
