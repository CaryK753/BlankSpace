# S4：Graph 与 Executable Registry 对账

## 状态

**Pass**。`A1-S4-01` 冻结 entry-core，`A1-S4-02` 补齐 ProductGraph resolved Service/Event binding 子集、Registry bindings/handlers 双向对账、18 组 pre-factory mismatch，以及隔离子进程中的 generated-entry 顶层副作用 probe。canonical assemblyId 为 `ecb16708efa35789d3f9aa9ccf603b9c48348bd7c097ba315738a4a09f6c1ba5`，Registry hash 为 `155dfc7f1f9a7d4f76c1b4c02e32618df699161db9f4d56086a9b55e5e5d730b`。GitHub Actions run `34026361015` 已在 `ubuntu-24.04`、`macos-15`、`windows-2025` 运行同一 frozen corpus 并全部通过；S4 现在作为持续回归门保留。

`buildMinimalProductGraphs` 仍是 Phase 1A 的前置 Graph 子集：它不做 Service provider selection，也不扩展公共 Module descriptor 来伪装完整 Compiler。当前内部输入只接受已经解析好的 `services`/`events`，按 target 过滤、验证 entry 引用和重复 identity，再把这些 resolved facts 写入 ProductGraph；Registry 只能从 Graph 派生同一 bindings/handlers，不能单独发明依赖决定。

## 要回答的问题

生成阶段能否把 Product Graph 转换为只含允许 entries/factories 的 Executable Registry，并在执行任何业务代码前发现 assembly mismatch？

## 实验设置

从固定 Graph 生成 Registry Draft 和最终 entry module。对每个 entry 记录 owner、target、specifier、export、requires bindings 与 content digest；Runtime 只读取 Graph 和生成 Registry，不扫描源码或 package metadata。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| 合法最小 Web/Server Graph | entries、bindings 和拓扑完全对账 |
| Registry 缺少或多出 entry | import factory 前失败 |
| owner/target/export 被改写 | mismatch diagnostic 指向字段 |
| Graph/Registry assemblyId 不同 | 零 factory 执行 |
| 重复 Service binding | 生成阶段失败 |
| register 少报/多报 binding | Draft 丢弃，Runtime 不 ready |
| entry 顶层产生副作用 | 受限 fixture 失败 |
| 输入 key/文件顺序变化 | canonical Registry 与 assemblyId 不变 |
| 绝对目录变化 | 生成物不包含用户路径且 hash 不变 |

## 通过条件与失败选择

每个 mismatch 都在 factory 前失败；相同规范化输入逐字节生成相同 Registry。若静态 entry module 无法稳定生成，先收窄 entry/export 语法，不引入运行时目录扫描。

## 最终证据与边界

本地验证为 147 个 Vitest、S1～S4 runners、build/typecheck/verify:docs 全部通过；S4 transcript 包含 2 个 Service bindings、2 个 Event handlers、18 组 mismatch，以及只 guard `fetch` 的受限 generated-entry probe。GitHub Actions run `34026361015` 在 Linux、macOS、Windows 三平台匹配同一 canonical assembly/Registry identity 与 probe 结果；同一 commit 上 S2 run `34026361050`、S3 run `34026361022` 也保持绿色。该 probe 只证明受限 fixture，不宣称静态阻止所有可能的 JavaScript 顶层副作用；Runtime lifecycle 由 S5 单独验证。
