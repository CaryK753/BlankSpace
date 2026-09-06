# Phase 1A 最小 Product Graph 纵向切片

日期：2026-09-06

## 目标

实现第一条不含业务 Kit 的可执行 Compiler 切片：从内存中的规范化 Product 配置与 Product manifest 生成 web/server 各自的确定性最小 Product Graph，并为后续文件加载、Module resolver、Registry 和 CLI 保留清晰边界。

本任务不实现 Identity、Database、UI、preset 展开、文件系统 resolver、Executable Registry 或 CLI。

## 计划

### Batch 1：冻结最小契约

- [x] 新增 `product-graph-v1.schema.json`，只包含本切片已有事实
- [x] 从 `@blankspace/contracts` 导出对应 TypeScript 类型
- [x] 增加 schema 正反 fixture，验证未知字段、排序和本机路径边界

### Batch 2：实现纯 Graph Builder

- [x] 在 Compiler 中实现无文件系统副作用的 `buildMinimalProductGraphs`
- [x] 规范化 targets、entries 和 modules，生成稳定 `inputHash` 与 `assemblyId`
- [x] 对空目标 entry、重复 Module ID、target 不匹配返回稳定 diagnostic code

### Batch 3：验证与文档同步

- [x] 增加跨 key/输入顺序和跨绝对目录的确定性测试
- [x] 运行 build、typecheck、test、S1 与 docs 验证
- [x] 更新 Phase 1A 状态，只声明本切片已实现，不提升 S2～S4 状态

## 状态

已完成。最小纯 Graph Builder、schema、类型、确定性和错误 fixtures 全部通过；resolver、Registry、完整 assemblyId 和 CLI 明确留给后续任务，S2～S4 状态未提升。
