# RFC-0007：AFFiNE 参考产品首个纵向切片

## 状态

Proposed

## 背景

直接实现完整 AFFiNE 会同时引入编辑器、白板、同步、权限和多平台复杂度。只做普通 TODO 又无法验证 Blankspace 的能力上限。需要一条最小但能穿过关键架构边界的纵向切片。

## 决策

### 1. 用户流程

```text
创建 Local Workspace
→ 创建 Block 文档
→ 编辑并本地持久化
→ 关闭应用并离线重启
→ 选择一台 Server
→ 迁移为新的 Cloud Workspace
→ 建立本地副本与单 Server 同步
→ 第二客户端打开并收到更新
```

### 2. 需要经过的边界

| 边界 | 切片证明 |
| --- | --- |
| Foundation | Compiler、Graph、Runtime、diagnostics 可工作 |
| Workspace Kit | Local 与 Local-replica Providers 使用同一公开 Contract |
| Server Scope | Server 独立认证、发现和协议 |
| Editor boundary | 按 RFC-0018 使用 experimental adapter，不要求通用编辑 API 或提前承诺稳定 Kit |
| Local-first | 本地事务、outbox、重放和状态 |
| Product Overlay | 页面、Shell、迁移 Coordinator 不修改 Kit internal |
| Upgrade | 上一 fixture 经 manifest/plan 升级 |

### 3. 最小功能范围

- Workspace 标题；
- 单一 Block 文档类型和最少文本 blocks；
- 本地 document/blob storage；
- 显式同步状态；
- 单用户、两客户端；
- 单一 Server；
- 可恢复 Local → Cloud 迁移；
- 默认 Shell 和一个结构不同的 Product Shell fixture。

### 4. 明确排除

- 白板、数据库视图、AI、评论和完整搜索；
- 多用户权限模型和 awareness；
- 多 Server 同步；
- 通用编辑器或通用 CRDT；
- 生产级规模和 SLA。

排除项不代表长期不支持，而是防止它们掩盖框架契约是否成立。

### 5. 可观察证据

切片必须保存：Product Graph、bundle trace、迁移 journal、同步操作日志、标准 UI fixtures、测试环境和版本。失败注入至少覆盖断网、重复 change、迁移中断、目标 Server 拒绝、磁盘不足和旧协议。

## 验收场景

1. 完全离线创建、编辑、重启后内容一致；
2. 迁移中断后原 Local Workspace 可继续打开；
3. 迁移完成后新旧 Ref 不混淆，第二客户端能打开新 Ref；
4. 相同同步操作重复/乱序后两端收敛；
5. 未启用的 Billing、Search 和协作实现不在产物中；
6. 自定义 Shell 不复制 Workspace/Sync internal；
7. 对一个已知兼容的小版本执行升级，Graph、业务数据与自定义 Shell fixture 通过；复杂 breaking migration 留给独立升级测试矩阵。

## 取舍

该切片比 remote SaaS 示例复杂，因此不作为 Phase 1 的首个实现；它分布在 Phase 2–4 渐进完成。它比完整 AFFiNE 小，但足以让 Workspace、Provider、local-first、Editor 和升级边界共同接受压力测试。

Phase 2 不依赖 Phase 5 Editor Kit：先执行 RFC-0018 的 E1 experimental boundary；Phase 4 同步使用 RFC-0019 envelope；只有第二真实 Editor 用例也通过后，Phase 5 才评估稳定 Kit API。
