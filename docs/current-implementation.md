# 当前实现参考

本页只描述仓库现在可以运行的内容。未来产品体验见[入门目标](getting-started.md)，机器状态见 [`status/project-status.json`](status/project-status.json)。两者冲突时，以源码、正式 schema、测试和状态文件为准。

准备开始贡献代码的 Agent 应从[Agent 启动入口](agent-start-here.md)读取当前唯一可领取工作项，而不是从本页推断任务。

## 当前可以运行

- `@blankspace/contracts`：导出 `RuntimeTarget`、`ProductGraphV1` 与 `ResolutionRecordV1` TypeScript 类型；正式 JSON Schema 覆盖 root config、product manifest、module、Product Graph V1、Resolution Record V1 与 RFC baseline。
- `@blankspace/compiler`：提供严格 JSONC 解析/canonical hash、只消费内存输入的 `buildMinimalProductGraphs`，以及解析显式 workspace package roots 的 `resolveSourceImport`。
- S2 conformance runner：真实调用 TypeScript、Node、Vite 与 Vitest，将五种 mode 的原生结果归一为逻辑路径并与 Compiler record 逐边对账；Linux、macOS、Windows 均已通过两个 checkout、两个 pnpm store 的同一 canonical records hash。
- 文档验证：检查 JSON、Markdown 本地链接/围栏、RFC baseline、带 `$schema` 的 JSONC 示例和 proposed contract fixtures。

当前没有 CLI、scaffolder、preset expansion、可发布的多工具 resolver adapter API、Executable Registry、Runtime host、Web/Server 应用、Identity/Database Kit、部署或客户端包。

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

输入不是文件路径入口；调用方必须自己提供已解析的对象。当前函数不会展开 preset、读取 Module 文件、解析 packages、生成 Registry 或构建 bundle。失败只覆盖非法 entry 路径、重复 Module ID 和 target 没有 entry，并通过 `ProductGraphBuildError.diagnostics` 返回稳定 code/path/message。

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

这套实现只证明确定性 Product Graph、workspace source resolution 和 import policy 的前置切片，不能创建或运行 SaaS。不要根据目标 CLI 示例发布 package、部署生产环境或宣称支持 Desktop/Mobile。下一条实现路径见 [Phase 1 蓝图](phase-1-blueprint.md)。
