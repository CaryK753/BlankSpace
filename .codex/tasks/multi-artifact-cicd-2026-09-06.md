# 多产物 CI/CD 与客户端发布轨道

日期：2026-09-06

## 目标

参考 AFFiNE 的分层构建与 artifact 汇合方式，为 Blankspace 冻结 Docker、Web、Electron Desktop、Capacitor、SwiftUI/iOS 与 Compose/Android 的 CI/CD 设计、发布边界和机器契约。当前仓库没有可构建的产品 Runtime，本任务不伪造可发布 workflow。

## TODO

- [x] 核对现有供应链、Platform Operations、Client Runtime 与 SC1 边界
- [x] 核对 AFFiNE 官方镜像、桌面与移动发布资料
- [x] 编写多产物 CI/CD 规范与 target matrix
- [x] 增加 proposed release pipeline schema、正反 fixtures 与语义验证器
- [x] 更新文档索引、供应链、客户端、路线图、SC1 与决策台账
- [x] 运行 build、typecheck、test 与文档/contract 验证

## 状态

已完成文档与 proposed contract 冻结。实际 GitHub Actions、签名、公证、商店提交和 OCI push 仍受 Runtime 实现、DEC-006、DEC-012E/C/I/A 与 DEC-029 门禁阻断。
