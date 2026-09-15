# 当前实现参考

本页只描述仓库现在可以运行的内容。未来产品体验见[入门目标](getting-started.md)，机器状态见 [`status/project-status.json`](status/project-status.json)。两者冲突时，以源码、正式 schema、测试和状态文件为准。

准备开始贡献代码的 Agent 应从[Agent 启动入口](agent-start-here.md)读取机器状态和可领取工作项，而不是从本页推断任务。`A1-C2-02` 已完成，当前没有 ready item。

## 当前可以运行

- `@blankspace/contracts`：导出 `RuntimeTarget`、`ProductGraphV1`、`ResolutionRecordV1` 与 Module runtime declarations TypeScript 类型；正式 JSON Schema 覆盖 root config、product manifest、module、静态 Service provider/Event handler declarations、Product Graph V1、Resolution Record V1 与 RFC baseline。Module descriptor 已能以 owner-relative path 和小写 SHA-256 引用 declarations 文件。
- `@blankspace/compiler`：提供严格 JSONC 解析/canonical hash、读取并校验 root/Product/一层 Module 描述符的 `loadProductDirectory`、将其静态记录接入最小 Graph builder 的 `adaptProductDirectoryToGraphInput` / `buildProductDirectoryGraphs`，以及产出每 target joint Graph/Executable Registry 的 `buildProductDirectoryAssemblies`。Product Directory loader 支持缺省发现与显式白名单、稳定排序和 checkout-independent hash；它要求每个 Product/Module entry 在 symlink resolution 后仍位于 owner 内且为现存普通文件，并以相同边界读取 Module runtime declarations、校验 canonical SHA-256 后纳入 loader record/hash。源码解析 API `resolveSourceImport` 继续独立存在，declarations 也尚未进入 Graph assembly。
- S2 conformance runner：真实调用 TypeScript、Node、Vite 与 Vitest，将五种 mode 的原生结果归一为逻辑路径并与 Compiler record 逐边对账；Linux、macOS、Windows 均已通过两个 checkout、两个 pnpm store 的同一 canonical records hash。
- S3 bundle/artifact trace：真实调用项目依赖图中的 Vite 8.2.2/Rolldown，将合法静态与字面量动态 source edge 对账到最终 bundle module，并对未声明依赖、server SecretRef、跨 target、private export、package escape 以及 missing/extra bundle module 返回稳定失败；CSS、worker、WASM、静态 asset 与 virtual module 也进入 canonical artifact trace。Ubuntu 24.04、macOS 15、Windows 2025 已通过同一双 checkout/双 pnpm store corpus 和 checked-in trace baseline。
- S4 Executable Registry：`ProductGraphV1` 包含 resolved `services`/`events`，`ExecutableRegistryV1` 只从 Graph 派生 entries/bindings/handlers；确定性 Graph→Registry generator、joint `assemblyId`、18 组 pre-factory mismatch 和隔离子进程的 generated-entry `fetch` 顶层副作用 probe 已在 Ubuntu 24.04、macOS 15、Windows 2025 运行同一 frozen corpus 并通过，S4 状态为 Pass。
- S5 lifecycle/Event core：内存 A→B→C→D runner 已冻结串行 factory/start/stop、单一 ready、严格反序 stop、资源账本、启动失败回滚、幂等/并发 stop 与启动中取消；独立 Event runner 已冻结 ready 门控、稳定串行 handler、depth-first 嵌套、correlation/causation、深度 33 拒绝和 stop 前活动 dispatch 排空。9 个 lifecycle 与 5 个 Event 场景已在 Linux、macOS、Windows 对账；S6 已补齐其有界 shutdown 与 host termination 条件。
- S6 Server host spike：exact Fastify 5.12.3 使用真实 `127.0.0.1` loopback listen/fetch，十场景在 Linux、macOS、Windows 均匹配 canonical hash `cf82465d0667b1a58f46bbfa9c2aa65a3247cff53ac11e3d3fcf63590cdd78eb`；closing `503`、活动请求排空、request/background deadline 上报后非零退出和 listen 失败反序回滚均通过。Ubuntu/macOS 通过真实 `SIGTERM`/`SIGINT` 共享停止，Windows 明确记录 Node 平台限制。它仍是实验 runner，不是产品 Server API。
- S7 Database spike：exact `pg`/Kysely/Drizzle 已安装，macOS arm64 与 Ubuntu linux-amd64 runner 对 digest-pinned PostgreSQL `18.6-bookworm` 执行 14 个正反序场景，覆盖三候选 typed query、两 owner schema、advisory lock、transaction/checkpoint/manual/removal、6 个 deadline 和稳定 diagnostics；canonical hash 为 `8e48920e5c1adc8b9cf327ffeeb195dcc48d2c4c8290a7f0822cbf751313df04`，资源余额为零。Kysely 是 query-layer 选择，direct SQL 是退路；这仍不是 production Database adapter。
- S8 UI spike：已安装 exact React/Router/React Aria/Playwright/axe 候选，以同一份 6 routes、7 navigation、4 commands 的可序列化 contributions 编译出 `default-shell` 与结构不同的 `workbench-shell`。Ubuntu 24.04 x64 已执行 Chromium 1243、Firefox 1543 与 WebKit 2359：45 个 route/history/keyboard/focus/touch/compatibility 行为检查、144 个双 Shell×三 viewport×八状态×三浏览器零违规 a11y scan 和 20 个独立 Linux Chromium visual comparison 全部通过；209 passed、40 个非 Chromium visual 按设计 skipped，最新 lock-derived matrix hash 为 `bf2b5b50ac5585a8cc699f0b8091b218def24e2814ec463d9285fd61f41d892f`。人工复核了路由焦点、live announcement 和放大布局。S8 状态为 Pass，但仍不是 production UI。
- 文档验证：检查 JSON、Markdown 本地链接/围栏、RFC baseline、带 `$schema` 的 JSONC 示例和 proposed contract fixtures。

当前没有 CLI、scaffolder、preset expansion、静态 Service/Event provider/handler resolver、declarations-to-Graph adapter、可发布的多工具 resolver adapter API、可用于产品运行的完整 Executable Registry/Runtime host、Web/Server 应用、Identity/Database Kit、部署或客户端包。

## 环境与命令

仓库要求 Node.js 24 和 pnpm 10.32.1。若当前 shell 默认 Node 不是 24，可使用：

```bash
fnm exec --using=24 pnpm install --frozen-lockfile
fnm exec --using=24 pnpm build
fnm exec --using=24 pnpm typecheck
fnm exec --using=24 pnpm test
fnm exec --using=24 pnpm verify:docs
```

## 最小 Compiler API

```ts
import { buildMinimalProductGraphs } from '@blankspace/compiler';

const graphs = buildMinimalProductGraphs({
  frameworkVersion: '0.0.0-dev',
  config: { schemaVersion: '1', product: './product', targets: ['web'] },
  manifest: { schemaVersion: '1', entries: { web: './frontend/index.ts' } },
  modules: [],
});
```

`buildProductDirectoryGraphs({ workspaceRoot, frameworkVersion })` 组合 loader、纯适配器与本函数，形成首个 filesystem-to-Graph 入口。当前流程不会展开 preset、解析 packages、推断 Service/Event、选择 Service provider、生成 Registry 或构建 bundle。底层 builder 仍可接收显式传入的 `services`/`events`，验证 binding/handler 引用的 entry、同 target 重复 Service provider 与重复 handler identity，并把 resolved facts 按 target 写入 ProductGraph；失败通过 `ProductGraphBuildError.diagnostics` 返回稳定 code/path/message。

## Workspace 源码解析 API

```ts
import { resolveSourceImport } from '@blankspace/compiler';

const record = resolveSourceImport({
  workspaceRoot: '/absolute/checkout',
  workspacePackages: ['packages/app', 'packages/editor'],
  importer: 'packages/app/src/index.ts',
  specifier: '@example/editor/notes',
  mode: 'web-dev',
  target: 'web',
  importPolicy: {
    importKind: 'static',
    importer: { ownerId: 'app', target: 'web' },
    resolved: { ownerId: 'editor', target: 'shared' },
  },
});
```

`workspaceRoot` 只用于本次文件检查，不进入 `ResolutionRecordV1`；package identity 来自显式 package root 的 `package.json#name`，resolver 不扫描 `node_modules` 或 pnpm store。当前支持相对 ESM 路径、package root/显式 subpath、单星号 subpath pattern 和嵌套 conditional exports；拒绝未声明 dependency、private export、package escape、大小写漂移、symlink、target 越界、客户端 Node built-in 和 server SecretRef。

`enforceImportPolicy` 将 static 与可静态求值 dynamic import 分类为普通 runtime edge。opaque dynamic import 不生成虚构解析记录；只有显式约束在同一 owner/target 时返回 `opaque-owner-scope`，供 affected tests 扩大到该 owner 的整个 target。`spikes/s2-resolver/` 已实现工具原生 trace 的 conformance runner，但尚未形成 `@blankspace/compiler` 的稳定 API；`#imports`、registry package 和源码 AST 扫描仍未实现。

## 正式与 Proposed 边界

| 位置 | 状态 |
| --- | --- |
| `packages/contracts/schemas/` | 当前正式 V1 schema |
| `packages/contracts/src/` | 当前发布候选 TypeScript contract |
| `packages/compiler/src/` | 当前少量实验实现 |
| `docs/schemas/proposed/` | 设计期契约，不是稳定公共 API |
| `docs/rfcs/` | Proposed 决策，等待实现和验收证据 |
| `docs/spikes/` | 实验矩阵与证据入口 |

## 当前限制

这套实现已经证明确定性 Product Graph 前置切片、使用锁定 `jsonc-parser` 与 Ajv 的三平台生产配置校验、workspace source resolution/import policy、完整 S3 bundle/artifact trace、跨平台 S4 Registry、S5 lifecycle/Event core、有界 S6 Fastify host、S7 Database conformance，以及 Ubuntu 三浏览器 S8 双 Shell conformance。完整 Runtime、production Database、Service provider selection、业务 Kits、生产 UI 与 CLI 仍未完成，因此仍不能创建或运行 SaaS。不要根据 fixture 发布 package、部署生产环境或宣称支持 Desktop/Mobile；Phase 1B 实施必须先新增文档化 work item。
