# SaaS 核心契约收口

日期：2026-09-06

## 目标

在不冻结单一用户/组织模型、不重复实现成熟引擎的前提下，补齐认证与授权组合、Phase 1 API、可靠异步、支付 adapter 与生产门禁设计，并纳入 Waffo Pancake 候选。

## TODO

- [x] 核对 Waffo Pancake 官方 API、checkout、webhook 与环境边界
- [x] 核对 Better Auth、OpenFGA、SpiceDB、Casbin 的官方能力和许可证
- [x] 冻结 Identity / Product Principal / Authorization 的职责边界
- [x] 补充 Phase 1 API Contract 与可靠异步最小契约
- [x] 补充 Billing/Payment provider-neutral 设计与 Waffo adapter 要求
- [x] 补充 Production Readiness Gate 和 Phase 5 可判定门禁
- [x] 更新索引、路线图、台账和 RFC 基线
- [x] 运行验证并执行无背景复核

## 状态

已完成。两轮无背景复核发现的 preset 强制 Workspace、外部授权一致性、Billing actor、API 幂等、Phase applicability、许可证、ProductionReport、Actor 类型、一次性支付状态和 outbound 未知结果均已关闭；最终无中高严重度问题。
