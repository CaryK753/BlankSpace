# 生命周期文档收口

日期：2026-09-05

## TODO

- [x] 核对 RFC-0001 与验证策略中的启动失败语义
- [x] 明确 factory、失败 start、成功 start 的资源所有权
- [x] 补充 S5 实验方案并同步实验索引
- [x] 校验文档链接和 RFC 基线，记录剩余验证

验证结果：13 份 RFC hash 与基线一致，基线 schema、文档本地链接与代码围栏通过。Runtime 尚未实现，S5 未执行。

## 范围

只完善 Proposed 设计和实验验收，不实现 Runtime，不宣称 S5 通过。

## RFC 基线变更说明

RFC-0001 从 `7a485000ae9af7061c45326c3ff897c4e14037bbb948ef3ae0cc37dba56910f8` 更新为 `e090aa3f160bd00492d10b090a240e3539dab44218583e0e3d9c6e26b2a4b05c`。

原因：原设计只覆盖已启动入口的 stop，没有约束失败入口的部分资源。新增 factory 无资源获取、start 失败自清理、成功后交给 Runtime、清理失败继续与超时如实报告的规则。受影响的 S5 fixture 尚未实现，本次只更新矩阵与验证策略；RFC 保持 Proposed。
