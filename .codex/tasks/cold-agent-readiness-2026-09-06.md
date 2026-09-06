# 空白上下文 Agent 开工准备

日期：2026-09-06

## 目标

让未接触过本项目、不可访问历史对话的 Agent 只依赖仓库文件即可确定当前事实、选择唯一 ready 工作项、理解边界、开始实现并验证结果。

## TODO

- [x] 增加根 AGENTS.md 与冷启动阅读顺序
- [x] 定义机器可读 Phase 1A work-item DAG
- [x] 冻结第一个 ready 任务的输入、输出、文件范围和验收
- [x] 增加 work-item schema、依赖图与 project status 对账
- [x] 增加 handoff、证据和停止条件
- [x] 运行完整质量门禁

## 状态

已完成。当前唯一 ready 工作项是 `A1-S2-01`；空白 Agent 可以据此开始编码，不能自行跳到 Runtime、CLI、UI 或业务 Kit。
