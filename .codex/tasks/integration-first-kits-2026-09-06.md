# Integration-first Kits 文档调整

日期：2026-09-06

## 目标

明确 Blankspace 不重复实现成熟领域引擎，而以薄适配、装配、诊断、兼容和升级能力集成 Tiptap 等现有生态；同时保留产品直接使用上游高级 API 的能力。

## TODO

- [x] 核对现有 Kit、Editor、路线图与索引表述
- [x] 核对 Tiptap、BlockSuite 的官方能力边界
- [x] 新增 integration-first 架构 RFC 与集成目录
- [x] 更新 README、架构、Kit、Editor 与 AFFiNE 能力矩阵
- [x] 更新路线图、决策台账、RFC 索引与基线
- [x] 运行文档、schema、测试和类型检查
- [x] 执行无背景开发者阅读测试并修复重要问题

## 状态

已完成。无背景阅读测试发现的命令 escape hatch、Editor 事务 owner、E1 时序、非官方 adapter 安全 owner 与 direct integration 声明问题均已关闭；最终复核无中高严重度问题。
