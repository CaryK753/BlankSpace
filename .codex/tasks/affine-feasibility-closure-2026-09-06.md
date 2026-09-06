# AFFiNE 级可行性缺口收口

日期：2026-09-06

## TODO

- [x] 保存无上下文独立可行性结论与置信度
- [x] 消除 Phase 2 Block 文档与 Phase 5 Editor Kit 的阶段倒置
- [x] 起草最小 Editor Engine Boundary RFC、Proposed schema 与 E1 matrix
- [x] 起草 Sync Protocol V1 RFC、Proposed schema 与 Y1 matrix
- [x] 增加早期 Native storage/sync feasibility spike
- [x] 更新路线图、能力矩阵、RFC 索引、台账和基线
- [x] 运行机器检查与无上下文读者测试

## 完成标准

- “当前不能、何时理论可行、必须先证明什么”在文档中可直接回答；
- Phase 2 可以使用实验性 Editor Boundary，而不依赖 Phase 5 稳定通用 Editor Kit；
- change、batch、ack/checkpoint、拒绝/quarantine、协议协商具有机器草案；
- Web/Desktop 与至少一个原生客户端的存储/同步限制在 Phase 4 前被验证；
- 所有新增 RFC 进入基线，文档与 schema 校验通过。

## 完成结果

- 独立审查明确记录：当前不能复刻，完成全部关键门禁后理论可行置信度约 65%；
- RFC-0018 将 Phase 2 experimental Editor boundary 与 Phase 5 stable Editor Kit 分开；
- RFC-0019 定义协商、opaque operation payload、逐项结果、checkpoint、冲突、撤权 quarantine、blob 和兼容窗口；
- E1、Y1、N1 分别负责 Editor、同步故障和原生 storage/sync 可移植性；
- Proposed Editor/Sync schemas 配有 13 个结构与语义 fixtures，包括 operation payload hash、extension graph、权限拒绝与多分块 Blob 聚合校验；
- 最终无上下文复核未发现剩余中高严重度问题；所有 RFC/Schema/Spike 仍诚实保持 Proposed/Draft，未标为实现完成。
