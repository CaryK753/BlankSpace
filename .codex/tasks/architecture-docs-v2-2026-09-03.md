# Blankspace 架构文档第二版

日期：2026-09-03

## 目标

根据项目讨论和对 AFFiNE 当前源码的定向研究，重构 Blankspace 文档，使其准确表达通用 SaaS 框架定位、分层、Kit 组合、Product Module、Workspace Provider 与 local-first 能力，同时主动删除过度设计。

## 已确认决策

- Blankspace 采用 `Foundation + Optional Kits + Product Overlay` 分层。
- Blankspace 面向广泛 SaaS 产品，能力上限应足以构建 AFFiNE 级完整产品。
- local-first 是框架提供的基础能力，但产品或数据域可以不启用。
- Product Module 以目录作为日常开发和组织单位。
- Kit 由开发者按产品需要启用，外部系统通过 adapter 配置。
- Kit 间同步交互使用类型化 Service，事实通知使用 Event。
- 跨 Kit 产品流程由 Product Overlay 中的普通 TypeScript Coordinator 编排。
- 第一版不引入 Command Bus、Query Bus、Workflow DSL、Saga DSL 或统一 Operation 抽象。
- AFFiNE 的 Workspace 采用 flavour/provider 模型；Local Workspace 与 Cloud Workspace 是不同 provider 管理的 Workspace，local → cloud 是迁移而非绑定。

## TODO

- [x] 重写 README 中的定位、分层和开发体验
- [x] 重写总体架构文档
- [x] 新增 Optional Kit 设计文档
- [x] 修订 Product Module 规范和交互边界
- [x] 修订 AFFiNE 研究中的 Workspace/Server 结论
- [x] 调整开发路线图和首批 RFC
- [x] 从使用者视角定义黄金路径和开发者体验
- [x] 定义上游升级与兼容性契约
- [x] 定义 AI 编程所需的机器可读接口和安全边界
- [x] 将开发者体验约束回写 README、架构、Kit 和路线图
- [x] 检查术语、链接和 Markdown 结构
- [x] 完成无上下文读者测试并修正盲点

## 2026-09-04 追加视角

以独立开发者或小团队为主要使用者：希望在数小时内得到完整可运行的产品骨架，只修改产品拥有区域而不 fork 框架，并能通过可预检、可回滚、可自动迁移的流程升级 Blankspace。AI 编程代理应能从机器可读契约理解项目、生成模块、执行校验和解释兼容性问题。

## 非目标

- 不实现框架代码。
- 不确定最终语言、数据库、Web 框架或桌面容器。
- 不把 AFFiNE 当前实现逐字复制为 Blankspace API。
- 不提前设计尚无真实需求支撑的扩展市场和分布式工作流系统。
