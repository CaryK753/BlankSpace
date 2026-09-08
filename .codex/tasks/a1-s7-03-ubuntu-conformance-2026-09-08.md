# A1-S7-03 Ubuntu Database conformance

日期：2026-09-08

## 目标

在 GitHub Actions `ubuntu-24.04`/linux-amd64 上安装 frozen lock、拉取 exact PostgreSQL OCI index，并复跑与 macOS arm64 相同的 S7 canonical corpus。

## TODO

- [x] 确认 A1-S7-02 本地证据、S7 frozen image/package identity 与现有 pnpm bootstrap。
- [x] 新增独立 S7 workflow，不扩大或复制 S2～S6 job。
- [ ] 本地验证 workflow 语法、docs、build/typecheck/test 与 S7 resource cleanup。
- [ ] 提交并推送候选 commit。
- [ ] 检查 S2～S7 每个 GitHub check-run 和失败日志。
- [ ] Ubuntu S7 匹配 canonical hash 后更新状态、work item 与最终证据。

## 边界

- 只使用 `ubuntu-24.04` 与 frozen linux/amd64 image；不宣称 macOS/Windows Docker portability。
- 不实现 production Database adapter、业务 schema、backup/PITR、HA、proxy 或 deployment。
- S7 job 独立拉取镜像；S2～S6 继续运行各自 scoped corpus，不被迫启动数据库。
