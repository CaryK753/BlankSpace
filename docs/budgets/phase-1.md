# Phase 1 性能预算

## 状态

Unfrozen。没有实测基线，因此当前不能进入 Phase 1B。

该门禁登记为[决策与门禁台账](../decision-backlog.md) DEC-004。

## 冻结时点

S1～S7 正式通过后，先实现不含业务代码的 `fixtures/benchmarks/phase-1` benchmark harness，再冻结预算；只有预算和 harness 一起评审通过后才开始 Reference SaaS fixture。预算由 RFC-0012 的指标约束，经三次冷运行和十次热运行取得基线后确定；不能在功能完成后按结果反向放宽。

benchmark harness 是 1A 的测量基础设施，不是 1B Reference SaaS。它只包含固定的最小 Web/Server entry、一个合成 Module、声明式 Service/Event、确定性种子数据和 create/check/build/start 驱动器。首次创建指标使用脚手架生成该固定 fixture；构建和 Runtime 指标消费同一已签入期望图。harness 不包含 Identity、Workspace 或产品业务，因此不会偷跑 1B，也不会让待测实现反向定义阈值。

S3/S7 在自身 spike 中只冻结“结果可重复、没有明显退化或候选失控”的比较方法，不依赖本页的 Phase 1 产品预算。候选工具通过功能矩阵即可推进 spike；本页阈值在 S1～S7 通过后对最终组合测量。因此不存在“先有预算才能通过 spike、先通过 spike 才能建立预算”的循环。

## 标准环境

冻结记录必须包含：

- CPU 型号、核心数、内存、磁盘和 OS；
- Node.js 24 patch、pnpm 与所有构建工具版本；
- 冷缓存和热缓存的精确定义；
- PostgreSQL 版本、部署方式和种子数据量；
- Browser、viewport、locale、timezone 和网络条件；
- fixture commit、`rfc-baseline.json` 与两份 lockfile hash。
- benchmark harness schema/version、驱动命令和期望 Product Graph hash。

CI 可以使用不同硬件，但必须通过校准任务换算或维护独立 CI 阈值，不能把本地绝对时间直接当作跨机器事实。

冻结算法必须可复现：p95 使用 nearest-rank，升序样本的索引为 `ceil(0.95 × n)`（从 1 开始），因此三次冷运行取最大值，十次热运行也取最大值。时间阈值默认为 `max(实测 p95 × 1.25, 实测 p95 + 100ms)`，最后向上取整到 10ms；bundle bytes 默认为实测值 × 1.10，向上取整到 1 KiB。若 RFC-0012 的用户体验上限更严格，采用更严格值。偏离默认余量必须记录风险理由。Framework Performance owner 提议，Runtime、Build 和 Product owner 各一人复核后冻结。

CI 校准任务连续运行同一固定 CPU workload 和 benchmark harness 的只读子集；workload 源码、输入和期望输出以 content hash 标识。比例 `r = median(CI duration) / median(标准环境 duration)`，换算阈值为 `ceil(标准环境阈值 × r / 10ms) × 10ms`；bundle bytes 不做硬件校准。只有最近 30 次样本的 duration 变异系数不超过 10% 才允许换算，否则维护按同一冻结算法取得的独立 CI 阈值。公式版本、workload hash、样本和结果作为预算 evidence 保存。

## 待冻结指标

下表的测量对象均为 `fixtures/benchmarks/phase-1`。Reference SaaS 完成后可以记录独立产品基线，但不能用它覆盖 Phase 1 框架预算。

| 指标 | 测量边界 | 统计值 | 阈值 | 状态 |
| --- | --- | --- | --- | --- |
| 项目首次创建 | 命令开始至首页 ready | p50/p95 | TBD | Blocked |
| 冷 `check` | 无 Compiler/cache 产物至完成 | p50/p95 | TBD | Blocked |
| 热增量 `check` | 修改一个 Module 后至完成 | p50/p95 | TBD | Blocked |
| 冷 Web build | 清空构建缓存至产物完成 | p50/p95 | TBD | Blocked |
| 冷 Server build | 清空构建缓存至产物完成 | p50/p95 | TBD | Blocked |
| Web entry bundle | gzip 与 raw bytes，含 chunk 分类 | value | TBD | Blocked |
| Server bundle | external 与 bundled bytes 分列 | value | TBD | Blocked |
| `test --affected` | 单 Module 修改至测试完成 | p50/p95 | TBD | Blocked |
| Runtime start | process start 至 ready | p50/p95 | TBD | Blocked |

## 预算变更

阈值冻结后，超过预算会阻止里程碑退出。调整必须记录旧值、新值、fixture/环境变化、原因和维护者评审；不能只因为回归已经发生就更新数字。功能范围或标准硬件变化时重新建立基线，并保留旧记录用于比较。
