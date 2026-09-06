# A1-S2-03 Target boundary 与 dynamic import policy

日期：2026-09-06

## 目标

在 Compiler 中建立纯 target import policy，并接入 workspace source resolver：阻止 shared/web/server 越界、Node built-in 与 server SecretRef 进入客户端边界，并对 static、可静态求值 dynamic、opaque dynamic import 给出稳定分类和 diagnostics。

## TODO

- [x] 阅读 A1-S2-03、S2 Resolver Matrix、安全模型和现有 resolver
- [x] 冻结 owner/target/SecretRef 与 import kind 的显式策略输入
- [x] 实现纯 import policy 与稳定 S2 diagnostics
- [x] 将 static/dynamic-static 策略接入 source resolver，并支持 Node built-in external
- [x] 增加 target、SecretRef、dynamic import 正反 fixtures
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新 work item evidence、S2 Spike 与 project status

## 边界

- 不扫描源码 AST；未来 adapter 负责区分 static、dynamic-static 和 dynamic-opaque。
- 不从目录名推断 Module/Kit owner 或 target；调用方显式提供已编译边界元数据。
- 不检查 bundle output，不实现测试 alias 对账、Vite/TypeScript/Vitest adapter 或 Runtime。
- opaque dynamic import 不产生虚构的 ResolutionRecord；同 owner 时返回 affected owner/target scope，跨 owner 或 owner 未知时失败。

## 当前状态

已完成。`A1-S2-03` 已标为 `done`，`A1-S2-04` 已解锁为唯一 `ready` 工作项；S2 仍保持 Matrix frozen。

## 验证证据

环境：macOS 27.0（26A5425a）、Node.js v24.20.0、pnpm 10.32.1。

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：109 个 Vitest 用例与 8 个 S1 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

未执行：源码 AST 扫描、test alias 对账、TypeScript/Node/Vite/Vitest adapters、跨 OS 与多 pnpm store matrix；这些属于 A1-S2-04。
