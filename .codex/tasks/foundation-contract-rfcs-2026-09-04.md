# Foundation Contract RFC

日期：2026-09-04

## 目标

将 Foundation、Kit Contract、Product Directory 和 Product Graph 固化为能够驱动 Phase 1 原型的最小公共契约。

## TODO

- [x] RFC-0001：Foundation 最小边界与生命周期
- [x] RFC-0002：Kit、Service 与 Event Contract
- [x] RFC-0003：Product Directory 与 Module Boundary
- [x] RFC-0004：Product Graph 与 Runtime Entries
- [x] 更新 RFC 索引、总体架构和路线图
- [x] 检查跨 RFC 契约、链接与 Markdown
- [x] 完成无上下文实现者测试并修正问题

## 约束

- Foundation 不包含任何 SaaS 领域概念。
- 第一版只有 Service、Event、Product Coordinator 三种交互方式。
- 不提前决定 UI 框架、数据库、Web Server 或依赖注入库。
- 所有隐式装配结果必须进入可检查的 Product Graph。
