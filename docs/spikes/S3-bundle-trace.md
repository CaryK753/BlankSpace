# S3：Source Edge 与 Bundle Trace

## 状态

Draft matrix，尚未执行；bundler 版本、fixture 路径和 runner 待锁定。

## 要回答的问题

Compiler 能否把声明依赖、真实 source imports 和最终 bundle modules 对账，并证明未启用 Kit、server Secret 与 internal entry 没有进入错误 target？

## 实验设置

使用同一组合法/非法产品分别生成 Web 与 Server Graph。每个 source edge 记录 importer、specifier、解析后的 package/export、target 和 owner；bundle trace 记录最终 chunk/module、来源 package、target 与 content hash。路径全部规范化为 workspace-relative `/` 路径。

开始执行前锁定 Node、pnpm、TypeScript、Vite/Rollup、OS、fixture revision、命令和期望 trace schema。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| public 静态 import | source edge 与 bundle module 一一可追踪 |
| 未声明 import | Compiler 在 bundler 前失败 |
| Web 导入 server/SecretRef | 失败且不产生可发布 bundle |
| internal export 或相对越界 | 失败并返回 importer 与越界目标 |
| literal dynamic import | 按同一 resolver 解析并进入 trace |
| 非字面量 dynamic import | Phase 1 拒绝 |
| symlink/条件 exports | 与 S2 解析结果一致 |
| 未启用 Kit | Graph、trace 和产物均不存在其实现 |
| 相同输入换绝对目录 | 规范化 trace 与 bundle 分类一致 |
| Graph 声明但 bundle 缺失或额外出现 | 发布检查失败 |

## 通过条件与失败选择

所有非法 edge 在产物提交前失败；合法 fixture 的 Graph、source edge 和 bundle trace 可确定重建。若 Vite plugin 无法提供稳定 trace，只替换 bundler adapter，不把 Compiler 降级成 Vite-only plugin。

## 尚待冻结

精确工具版本、trace schema、fixtures、命令和跨 OS 结果。此 spike 只比较相同 corpus 的 bundle 分类、稳定性与候选间相对变化，不等待 Phase 1 产品 bundle 预算；最终绝对预算按 `budgets/phase-1.md` 在 S1～S7 通过后冻结。
