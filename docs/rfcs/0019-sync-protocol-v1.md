# RFC-0019：Sync Protocol V1 机器边界

## 状态

Proposed

## 背景

RFC-0006 定义 replicated 数据语义，但没有冻结 wire envelope。没有 operation、batch、ack/checkpoint、拒绝、quarantine 和版本协商的机器契约，Phase 4 无法证明重复、乱序、崩溃与旧客户端恢复。本 RFC 定义 transport-independent V1；它不规定所有数据域使用同一种冲突算法。

机器草案位于 [`sync-protocol-v1.schema.json`](../schemas/proposed/sync/sync-protocol-v1.schema.json)。通过 Y1 spike 前它不是已交付协议。

## 决策

### 1. 协议身份与协商

连接先交换 `SyncHello`：protocol ID、支持 version range、client instance、Server scope、WorkspaceRef、数据域与 capability。Server 选择唯一兼容版本并返回 session ID、策略版本、最大 batch/bytes、checkpoint 和权限 epoch；无交集时返回 `SyncIncompatible`，包含双方范围、稳定 code 和 read-only/retry-later 恢复选择，不降级为未版本化请求。

身份/session token 不进入可重放 change。每个请求在 transport 层认证，envelope 内只保存稳定 principal/ref 和权限 epoch；过期或撤权由 Server 明确拒绝。

### 2. Operation

每个 `SyncOperationV1` 包含：operation ID、WorkspaceRef、data domain、resource ID、protocol/format、author principal、client sequence、base/checkpoint 引用、kind、payload hash/bytes、blob refs 和 causal references。

operation ID 在客户端耐久生成并与业务数据/outbox 同事务提交。Server 和客户端按 `(workspace, dataDomain, operationId)` 幂等；相同 ID 不同 hash 是完整性冲突，必须 quarantine，不能按最后到达覆盖。

payload 由数据域 codec 解释。协议层不得假设 payload 是 JSON、CRDT 或字段 patch；但必须验证声明的 encoding、版本、hash 和尺寸。

### 3. Batch 与顺序

`ChangeBatch` 按稳定 client sequence 发送，包含 batch ID、first/last sequence、base checkpoint 和 operations。batch 可拆分/重试；ack 以单 operation 结果为真源，不能因 HTTP 成功把整个 batch 当作已应用。

乱序 operation 可以被数据域接受、暂存为 dependency-missing 或拒绝。Server 返回每项 `applied | duplicate | deferred | rejected | quarantined`，以及新的 checkpoint。结果可携带 typed domain outcome；snapshot rebase 必须带原因、目标 format 和保留未确认操作策略；quarantine 必须带可导出 scope 与 redaction policy。客户端只在结果耐久写入后推进本地 ack。

### 4. Checkpoint

checkpoint 是 Server 对一个 Workspace/data-domain 已处理位置与状态摘要的 opaque、带版本引用；不是客户端时间戳。客户端保存 checkpoint ID/hash、协议版本和最后 ack sequence。checkpoint 丢失或过旧时执行 bounded rescan/snapshot recovery，不能静默从空状态覆盖本地内容。

Server 可以要求 snapshot rebase，但必须给出原因、目标 format 和保留本地未确认 operations 的策略。snapshot 验证失败保持最后可信状态。

### 5. 删除与冲突

删除是显式 operation/tombstone，保留期和 GC frontier 由数据域策略声明。旧客户端在 tombstone GC 后上线必须 snapshot recovery，不能重新创建已删除资源。

冲突结果属于数据域：merged、needs-user-action、server-rejected 或 policy-redacted。transport 只携带 typed result 和 evidence ref，不自行做字段级 last-write-wins。

### 6. 权限撤销与 Quarantine

每次 apply 校验当前权限 epoch。离线期间撤权的 operation 返回稳定 reject code、可导出范围、redaction policy 和 recovery choices。客户端把原 operation、payload hash、拒绝证据和最后可信本地内容写入 quarantine；不得自动丢弃或反复上传。

quarantine export 必须排除 Server policy 禁止的数据，并记录用户动作。重新授权不会自动重放旧 operation，除非产品策略和新权限显式允许。

### 7. Blob

operation 只引用 `BlobRef`。上传使用 content hash、size、media type、chunk manifest 和 resume token；文档 operation 可以在 blob 未完成时被 deferred，但不能被错误标记 applied。重复 chunk 幂等，完成前不进入可读引用；GC 只处理超过策略 frontier 且无可信引用的 blob。

单个传输消息使用 `SyncBlobChunk`；Y1 evidence 另生成 `SyncBlobTransfer` 聚合 transcript，按 `chunkIndex` 从零连续拼接所有解码 bytes，并对账每块 hash/size、总 bytes 和最终 content hash。缺块、重复索引、乱序 transcript 或整体 hash 不一致均不能产生完成状态。

### 8. 故障与观测

所有 request/result 有 correlation ID，但它不参与业务幂等。blob chunk 同时携带 base64 payload；`chunkBytes` 必须等于解码长度，`chunkHash` 覆盖解码 bytes。指标至少覆盖 pending operations、oldest age、batch bytes、retry、deferred dependency、reject/quarantine、checkpoint lag、blob backlog 和 protocol incompatibility。日志不包含 payload、session token 或 secret。

退避、并发和 batch 上限来自协商策略并有本地硬上限。服务端 `retry-after` 不能绕过客户端资源预算。

### 9. 版本与兼容窗口

Compatibility Manifest 声明每个数据域的读/写协议范围、format range、旧客户端截止、双读/双写窗口和 snapshot migration。超出写入窗口的客户端进入 read-only recovery；Server 不把未知 payload 当作成功保存。

协议 minor 只能增加可忽略字段或新 capability；改变 operation identity、ack 语义、删除或权限处理必须提升 major，并提供迁移/拒绝策略。

## Y1 Spike

Y1 在 Phase 4 实现前使用内存 transport 与真实本地数据库各执行一次：

| 故障 | 预期结果 |
| --- | --- |
| batch 响应丢失并重试 | duplicate，不重复业务效果 |
| operations 乱序/依赖缺失 | deferred 后有界恢复 |
| 同 ID 不同 hash | quarantine + integrity diagnostic |
| 本地提交后进程崩溃 | outbox 重启继续发送 |
| apply 后 ack 前崩溃 | 重放得到 duplicate/applied 等价状态 |
| checkpoint 丢失/过旧 | bounded recovery，不覆盖未确认本地写入 |
| 删除后旧客户端上线 | 不复活资源 |
| 权限在离线期撤销 | 拒绝并可审计 quarantine |
| blob 上传中断 | 按 chunk/hash 恢复 |
| 协议无交集 | read-only/incompatible，不静默降级 |
| Server 从备份恢复 | checkpoint divergence 被检测并恢复 |

网络分区矩阵使用确定 seed 的 reorder/drop/duplicate/delay runner；每次保存 seed、transcript、数据库 hashes 和收敛结果。

## 验收条件

1. 本地业务写入和 outbox 原子；
2. 重复、乱序、断线和双端崩溃均有确定终态；
3. 协议层不假设统一 CRDT，却能携带数据域 typed conflict；
4. 权限撤销不静默上传或丢弃；
5. blob、checkpoint 和删除均可恢复；
6. 旧客户端窗口可由 Compatibility Manifest 机器判定；
7. transcript 可跨 transport、语言和绝对路径比较。

## 非目标

- 多 Server 复制或 peer-to-peer；
- 替所有数据域选择 CRDT；
- 把 Event bus 当作可靠 transport；
- 在 V1 提供生产 SLA 或无限离线兼容。

## 重审触发条件

第二种数据域无法使用同一 envelope、原生客户端无法稳定编码、Server 恢复无法保持 checkpoint 语义，或附件需要独立协议 major 时重审。
