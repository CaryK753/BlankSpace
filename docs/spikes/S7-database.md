# S7：数据库访问层与 Migration Runner

## 状态

Draft matrix，尚未执行；PostgreSQL、Kysely、Drizzle 与 runner 版本待锁定。

## 要回答的问题

Kysely、Drizzle 或 direct SQL + typed adapter 中哪一种最能保持 Kit 数据所有权、可检查 SQL、显式事务和确定性 migration？

## 实验设置

三种候选实现同一 Identity/Workspace schema、查询和 migration corpus。每个 Kit 使用独立 namespace；runner 统一负责排序、advisory lock、hash、状态记录和失败策略。数据库使用固定镜像 digest 与种子数据。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| 初始建表与 typed query | 三候选返回 wire 等价结果 |
| 两 Kit 独立 migration | owner、顺序和 SQL 可审计 |
| 重复 migration ID | 执行前失败 |
| 已执行 migration 内容变化 | hash mismatch，停止 |
| 两个 runner 并发 | 只有一个获得全局 lock |
| transactional 失败 | 本项回滚，后续不执行 |
| checkpointed/manual | 按 descriptor 停止并记录检查点 |
| 移除 Kit | 保留历史与数据，不偷偷 drop |
| browser/shared import DB | Compiler 边界失败 |
| explain/索引检查 | 能导出可比较 SQL 与计划证据 |

## 通过条件与选择规则

通过者必须不要求全局 ORM schema，不隐藏 migration SQL，不把 transaction handle 放入跨 Kit Contract。若 Kysely 与 Drizzle 都破坏这些边界，选择 direct SQL + typed query adapter；性能差异只在语义条件都通过后比较。

## 尚待冻结

候选精确版本、PostgreSQL digest、schema/seed、fixtures、命令和恢复证据。此 spike 记录同一 seed/query corpus 的相对耗时和明显退化，但不等待 Phase 1 产品性能预算；最终绝对预算按 `budgets/phase-1.md` 在 S1～S7 通过后冻结。
