# S4：Graph 与 Executable Registry 对账

## 状态

**Matrix frozen（entry-core）**。`A1-S4-01` 已冻结 `ExecutableRegistryV1` schema/type、Graph→Registry 纯生成器、joint `assemblyId`、Web/Server entry-core、10 组 pre-factory mismatch、两个工作目录/两种输入顺序的 canonical runner 与 macOS arm64 baseline。完整 S4 仍未 Pass，因为 ProductGraph 的 Service/Event bindings、Registry handlers/bindings 对账、entry 顶层副作用 probe 与 Linux/macOS/Windows 完整证据由 `A1-S4-02` 继续完成。

现有 `buildMinimalProductGraphs` 仍只是 Phase 1A 的前置 Graph 子集：它可以从内存中的规范化 Product 配置、manifest 和 Module descriptors 生成 target-specific Graph，并验证输入顺序与工作目录不影响结果；当前 Graph 尚未声明 RFC-0004 要求的 Service/Event 节点，所以 entry-core Registry 明确拒绝任何非空 `bindings`/`handlers`。不得通过在 Registry 侧单独发明 binding 来绕过 Graph 事实源。

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

## A1-S4-02 尚待关闭

Entry-core schema、生成器、runner 与本地 baseline 已冻结。完整 S4 仍需：ProductGraph Service/Event binding 子集、Registry bindings/handlers 双向对账、重复/缺失/额外 binding/handler 负例、受限 entry 顶层副作用 probe，以及 Linux/macOS/Windows 的完整 conformance evidence。
