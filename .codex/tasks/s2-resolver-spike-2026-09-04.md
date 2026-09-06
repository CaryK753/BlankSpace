# S2 Resolver Spike

日期：2026-09-04

## 目标

证明 Compiler、TypeScript、Web dev/build、Server 与 Test 对公开 import 使用同一套可解释解析语义，并在构建前拒绝非法 runtime 边。

## TODO

- [x] 冻结五种解析模式及其差异边界
- [x] 冻结合法/非法 fixture 与失败分类
- [ ] 实现统一 resolver adapter 和 resolution trace
- [ ] 在 Node.js 24 安装锁定依赖并运行矩阵
- [ ] 在不同绝对目录与 pnpm store 配置重跑
- [ ] 记录证据并决定 Vite/pnpm 是否通过

## 非目标

- 不验证最终 bundle 中的 chunk、CSS、worker、WASM 与 asset；这些属于 S3。
- 不实现完整 Product Graph。
- 不允许工具“能解析”覆盖 target 或公开边界规则。
