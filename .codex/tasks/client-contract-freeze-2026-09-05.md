# 多客户端机器契约冻结草案

日期：2026-09-05

## 目标

将 RFC-0017 冻结门禁中的叙述性规则转换为可严格编译的 Proposed JSON Schema，并补充最小正反 fixtures 与文档验证；不改变 Phase 1 已发布 schema。

## TODO

- [x] 冻结 Runtime、Renderer、UI Feature、Shell 与 Capability manifest 草案
- [x] 冻结 ProductGraphV2 与 Assembly Index 草案
- [x] 冻结 Design System、Theme IR 与 Theme Result 草案
- [x] 冻结 Lock V2、Compatibility Manifest 与 Upgrade Plan 草案
- [x] 冻结 Request Transcript 与 canonicalization 草案
- [x] 补充文档阶段最小 schema 正反 fixtures 和语义校验（9 cases；真实跨工具链 corpus 归入 CR1/DS1 实施门禁）
- [x] 同步 RFC-0015～0017、CR1、DS1、升级与测试文档
- [x] 执行无上下文读者测试并修正中高问题（最终读者测试完成；修复 SupportEvaluationRecord、multi-distribution lock 与 generic/specific selector overlap。读者指出的真实工具链证据缺口已转化为 CR1/DS1 明确的端到端阶段、失败 corpus 和 Accepted 门禁，不再属于文档歧义）
- [x] 运行文档、schema、S1 和 TypeScript 范围验证

## 当前验证

- `npm run verify:docs`：当前全库 65 Markdown、20 JSONC、16 Proposed Schema、17 RFC baseline、9 proposed client fixtures 全部通过；
- `npm run test:s1`：8/8；
- `python3 spikes/s1-config/validate_schemas.py`：14 corpus cases；
- `npm run typecheck`：通过；为 Compiler 子项目补充显式 Node type environment，未使用 `skipLibCheck` 等放行开关。

## 尚未完成

- [ ] 在真实 SwiftPM/Xcode、Gradle、Electron 与 Capacitor 工具链上执行 CR1；
- [ ] 用四类 Renderer 执行 DS1，并补齐每类 schema 的正反与端到端 fixtures；
- [ ] 只有上述 evidence 通过并经维护者评审后，才把 Proposed schemas 迁入正式 contracts 并将 RFC 标为 Accepted。

## 边界

- 所有新增 schema 位于 `docs/schemas/proposed/client-runtime/`；
- 未通过 spike、fixtures 与维护者评审前不得迁入 `packages/contracts/schemas/`；
- 不修改 Phase 1 `ProductGraphV1`、product config 或 module schema；
- 不实现 Xcode、Gradle、Electron 或 Capacitor Runtime。
