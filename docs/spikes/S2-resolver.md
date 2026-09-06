# S2：统一 Module Resolver

## 状态

Provisional pass：macOS matrix 已执行，Linux 与 Windows 尚未执行。

冻结日期：2026-09-04。

## 问题

同一条 import 可能被 TypeScript、Node.js、Vite dev、Vite build 和 Vitest 解析到不同文件。Blankspace 不能把某个工具的偶然行为当成产品边界；Compiler 必须先得到一个逻辑解析结果，各 adapter 只能证明自己的实际结果与它一致，或报告被允许且可解释的差异。

## 单一解析记录

每条被检查的 import 生成 `ResolutionRecordV1`：

```ts
interface ResolutionRecordV1 {
  importer: string;
  specifier: string;
  mode: 'type' | 'web-dev' | 'web-build' | 'server' | 'test';
  target: 'shared' | 'web' | 'server';
  packageIdentity?: string;
  exportSubpath?: string;
  logicalPath?: string;
  format: 'esm' | 'json' | 'asset' | 'external';
  conditions: string[];
  external: boolean;
}
```

记录只保存 workspace 相对逻辑路径和 package identity，不保存 checkout、pnpm virtual store 或 realpath。source map、chunk 和 asset 的最终归属由 S3 记录。

## 固定解析矩阵

| 模式 | 主执行者 | Conditions | 允许输入 | Externalization |
| --- | --- | --- | --- | --- |
| `type` | TypeScript NodeNext | `types`, `import`, `default` | `.ts`, `.tsx`, `.d.ts`, package exports | 仅产生类型证据，不产生 runtime edge |
| `web-dev` | Vite adapter | `browser`, `development`, `import`, `default` | 浏览器 ESM、显式 asset query | Node built-ins 与 server packages 禁止 |
| `web-build` | Vite/Rollup adapter | `browser`, `production`, `import`, `default` | 与 web-dev 相同公开入口 | 仅 allowlist 的平台依赖可 external |
| `server` | Node adapter | `node`, `import`, `default` | Node ESM、JSON import attribute | Node built-ins external，其余依规则解析 |
| `test` | Vitest adapter | target conditions + `test` | 必须声明 fixture target | 不允许 mock alias 改写被测公开入口 |

Conditions 顺序是协议的一部分。`types` 只服务于类型解析；若 runtime conditions 下不存在对应 export，Compiler 必须失败。

## 统一规则

1. 相对源码 import 必须写 Node ESM 可执行的扩展名；TypeScript 源码中的 `.js` 映射到同名 `.ts`/`.tsx` 只是一条显式 source substitution。
2. 跨 package 只能经过 `package.json#exports`；禁止 deep import 到未导出的 `src`、`internal` 或生成目录。
3. `#imports` 只能在声明它的 package 内使用，并进入 trace；产品级 alias 不得伪装 package 公共 API。
4. workspace package identity 来自 package name 与 lock entry，不来自 symlink realpath。
5. `shared` 不得解析 browser、Node built-in、server implementation 或含 server SecretRef 的入口。
6. type-only import 仍检查 exports 和 public boundary，但不进入 runtime closure。
7. 不能静态求值的 dynamic import 禁止跨 Module/Kit internal；同一 owner 内标记为 opaque，并让 affected tests 扩大到整个 target。
8. 大小写必须与磁盘和声明完全一致；在大小写不敏感文件系统也按严格规则失败。

## Fixture Corpus

每个 fixture 必须在五种模式记录 resolver 结果和失败代码。

| Fixture | 预期 |
| --- | --- |
| package root 与显式公开 subpath | 所有适用 runtime 唯一解析 |
| conditional `browser`/`node` exports | web 与 server 合法解析到不同逻辑入口 |
| `types` export 存在但 runtime export 缺失 | `E_RUNTIME_EXPORT_MISSING` |
| package internal/deep import | `E_PRIVATE_EXPORT` |
| web import Node built-in 或 server entry | `E_TARGET_BOUNDARY` |
| shared import web/server implementation | `E_SHARED_BOUNDARY` |
| 未声明 dependency，pnpm store 恰好可见 | `E_UNDECLARED_DEPENDENCY` |
| 大小写错误路径 | `E_PATH_CASE_MISMATCH` |
| package export 指向 package 根目录外 | `E_PACKAGE_ESCAPE` |
| symlink 越过 owner/root | `E_SYMLINK_ESCAPE` |
| static dynamic import | 产生普通 runtime edge |
| 非静态跨 owner dynamic import | `E_DYNAMIC_IMPORT_BOUNDARY` |
| test-only alias 替换公开 package | `E_TEST_RESOLUTION_DRIFT` |
| CSS/worker/WASM/asset import | S2 仅分类，交给 S3 验证最终 trace |

## 允许的差异

只有 package exports 明确表达的 condition 分支、开发/生产 mode 分支和 server built-in externalization 可以不同。差异必须同时记录选择的 condition、package identity 和逻辑路径。alias 命中顺序、extension guessing、hoist 可见性或测试 mock 导致的差异均不允许。

## 通过标准

- 所有合法 fixture 在对应模式唯一解析，所有非法 fixture 在加载或打包代码前以稳定错误码失败；
- web-dev 与 web-build 除明确 development/production export 外逻辑一致；
- test 使用被测 target 的解析规则，不形成第三套产品语义；
- 两个 checkout 目录、至少两个 pnpm store-dir 产生相同规范化记录；
- Linux、macOS 与 Windows runner 均执行同一 corpus；结果一致，且 Windows 路径分隔符和盘符不进入记录；
- 工具原生 trace 与 Compiler record 可以逐边对账，无法对账即失败而非 warning。

## 失败决策

- 若 Vite dev/build 无法对账，先收窄 adapter 或禁用造成漂移的 alias/plugin；仍失败则淘汰 Vite。
- 若 Vitest 必须使用不同公开解析，改用生产 adapter 驱动测试；不保留隐式兼容。
- 若 pnpm realpath 持续污染结果，所有路径先映射为 lock identity；无法稳定映射则重开 package manager 决策。
- 若 TypeScript NodeNext 与 runtime exports 无法保持一致，runtime 结果优先，类型解析只能作为额外检查。

## A1-S2-01 批次证据

2026-09-06 在 macOS 27.0（26A5425a）、Node.js v24.20.0、pnpm 10.32.1 上完成 ResolutionRecord V1 canonical Schema、同构 TypeScript 类型和纯规范化函数。

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：74 个 Vitest 用例与 8 个 S1 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

本批次覆盖固定 condition 顺序、输入顺序不变性、package/external shape，以及绝对路径、Windows drive、反斜杠、URL、父级穿越、空 segment、`.pnpm` 和 `node_modules` 拒绝。它没有执行文件系统/package resolver、工具 adapter、symlink 或跨 OS/pnpm store matrix，因此 S2 状态仍为 Matrix frozen。

## A1-S2-02 批次证据

2026-09-06 在 macOS 27.0（26A5425a）、Node.js v24.20.0、pnpm 10.32.1 上完成显式 workspace package roots 的相对 ESM 与 package exports resolver core。

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：92 个 Vitest 用例与 8 个 S1 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

fixture 覆盖 package root、显式与 wildcard subpath、condition 键顺序、nested conditions、`.js` 到 `.ts`/`.tsx` source substitution、private/undeclared/runtime-missing exports、package escape、大小写、symlink、package roots 顺序与跨 checkout 确定性。resolver 不扫描 `node_modules` 或 pnpm store，因此记录不携带其 realpath。

本批次尚未实现 target boundary、dynamic import policy、`#imports`、registry packages 或 TypeScript/Node/Vite/Vitest adapters，也没有执行 Linux/Windows 和多 pnpm store matrix；S2 继续保持 Matrix frozen。

## A1-S2-03 批次证据

2026-09-06 在 macOS 27.0（26A5425a）、Node.js v24.20.0、pnpm 10.32.1 上完成纯 target/dynamic import policy，并把 static 与 dynamic-static policy 接入 workspace source resolver。

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：109 个 Vitest 用例与 8 个 S1 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

fixture 覆盖 web/server 可依赖 shared、shared 不可依赖 web/server、web/server 双向隔离、Node built-in 仅 server external、server SecretRef 不进入 web/shared、resolution target 对账、static dynamic 普通 edge，以及 opaque dynamic 同 owner/target affected scope。失败完整冻结为 `E_TARGET_BOUNDARY`、`E_SHARED_BOUNDARY` 与 `E_DYNAMIC_IMPORT_BOUNDARY` 的 code/path。

本批次不扫描源码 AST；import kind、owner、target 和 SecretRef evidence 由未来 adapter/Graph 调用方显式提供。TypeScript/Node/Vite/Vitest adapter、test alias drift、Linux/Windows 和多 pnpm store matrix 尚未执行，因此 S2 继续保持 Matrix frozen。

## A1-S2-04 macOS 批次证据

2026-09-06 在 macOS 27.0（26A5425a）、arm64、Node.js v24.20.0 和 pnpm 10.32.1 上，真实调用 TypeScript 5.9.3、Node、Vite 8.2.2 与 Vitest 4.1.11，完成 `type`、`web-dev`、`web-build`、`server`、`test` 五种 mode 的逐边对账。

- package root、公开 subpath 和 server Node built-in 共生成 11 条 canonical edges；
- 同一 corpus 在两个不同 checkout 目录、两个隔离的 pnpm store-dir 中执行，records hash 均为 `71652e6c253cd52cfcd0dde6a97314ab1e389548396f6269d81fcb51bda0a969`；
- transcript 位于 `spikes/s2-resolver/transcripts/macos-arm64.json`，不含绝对路径、盘符、反斜杠、`node_modules` 或 pnpm store realpath；
- Vitest test-only alias 替换公开 package 时，原生解析与 Compiler record 的差异以 `E_TEST_RESOLUTION_DRIFT` 失败；
- Vite 从已声明的 Vitest peer 边界定位到 lockfile 的 8.2.2，不使用可能命中 checkout 外祖先目录中其他 Vite 版本的裸解析；
- `fnm exec --using=24 pnpm test:s2`：4 个 Node test 通过；
- 完整 `pnpm test`：109 个 Vitest、8 个 S1 与 4 个 S2 用例通过；`pnpm build` 与 `pnpm typecheck` 同时通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

Linux 与 Windows 仍为未运行。Docker daemon 已启动并可被只读探测，但当前任务执行策略阻止 `docker pull` 和 `docker run`，且不允许在任务内申请额外授权；本机也没有 Windows runner。因此 S2 只推进到 Provisional pass，A1-S2-04 保持 `in-progress`，不得标为完成。

仓库已准备 `.github/workflows/s2-conformance.yml`，使用固定 commit SHA 的 checkout/setup-node actions，在 `ubuntu-24.04`、`macos-15` 和 `windows-2025` 上运行同一 `pnpm test:s2`。该 workflow 只有进入远端并实际成功后才能作为跨 OS 证据；文件存在本身不推进状态。
