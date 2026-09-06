# S3：Source Edge 与 Bundle Trace

## 状态

**Matrix frozen（JS module core）**。`A1-S3-01` 已在 macOS arm64 上完成并固化 canonical JS module trace；整个 S3 尚未 Pass，因为 RFC-0013 要求的 CSS、worker、WASM、assets、virtual modules 与 Linux/macOS/Windows 证据仍由 `A1-S3-02` 继续完成。

当前证据：

- Node `24.20.0`；
- pnpm `10.32.1`；
- Vite `8.2.2`，通过 Vitest 的项目依赖图解析，禁止从用户 home/父目录漂移获取 Vite；
- 两个不同 checkout + 两个独立 pnpm store；
- macOS arm64 canonical trace hash：`fc720952e1c552f46d3894077baf1f203fe3c8bc09596cc8f785bbccf3068e2e`；
- transcript：`../../spikes/s3-bundle-trace/transcripts/macos-arm64.json`。

## 要回答的问题

Compiler 能否把声明依赖、真实 source imports 和最终 bundle modules 对账，并证明非法源码边不会因为 tree-shaking 消失而变得“合法”；最终还需要证明未启用 Kit、server Secret 与错误 target 的 JS/CSS/worker/WASM/assets/virtual modules 不会进入可发布产物。

## 已冻结的 JS module contract

当前 runner 位于 `../../spikes/s3-bundle-trace/`：

```text
ResolutionRecord V1
→ Vite production build
→ Rolldown chunk.modules
→ workspace-relative logical path
→ strip non-semantic Rolldown //#region path annotations
→ canonical rendered-code hash
→ source edge / bundle module reconciliation
```

Trace 不保存 checkout 绝对路径、`node_modules`、pnpm store realpath 或 Windows `\` 路径。观察 fixture 固定无内容 hash 的 chunk 文件名，避免把 Vite 的机器相关 content-addressed filename 当作公共 Contract；真正用于确定性比较的是 logical module identity 与 canonical rendered-code hash。

Rolldown 当前会在 rendered module code 中注入包含 checkout 路径的 `//#region ...` 调试注释。该注释不影响可执行语义，因此 canonicalizer 明确剥离 `//#region` / `//#endregion` 后再计算 module content hash。除此之外发现新的机器相关内容时必须新增显式规则和 regression fixture，不能笼统删除任意“不稳定字段”。

## 当前 fixture matrix

| 场景 | 当前结果 |
| --- | --- |
| public 静态 import | Pass；source edge 与最终 bundle module 对账 |
| literal dynamic import | Pass；独立 chunk 中 module 可追踪 |
| 未声明 workspace package | Compiler `E_UNDECLARED_DEPENDENCY`，bundler 前失败 |
| Web 导入 server SecretRef | Compiler `E_TARGET_BOUNDARY`，bundler 前失败 |
| Web 导入 server target | Compiler `E_TARGET_BOUNDARY`，bundler 前失败 |
| private export | Compiler `E_PRIVATE_EXPORT`，bundler 前失败 |
| package export escape | Compiler `E_PACKAGE_ESCAPE`，bundler 前失败 |
| Graph/source edge 声明但 bundle module 缺失 | reconciliation `E_BUNDLE_MODULE_MISSING` |
| bundle 出现未声明 workspace module | reconciliation `E_BUNDLE_MODULE_EXTRA` |
| 同一输入换 checkout/store | canonical trace identity 相同 |

`public-static` 还覆盖 browser conditional export，因此最终 bundle module 必须继续与 S2 的 `web-build` ResolutionRecord 一致。

## A1-S3-02：仍需完成的完整 S3 矩阵

RFC-0013 要求 bundler adapter 检查全部最终产物，因此下一工作项继续冻结：

| Artifact class | 必须证明 |
| --- | --- |
| JS chunks/modules | 当前 core 已冻结；扩展到完整 source edge set 与未启用 package 裁剪 |
| CSS | CSS import、CSS module/asset reference 能映射到 owner/target，错误 target 不进入产物 |
| Worker | worker entry/chunk 有独立 identity，不能绕过 Web/source policy |
| WASM | WASM artifact 与 loader/module edge 可关联，hash 和路径确定 |
| Static assets | SVG/PNG/font 等有 logical owner、artifact identity 与 content hash |
| Virtual modules | Vite virtual module 必须有稳定 adapter-owned identity，不能记录临时绝对路径 |

同时在 Linux、macOS、Windows 上运行同一 common corpus。允许真实平台差异，但差异必须是 trace schema 中显式、可解释的字段；不能以 OS 为理由跳过 canonical comparison。

## 工具与供应链约束

Vite 必须从当前仓库已经锁定的依赖图解析。runner 不能使用父目录、全局安装或用户 home 中偶然存在的 Vite。新增分析器或 runtime dependency 前先完成 `supply-chain.md` 的依赖审查；若 Vite/Rolldown 无法提供稳定的完整 artifact trace，只替换 bundler/analysis adapter，不把 Product Compiler 降级为 Vite-only plugin。

## 运行命令

```bash
fnm exec --using=24 pnpm test:s3
fnm exec --using=24 pnpm build
fnm exec --using=24 pnpm typecheck
fnm exec --using=24 pnpm test
fnm exec --using=24 pnpm verify:docs
```

`A1-S3-01` 的 macOS 证据为：109 个 Vitest、8 个 S1、4 个 S2、5 个 S3 tests，以及 build、typecheck、verify:docs 全部通过。

## Pass 条件与失败选择

S3 只有在以下条件全部满足后才能从 `matrix-frozen` 推进为 `pass`：

1. Compiler 对全部非法 source edge 在 bundler 前失败；
2. JS/CSS/worker/WASM/assets/virtual modules 均进入可检查的 canonical artifact trace；
3. source edge、启用能力与最终 artifact 可双向发现缺失/额外内容；
4. canonical trace 不包含机器路径或 pnpm store identity；
5. Linux、macOS、Windows 要求矩阵通过；
6. S2 frozen corpus 无回归。

若最终候选 Vite/Rolldown 无法提供稳定、足够完整的观察面，按 RFC-0013 更换 bundler/分析器，而不是降低 Compiler 的 source-boundary 要求。

最终绝对 bundle 预算仍按 `budgets/phase-1.md` 在 S1～S7 通过后冻结，不属于 S3 当前工作项。
