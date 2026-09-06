# Framework Package 发布与 npm/pnpm 分发

## 1. 定位

Blankspace 仓库使用 pnpm workspace 开发，但面向下游产品的 JavaScript/TypeScript 框架包通过标准 npm registry 协议分发。`pnpm` 是推荐开发工具，不是新的包格式；下游使用 npm、pnpm 或其他兼容客户端时，消费的是相同的 registry tarball、exports、类型声明和 provenance。

当前仓库尚未允许公开发布。本文只冻结发布目标与门禁，实际 publish workflow 必须等 Phase 1C 的供应链与 SC1 门禁通过。

## 2. 包边界

首批可发布 package 预计包括：

```text
@blankspace/contracts
@blankspace/compiler
@blankspace/foundation          # 后续
@blankspace/runtime-web         # 后续
@blankspace/runtime-server      # 后续
@blankspace/kit-*               # 对应 Kit 通过独立 gate 后
@blankspace/adapter-*           # 对应 adapter 通过 conformance 后
```

仓库根 package 保持 `private: true`，reference products、fixtures、spikes 和内部 release tools 默认不得被 publish。

## 3. workspace 到 registry artifact

发布必须验证的是最终 tarball，而不是本地 workspace symlink：

```text
workspace source
→ build/typecheck/test
→ package manifest validation
→ npm-compatible pack
→ inspect tarball file list / exports / types / license
→ install tarball into clean consumer fixture
→ run public API smoke
→ generate SBOM/provenance/digest
→ publish immutable version
```

`workspace:*` 只允许存在于仓库内部依赖声明；进入 registry artifact 前必须被转换为合法的发布版本约束，并验证最终 tarball 不包含本地绝对路径、workspace-only entry 或未构建源码泄漏。

## 4. package.json 最低要求

可发布 package 至少明确：

- `name`、`version`、`type`；
- `exports` 与类型入口；
- `files` allowlist；
- `engines`；
- `license`；
- `repository`；
- runtime / peer / optional dependency 分类；
- `sideEffects`（适用时）；
- publish access 与 provenance policy。

禁止通过 deep import 依赖未导出的 `dist/internal/*`。公共 export 是兼容性边界，升级工具与 conformance fixture 都应以它为准。

## 5. 版本策略

Framework、Kit 和 adapter 使用 SemVer。进入稳定发布前可以使用 `0.x` 与 prerelease channel：

```text
0.1.0-canary.42
0.1.0-beta.3
0.1.0
```

同一个 package/version 只能对应一个 source revision 和一个 tarball digest。撤销版本不允许重新发布不同内容；修复必须产生新版本。

多 package 发布是否采用 lockstep 版本或独立版本，在真正出现多个稳定 package 后通过 release spike 冻结。无论哪种模式，ReleaseCandidate 必须保存精确 package graph 与 digest。

## 6. dist-tag 与 channel

目标 npm dist-tag：

- `canary`：高频验证，不形成稳定兼容承诺；
- `next`：beta / release candidate；
- `latest`：稳定版本。

产品脚手架和升级工具不得把浮动 dist-tag 写入 production lock；tag 只用于发现候选，最终安装结果由 package lock 与 `blankspace.lock` 固定。

## 7. pnpm/npm consumer conformance

公开发布前至少使用两个干净 consumer fixture 验证：

1. pnpm 安装 tarball/registry candidate；
2. npm 安装同一 artifact。

验证内容包括：

- ESM import；
- TypeScript types；
- declared exports；
- tree-shaking / side-effect 行为（相关包）；
- Node 24 engine；
- 没有 workspace-only dependency；
- lockfile 可稳定解析；
- package 内容与本地 build 预期一致。

是否扩展到 Yarn/Bun 由真实用户需求决定，不在 Phase 1 默认承诺。

## 8. provenance、权限与凭据

发布 job 必须与普通 PR 隔离，并满足 `supply-chain.md`：

- 从受保护、已审查的精确 revision 发布；
- 使用短期 registry 身份/OIDC（registry 支持时优先）；
- 生成 tarball digest、SBOM 与 provenance；
- 发布后重新读取 registry artifact 并核对 digest/metadata；
- package publish 权限与应用部署权限分离；
- 不在本地开发机或普通 CI job 长期保存 npm token。

## 9. 发布失败与撤销

Registry publish 属于不可逆外部副作用。失败重试前必须先 reconcile registry 状态；如果版本已经成功存在，不得再次覆盖。

发现严重漏洞时优先：发布修复版本、更新撤销/denylist 和升级建议。`npm deprecate` 可作为用户提示，但不能替代 Blankspace 自己的机器可读撤销清单和 compatibility policy。

## 10. 实施门禁

在以下条件满足前保持 package publication No-Go：

- 根许可证与 package license 已冻结；
- dependency review baseline 完成；
- pack/consumer fixture 已实现；
- package exports compatibility gate 已实现；
- SBOM/provenance 方案完成；
- SC1 在真实 registry 上通过可信发布、错误 revision、重放与撤销矩阵；
- registry namespace 与 maintainer 权限完成审计。

当前仅 `@blankspace/contracts` 与 `@blankspace/compiler` 具备未来 package 化雏形，但尚不代表可以发布。
