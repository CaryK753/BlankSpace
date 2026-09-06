# S4：Graph 与 Executable Registry 对账

## 状态

Draft matrix，尚未执行；Registry fixture 与生成器版本待锁定。

当前已有一个更小的前置实现：`buildMinimalProductGraphs` 可以从内存中的规范化 Product 配置、manifest 和 Module descriptors 生成 target-specific Graph，并验证输入顺序与工作目录不影响结果。它不读取文件、不执行 S2 resolver，也没有 Registry、binding、handler、content digest 或 Graph/Registry 联合 assemblyId，因此不构成 S4 执行证据，不能推进本页状态。

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

## 尚待冻结

Registry schema、生成器版本、受限副作用 runner、fixtures、命令和跨平台证据。
