# Y1：Sync Protocol V1

## 状态

Draft matrix，尚未执行；Phase 4 replicated/sync 实现前必须冻结并通过。

## 依据与范围

依据 RFC-0019，在内存 transport 和真实本地数据库上运行同一 deterministic network runner，验证 operation、batch、逐项 result、checkpoint、删除、quarantine、blob 和版本协商。数据域至少包含 replace/version-check 与增量协作两种 codec，避免把 envelope 写成单一 CRDT 的别名。

## 冻结输入

- protocol/schema、数据库、transport 和 runner 精确版本；
- 两个 data-domain codecs 及其 convergence oracle；
- reorder/drop/duplicate/delay seed corpus；
- Server backup/restore、permission epoch 和旧客户端 fixtures；
- batch/bytes、重试、恢复时间与资源阈值；
- transcript canonicalization 与跨语言 hash 命令。

## 通过条件

RFC-0019 的 Y1 十一类故障均达到确定终态；同一 seed 可重复；HTTP 成功不替代逐 operation result；崩溃后不丢本地已提交写入；拒绝内容可审计导出但不自动重放；两个 codecs 共用 envelope 而不共用冲突算法。

## 失败选择

若第二 codec 需要不同 identity/ack 语义，提升协议 major 或收窄 envelope；若跨语言 canonical bytes 不稳定，收窄编码方言；若 checkpoint 不能跨 Server restore，保持 Phase 4 No-Go，不以全量覆盖本地数据作为静默恢复。
