# 空白上下文 Agent 验收

## 使用方式

给一个未读取历史对话的 Agent 仅提供仓库根目录。它必须在不询问项目背景的情况下，从 `AGENTS.md` 出发回答下列问题；任何答案需要猜测都表示文档尚未达到开工标准。

## 必答问题

| 问题 | 权威答案位置 |
| --- | --- |
| 项目现在是什么阶段、能否用于生产 | `status/project-status.json` |
| 当前真正实现了什么 | `current-implementation.md`、源码 exports |
| 唯一可领取的任务是什么 | `phase-1a-work-items.json` |
| 为什么现在做它 | S2、Phase 1 blueprint、work-item dependencies |
| 可以修改哪些文件 | `A1-S2-01.md#修改范围` |
| 明确不能实现什么 | work item `nonGoals`、任务规格 |
| 公共字段和跨字段规则是什么 | `A1-S2-01.md`、未来正式 Schema |
| 需要哪些正向与负向测试 | `A1-S2-01.md#必测用例` |
| 是否允许新增依赖 | 不允许；AGENTS 与 work item |
| 使用哪个 Node 和包管理器 | Node 24、pnpm 10.32.1 |
| 完成时运行什么 | work item `commands` |
| 完成后更新哪些状态 | `A1-S2-01.md#完成与交接` |
| 哪些情况必须停止而不是自行决定 | 公共契约变化、新依赖、超出 scope |

## 通过标准

- Agent 能复述所有答案并指向文件；
- Agent 的实现计划只覆盖一个 ready item；
- 计划先 Schema/fixture，再类型、实现和 consumer；
- 不修改 `dist/`、RFC baseline、ProductGraph V1 或未授权 package；
- 不把批次完成误报成 S2 Pass；
- 测试计划同时包含成功、确定性和稳定失败 diagnostics；
- handoff 包含环境、命令、结果、限制和下一工作项。

本检查证明“文档足以开始当前工作项”，不证明实现一定正确。实际提交仍需代码审查和完整门禁。
