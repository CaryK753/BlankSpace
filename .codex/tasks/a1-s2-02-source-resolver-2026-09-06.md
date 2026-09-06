# A1-S2-02 Package exports 与相对源码解析

日期：2026-09-06

## 目标

实现只解析 workspace 源码的 Compiler resolver core：读取显式登记的 package roots，解析相对 ESM 路径与 `package.json#exports`，在执行任何产品代码前拒绝 private、undeclared、escaping 和大小写漂移。

## TODO

- [x] 复核 A1-S2-02、S2 matrix、现有 ResolutionRecord 与供应链边界
- [x] 核对 AFFiNE wildcard exports 和 Node.js 24 官方 exports/conditions 语义
- [x] 建立最小 fixture workspace
- [x] 实现相对路径、package exports 与稳定 diagnostics
- [x] 覆盖条件 exports、wildcard、private、undeclared、escape、case 与跨 checkout 确定性
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新 work item evidence、S2 Spike 与 project status

## 实现边界

- 输入显式提供 workspace root 和 package roots；不扫描 pnpm store 或 `node_modules`。
- 支持相对 ESM specifier、package root、显式 subpath、单星号 subpath pattern、嵌套 conditional exports。
- package target 必须是 package 内 `./` 路径；relative `.js` 到同名 `.ts`/`.tsx` 是唯一 source substitution。
- 不解析 symlink；在访问目标前以 `E_SYMLINK_ESCAPE` 拒绝。不实现 `#imports`、registry 下载、Vite/TypeScript/Vitest adapter、target policy、bundle trace 或 Runtime import。

## 当前状态

已完成。`A1-S2-02` 已标为 `done`，`A1-S2-03` 已解锁为唯一 `ready` 工作项；S2 仍保持 Matrix frozen。

## 验证证据

环境：macOS 27.0（26A5425a）、Node.js v24.20.0、pnpm 10.32.1。

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：92 个 Vitest 用例与 8 个 S1 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

未执行：target boundary、dynamic import policy、`#imports`、registry package、工具 adapters、跨 OS 与多 pnpm store matrix；这些属于后续 A1-S2-03～04 或重新冻结的工作项。
