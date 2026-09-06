# Contributing to Blankspace

Blankspace 当前处于架构设计和 Phase 1A spike 阶段。开始贡献前请阅读：

1. [完整文档索引](docs/README.md)
2. [Agent 从这里开始](docs/agent-start-here.md)
3. [当前实现参考](docs/current-implementation.md)
4. [Phase 1A 可执行工作项](docs/implementation/phase-1a-work-items.json)
5. [框架贡献指南](docs/contributing.md)
6. [验证策略](docs/testing-strategy.md)
7. [RFC 索引](docs/rfcs/README.md)
8. [风险实验状态](docs/spikes/README.md)

公共契约变更必须关联 RFC、schema、正反 fixtures 和兼容性说明。RFC 内容变化后更新 `rfc-baseline.json` 并记录原因。当前尚未建立公开发布、CI 或 pull request 模板；对应流程建立前，以文档中的完成定义和可复现证据为准。

修改文档或 RFC 后运行 `pnpm verify:docs`。该命令验证严格 JSON、Markdown 本地链接与代码围栏、带 `$schema` 示例、项目/Spike/work-item 状态，以及编号 RFC 集合、顺序和 SHA-256 基线；任一漂移都必须在提交前修正。

代码或文档需要作者署名时统一使用 `wwj`。
