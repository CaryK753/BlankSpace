# Actions pnpm 激活稳定性修复

日期：2026-09-06

## 目标

修复跨平台 conformance workflows 在 Corepack 下载固定版本 pnpm 时的瞬时失败，同时保留版本锁定和持续性错误的失败语义。

## TODO

- [x] 核对最新 `main` 与历史失败 attempt
- [x] 确认失败发生在依赖安装和项目测试之前
- [x] 为 S2～S5 workflow 复用同一跨平台 pnpm 激活脚本
- [x] 验证脚本语法、版本锁定和失败退出行为
- [x] 运行 build、typecheck、test、verify:docs
- [x] 推送并验证 Linux、macOS、Windows Actions

## 范围边界

- 这是用户明确要求的 CI 可靠性维护，不领取或推进 `A1-S6-01`。
- 不新增依赖或第三方 Action，不修改 frozen conformance corpus。
- 最多重试三次；版本不匹配和持续失败仍返回非零状态。

## 根因证据

S4 run `34043351840` 的 Windows 首次 attempt 在 `corepack install --global pnpm@10.32.1` 中触发 Node Undici assertion，尚未进入 `pnpm install` 或项目测试；同一提交重跑后通过，符合瞬时工具下载故障特征。

## 验证证据

- candidate commit：`bd3669b0977d81943385c500eb8b1eb183f5c256`；
- S2 run `34044136724`、S3 run `34044136676`、S4 run `34044136716`、S5 run `34044136679` 全部通过；
- 四个 workflow 的 Ubuntu 24.04、macOS 15、Windows 2025 共 12 个 job 全部通过；
- 12 个 `Activate pinned pnpm` 步骤均成功并继续完成各自 frozen conformance corpus。
