# S1 JSONC 配置 Spike

日期：2026-09-04

## 目标

验证 JSONC manifests 能被严格解析、按 JSON Schema 校验，并在不同绝对目录生成字节一致的 canonical JSON 与 hash。

## 环境差异

- RFC 目标：Node.js 24 LTS。
- 当前本机：Node.js 22.22.3。
- 处理：允许执行无 Node 24 专属 API 的 S1 spike；结果标记 provisional，CI/正式接受必须在 Node 24 重跑。

## TODO

- [x] 建立 pnpm workspace、TypeScript 和测试骨架
- [x] 创建 Product、Product Manifest、Module 三层 JSON Schema
- [x] 实现严格 JSONC 解析、canonical serialization 和 SHA-256 hash
- [x] 增加合法/非法 corpus 与跨目录一致性测试
- [x] 记录 spike 结果和剩余风险
- [ ] 在 Node 24 安装依赖并运行 typecheck、Vitest 与最终 validator

## 非目标

- 不实现完整 Product Graph、Registry 或 resolver。
- 不实现业务 Kit。
- 不把 spike 结果标记为 RFC Accepted。
