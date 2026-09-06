# 文档权威来源与维护规则

## 1. 目标

Blankspace 同时包含当前实现、目标体验、Proposed RFC、实验矩阵和生产门禁。它们回答的问题不同；重复描述可以改善阅读，但不能形成多个权威来源。

## 2. 权威顺序

| 问题 | 唯一权威来源 | 人类阅读投影 |
| --- | --- | --- |
| 当前阶段、生产结论、已实现/不可用能力 | `status/project-status.json` | README、current-implementation |
| Spike 当前状态 | `status/project-status.json` | spikes/README、各 Spike 文档 |
| 当前公共结构 | `packages/contracts/schemas/` | configuration-reference、领域文档 |
| Proposed 公共结构 | `docs/schemas/proposed/` | RFC、领域设计文档 |
| 当前 TypeScript API | `packages/*/src` 与 package exports | current-implementation |
| 当前可领取的实现任务 | `implementation/phase-1a-work-items.json` | agent-start-here、Phase 1 蓝图 |
| 架构决策 | 对应 RFC | architecture、roadmap |
| 阶段进入/退出条件 | phase-1-blueprint | README、roadmap |
| 未关闭决策 | decision-backlog | 领域文档链接 |
| 发布实例事实 | ReleaseCandidate/Evidence/Receipts | CI/CD 与运维界面 |

当投影与权威来源冲突时，先修投影；不能为了保留示例而放宽正式 Schema。RFC 仍为 Proposed 时是验证性设计依据，不覆盖已经发布的正式 Schema。

## 3. 文档类型

- **Current reference**：只写可由当前源码和测试复现的行为。
- **Target guide**：描述目标开发体验，必须在开头明确尚未实现。
- **RFC**：解释决策、取舍、验收和重审条件。
- **Schema/fixture**：定义机器边界和正反例，不承担教程职责。
- **Spike**：记录固定输入、命令、环境、原始证据和失败选择。
- **Operations/runbook**：描述操作者动作、权限、停止条件和恢复。

不得把未来命令放进 Current reference，也不得把通过 Schema fixture 描述成 Runtime 已实现。

## 4. 状态更新协议

状态变化按以下顺序提交：

1. 保存可复现 evidence；
2. 更新 `project-status.json` 的状态、evidence ID、next gate 和日期；
3. 更新独立 Spike 文档中的环境、命令和结果；
4. 更新 `spikes/README.md` 的人类摘要；
5. 若门禁或决策变化，更新 blueprint/backlog；
6. 运行 `pnpm verify:docs`。

验证器会对账状态文件日期、索引状态和每份 Spike 的声明。摘要文本可以更适合人类阅读，但状态词不能不同。

实现工作项同样由验证器对账：依赖必须存在且无环，整个当前阶段只能有一个 `ready | in-progress` item，其依赖必须全部 `done`，并与项目状态的 `nextWorkItem` 相同。

## 5. Schema 与示例规则

带 `$schema` 的 JSONC 示例必须通过对应正式 Schema；未带 `$schema` 的片段只检查语法，因此必须标明“片段”或“目标提案”。Proposed schema 使用严格 Ajv 编译，并验证仓库声明的 `uri`、`date-time` 等 format。

新增公共字段时先决定属于当前 major 还是未来 proposed major。正式 Schema 设置 `additionalProperties: false` 时，文档不得提前把未来字段伪装成当前合法配置。

## 6. 去重规则

领域文档可以解释同一概念，但机器结构只在一个 Schema 定义。其他位置使用链接或标注为阅读投影。例如：

- CI/CD 定义 ReleasePlan、ReleaseCandidate 和 ReleaseLifecycle；
- Platform Operations 只消费 ReleaseCandidate；
- Upgrade contract 只引用 artifact identity，不重新定义发布候选；
- Supply Chain 定义证据政策，不重新定义部署状态机。

若同一 interface 在两个文档出现，应保留一个权威 Schema，并把代码块标记为非权威投影。

## 7. Review checklist

- 当前能力是否可由仓库命令复现；
- 目标命令是否明确标注未实现；
- 示例是否通过声明的 Schema；
- 状态是否来自 `project-status.json`；
- RFC、Schema、fixture 和阶段 Gate 是否互相链接；
- 新术语是否进入 glossary；
- 是否重复定义已有 Contract；
- 安全、迁移和发布结论是否有 evidence，而不只是正向路径；
- 本地链接、时间格式、URI、RFC baseline 和状态对账是否通过。
