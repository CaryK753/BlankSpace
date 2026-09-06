# S3：Source Edge 与 Bundle Trace

## 状态

**Pass**。`A1-S3-01` 冻结了 canonical JS module trace core，`A1-S3-02` 已补齐 CSS、worker、WASM、静态 assets、virtual modules 和 Linux/macOS/Windows 跨平台证据。S3 现在作为 Phase 1A 的持续回归门保留。

最终证据：

- Node `24.20.0`；
- pnpm `10.32.1`；
- Vite `8.2.2`，通过 Vitest 的项目依赖图解析，禁止从用户 home/父目录漂移获取 Vite；
- 每个平台内部使用两个不同 checkout + 两个独立 pnpm store；
- canonical trace hash：`855f208dd81cd0106e618cf6fc16aefc822afa084aaaf20bce355d6c06da0c14`；
- macOS baseline transcript：`../../spikes/s3-bundle-trace/transcripts/macos-arm64.json`；
- GitHub Actions run `34022590661`：`ubuntu-24.04`、`macos-15`、`windows-2025` 全部通过同一 S3 corpus；
- Windows 行尾差异通过仓库 `.gitattributes` 的 LF policy 与 trace 层 CRLF→LF canonicalization 消除，WASM 等二进制仍按原始字节哈希。

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

## A1-S3-02：完整 artifact matrix

RFC-0013 要求 bundler adapter 检查全部最终产物。当前固定 corpus 已覆盖：

| Artifact class | 已验证内容 |
| --- | --- |
| JS chunks/modules | source edge → bundle module 对账、static/literal dynamic import、missing/extra module |
| CSS | 独立 CSS output 可观察、来源 identity 与 content hash 稳定 |
| Worker | worker entry 具有稳定 source identity 与独立 output hash |
| WASM | WASM 作为二进制 artifact 按原始字节哈希并保持稳定路径 identity |
| Static assets | SVG fixture 具有稳定 logical source identity、artifact path 与 content hash |
| Virtual modules | Vite virtual module 使用 adapter-owned `virtual:blankspace-s3` identity，不记录临时绝对路径 |

Linux、macOS、Windows 均运行同一 common corpus，并必须直接匹配 checked-in canonical fixtures/artifacts。平台文件系统或文本行尾差异不能通过跳过比较来规避，只允许在 canonicalization 规则中明确解释并回归测试。

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

最终本地回归为：109 个 Vitest、8 个 S1、4 个 S2、7 个 S3 tests，以及 build、typecheck、verify:docs 全部通过；跨平台证据由 GitHub Actions run `34022590661` 提供。

## Pass 条件与失败选择

S3 已满足以下 Pass 条件，后续任一项回归都应阻止对应提交/发布：

1. Compiler 对全部非法 source edge 在 bundler 前失败；
2. JS/CSS/worker/WASM/assets/virtual modules 均进入可检查的 canonical artifact trace；
3. source edge、启用能力与最终 artifact 可双向发现缺失/额外内容；
4. canonical trace 不包含机器路径或 pnpm store identity；
5. Linux、macOS、Windows 要求矩阵通过；
6. S2 frozen corpus 无回归。

若最终候选 Vite/Rolldown 无法提供稳定、足够完整的观察面，按 RFC-0013 更换 bundler/分析器，而不是降低 Compiler 的 source-boundary 要求。

最终绝对 bundle 预算仍按 `budgets/phase-1.md` 在 S1～S7 通过后冻结，不属于 S3 当前工作项。
