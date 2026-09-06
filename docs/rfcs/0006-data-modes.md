# RFC-0006：Local、Remote 与 Replicated 数据模式

## 状态

Proposed

## 背景

local-first 是 Blankspace 可选能力，而不是所有数据的统一语义。同一产品可能让文档离线可写、账单只在服务端修改、设备偏好永远留在本地。

## 决策

### 1. 数据域显式选择模式

| 模式 | 写入提交点 | 权威状态 | 离线写入 |
| --- | --- | --- | --- |
| `remote` | Server 确认 | Server | 否 |
| `local` | 本地事务提交 | 本地 | 是 |
| `replicated` | 本地事务提交 | 本地写入耐久；数据域协议负责最终收敛和冲突裁决 | 是 |

模式按 Kit/Module 的数据域声明，不按整个产品设置单个布尔开关。UI 在调用 Contract 时应能读取 capability 和状态，但业务代码不能在运行时把同一数据集任意切换模式。

### 2. Replicated 最低不变量

```text
本地事务：写业务数据 + 写 change/outbox
→ 提交成功后更新 UI
→ 后台发送
→ 对端幂等应用
→ 更新 checkpoint/ack
```

- 网络失败不撤销本地提交；
- 每个 change 有稳定 operation ID；
- 重复、乱序和重连不会重复产生业务效果；
- 删除有可传播语义，不能只做本地物理删除；
- 同步状态与业务数据状态分开报告；
- 冲突策略属于数据域 Contract，不能由 transport 猜测。

Replicated 中“提交成功”表示操作已在本地耐久接受，不表示 Server 已确认或全局最终值已确定。数据域 Contract 必须声明 Server 是否参与权限/冲突裁决、哪些状态可能在同步后被标记 conflicted/rejected，以及用户如何保留或导出被拒绝的本地内容。

### 3. 不统一冲突算法

Replicated 不等于 CRDT。数据域可选择：单写者、版本检查、字段合并、操作日志或 CRDT，但必须声明收敛规则、删除语义和不变量。Billing 等远端权威数据不得因为安装 Local-first Kit 自动变成 replicated。

### 4. Schema 与协议

本地 schema、远端 schema、change format 和 sync protocol 分别版本化。兼容清单必须声明旧客户端窗口、双读/双写策略和离线设备重新上线行为。无法安全解释旧 change 的版本必须拒绝写入或进入只读恢复模式，不能丢弃。

跨数据域 transport-independent envelope、operation identity、batch、ack/checkpoint、quarantine、blob 与版本协商由 RFC-0019 定义。数据域仍拥有 payload codec、冲突与删除策略；采用该 envelope 不等于采用统一 CRDT。

### 5. 资源与错误

同步必须处理配额、磁盘不足、损坏记录、认证过期、权限撤销和附件部分上传。权限撤销后的本地未同步写入进入可导出 quarantine，由产品政策决定丢弃、申请恢复或复制到 Local Workspace。

## 验收场景

1. 产品同时运行 remote Billing、local Preferences 和 replicated Documents；
2. 本地事务在写 change 失败时不提交业务数据；
3. 相同 change 重放两次只产生一次业务效果；
4. 乱序、断网、崩溃和 checkpoint 丢失后最终恢复；
5. 权限撤销不会静默上传，也不会静默丢掉本地修改；
6. 旧离线客户端超过兼容窗口时进入明确恢复路径；
7. 未安装 Local-first Kit 的 remote SaaS 不包含复制实现。

## 取舍

选择每个数据域显式模式，而不是万能 Store/Operation API。代价是产品可能使用两三种数据访问方式；收益是事务、离线和失败语义保持诚实。

## 非目标

- 通用 CRDT 引擎；
- 多 Server 复制；
- 跨所有 Kits 的原子事务；
- 将远端缓存宣传为完整本地副本。
