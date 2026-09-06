# Operations Plane 与生产能力补全

日期：2026-09-06

## 目标

补齐 Blankspace 作为现代 SaaS 框架所需的镜像更新检测、渐进发布、客户端更新、回滚、日志、服务状态与生产运维能力，并对完整生产生命周期进行第二轮缺口审查。

## TODO

- [x] 审查现有 operations、production readiness、supply chain 与 capability catalog
- [x] 核对 Kubernetes、Flux、Sigstore、cert-manager、Velero 等官方能力
- [x] 区分应用 Runtime、Deployment Plane、Operations Plane 与外部平台职责
- [x] 设计镜像检测、签名验证、无中断发布、自动回滚与客户端更新
- [x] 补充日志、状态、告警、事故、备份、证书、secret、容量与成本等缺失能力
- [x] 更新 RFC、索引、路线图、台账和 baseline
- [x] 运行文档、类型和测试验证

## 状态

已完成。文档与 proposed contracts 校验、TypeScript typecheck、S1 8 项测试均通过。完整 Vitest suite 仍因当前工作区未安装 `vitest` 可执行文件而不可运行。
