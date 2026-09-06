# RFC-0008：Local → Cloud 迁移与恢复

## 状态

Proposed

## 背景

Local Workspace 与 Cloud Workspace 属于不同 Provider。把迁移实现为修改 `sourceId` 或追加 remote binding 会混淆身份、失败恢复和单 Server 复制关系。

## 决策

### 1. 迁移创建新 WorkspaceRef

```text
preflight
→ create target Cloud Workspace
→ copy metadata/domain data/blobs
→ verify target
→ cutover active ref
→ archive source by policy
```

源 Workspace 在 cutover 前始终保持可打开。目标使用新的 `{sourceId, workspaceId}`；内部资源 ID 是否保留由各数据域 migration Contract 声明。

### 2. Migration Plan 与 Journal

Plan 冻结 source/target Ref、Server identity、数据域、估算大小、schema/protocol 版本、ID 策略、验证器、空间需求和归档策略。Journal 记录每一步状态、checkpoint、重试次数和已复制对象摘要，不记录 secret。

所有步骤必须幂等。相同 plan 重跑应继续或确认完成，不能创建无限目标 Workspace。Server 侧使用 migration idempotency key。

Server 提供 `createOrGetMigrationTarget(migrationId, requestHash)`：同一 ID 与 hash 返回原目标；hash 不同拒绝。目标记录 migration provenance、创建账号和是否已有迁移外用户写入。只有 provenance 匹配、没有外部写入且审计成功时才允许清理。

### 3. 固定状态机

```text
PLANNED
→ TARGET_CREATED
→ SOURCE_FROZEN
→ COPYING
→ VERIFYING
→ READY_TO_CUTOVER
→ CUTOVER_COMMITTED
→ SOURCE_ARCHIVE_PENDING
→ COMPLETED
```

Cutover 前可以进入 `CANCELED_PRE_CUTOVER`；取消完成必须释放持久 freeze lease、恢复源可写并保留目标 provenance。Lease 带 migration owner 与过期/接管规则，崩溃恢复只能由同一 migration 或显式管理恢复接管，不能由普通打开操作偷偷解锁。

Cutover 后目标不可用进入 `TARGET_DEGRADED`，不自动激活旧源。用户可以等待恢复、导出目标本地副本，或显式选择 `REOPENED_SOURCE_FORK`；后者创建分叉并使原 migration terminal，后续再次迁移使用新 migration ID，不宣称能无损合并两边。

### 4. 写入策略

首个迁移原型在 copy 期间冻结源 Workspace 的产品写入，保留只读浏览；这比双写简单且可验证。规模数据证明冻结不可接受后，再评估增量 catch-up；Phase 3 的首个迁移原型不引入通用双写协议。

### 5. Cutover

只有以下条件全部成立才能切换：

- 每个必需数据域报告 copied 与 verified；
- blob 数量/摘要和引用完整性通过；
- 目标协议与当前客户端兼容；
- 目标 Workspace 可打开；
- authoritative active-ref pointer 可原子更新到新 Ref。

Cutover 是单一 active-ref pointer 的本地元数据事务；路由、最近访问和缓存均由它派生并可重建，不要求跨多个存储做虚假原子事务。完成后源默认 archive，不自动 purge。目标切换后失败不自动回写源；只能通过上述显式 fork 恢复决策避免无标记双向分叉。`COMPLETED` 表示 source archive 已确认；失败则保持 `SOURCE_ARCHIVE_PENDING`。

### 6. 跨域身份和旧客户端

Migration Plan 包含版本化 `ResourceIdMap`。优先保留由客户端生成且目标命名空间允许的资源 ID；发生冲突或目标要求新 ID 时，先建立完整映射，再迁移引用，最后验证 documents、blobs、tombstones、outbox 与 checkpoints 的引用完整性。

Cutover 在源的 authoritative local store 中生成 migration epoch 和旧 Ref terminal marker。Local Provider 的定义是不跨设备同步，因此该 marker 只约束共享这份本地 store 的旧进程或旧应用版本；它们重新打开后不得继续向旧源写入，未同步操作进入 quarantine。其他设备只能在 Cloud Workspace 创建后通过目标 Server 加入，不假定它们曾拥有同一 Local Ref。跨设备 Local 源迁移属于未来导入/导出协议，不在本 RFC 的安全承诺内。

目标 Server 在 create/cutover 前后权限撤销时停止迁移并保留源；cutover 后按 `TARGET_DEGRADED` 处理。Quarantine 内容可导出，或由数据域 migrator 显式重放到新 Ref。

### 7. 失败处理

| 失败阶段 | 行为 |
| --- | --- |
| preflight/create | 不改变源，清理或保留空目标供重试 |
| copy | 源只读但完整，按 checkpoint 继续；取消必须持久解冻源 |
| verify | 不 cutover，保留诊断和目标供检查 |
| cutover 前崩溃 | journal 恢复并重新验证 |
| cutover 后本地崩溃 | 依据事务标记只选择一个 active Ref |
| source archive 失败 | 新目标保持 active，报告待处理清理 |

取消迁移不会删除已存在目标，除非明确确认且 Server 证明它仅属于该 migration。

## 验收场景

1. 任一步骤重复执行不产生第二份业务对象或第二个目标 Workspace；
2. 复制任意百分比时崩溃，重启后源仍可读且能继续；
3. blob 缺失、schema 不兼容或目标无法打开时拒绝 cutover；
4. cutover 事务前后崩溃都只留下一个 active Ref；
5. 同 workspaceId 位于不同 sourceId 时不会覆盖缓存；
6. 取消不会误删用户已有 Cloud Workspace；
7. 迁移完成后源 archive，purge 需要独立确认和审计；
8. 取消或 freeze lease 恢复后源重新可写，不永久卡在只读；
9. 旧离线客户端与迁移中撤权不会写错目标，其本地操作进入可导出 quarantine。

## 取舍

采用“复制到新 Workspace + 短期冻结 + 原子 cutover”，放弃身份不变和迁移期间持续写入。它牺牲迁移窗口的可写性，换取清晰恢复语义；数据规模证明必要后再增加增量阶段。

## 非目标

- Cloud → Local 自动降级；
- 在两台 Server 间持续双写；
- 修改原 Workspace 的 sourceId；
- 迁移完成后立即永久删除源数据。
