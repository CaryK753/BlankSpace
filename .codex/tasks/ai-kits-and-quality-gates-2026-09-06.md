# AI Kits 与工程质量门禁

日期：2026-09-06

## 目标

修复根测试和 TypeScript 类型环境编排问题，并基于官方资料为 Blankspace 增加 AI Model、Agent Runtime、Knowledge、Web Research 与 Document Intelligence 能力设计，明确 LangChain/LangGraph/Vercel AI SDK、WeKnora、Exa/Tavily、Docling/MinerU/WeKnora DocReader/PaddleOCR 的接入层次和安全门禁。

## TODO

- [x] 复现根 Vitest 与 TypeScript ambient type 冲突
- [x] 分离 Vitest 与 Node 内置测试的执行范围
- [x] 收紧 contracts 的 ambient types 并恢复 typecheck
- [x] 核对候选项目官方文档与当前能力边界
- [x] 新增 AI 能力架构文档
- [x] 更新 Capability/Integration Catalog、路线图、索引和台账
- [x] 运行完整 build、typecheck、test、S1 和 docs 验证

## 状态

已完成。工程质量门禁已恢复，AI 能力形成 candidate/experimental 设计并同步目录、路线和台账；本任务没有实现具体 adapter。
