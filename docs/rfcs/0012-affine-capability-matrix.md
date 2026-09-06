# RFC-0012：AFFiNE 能力矩阵与非功能基准

## 状态

Proposed

## 背景

“能够构建 AFFiNE 级产品”目前只是能力上限描述。它不应被理解为 Phase 1 复制 AFFiNE，也不能在缺少可验证维度时成为营销口号。本 RFC 把能力上限拆成逐步验收的产品场景。

## 决策

### 1. 验证方式

每项能力记录四种状态：

- `Unplanned`：未进入路线；
- `Designed`：Contract 已通过评审；
- `Prototyped`：纵向原型通过；
- `Verified`：参考产品和兼容 fixture 持续通过。

README 只能展示实际状态，不得以目标命令暗示 `Verified`。

### 2. 能力矩阵

| 能力域 | Blankspace 需要证明的通用能力 | 首个验证阶段 |
| --- | --- | --- |
| 身份与多 Server | Server-scoped session、官方/自托管并存 | Phase 3 |
| Workspace | Local、remote-only、local-replica provider | Phase 2–4 |
| 文档编辑 | Phase 2 experimental Engine Boundary；Phase 5 经第二用例晋级稳定 Editor Kit | Phase 2/5 |
| 白板/Edgeless | 自定义资源类型、渲染和大型画布集成 | Phase 5 |
| 数据库视图 | 同一数据的多视图、schema 和查询扩展 | Phase 5 |
| 文件 | 本地/远端 blob、迁移、去重与失败恢复 | Phase 3–5 |
| 搜索 | 本地索引、远端索引和 provider 能力 | Phase 5 |
| 权限与分享 | Workspace/resource scope、离线权限变化 | Phase 3–4 |
| 实时协作 | 增量复制、冲突、awareness、权限 | Phase 4 |
| 历史与恢复 | 本地备份、版本、迁移恢复点 | Phase 2–4 |
| AI | 产品 Module 调用模型，不污染 Foundation | Phase 5 |
| 跨平台 | Web/Desktop，后续 Mobile 差异裁剪 | Phase 1–5 |
| 深度 UI | Product Shell、contributions、视觉验证 | Phase 1 |
| 上游升级 | 旧 Overlay、Shell、adapter 与数据 fixture | Phase 1–4 |

这些是框架能力证明，不要求官方 Kit 垄断所有实现。Phase 2 按 RFC-0018 比较 Tiptap 类结构化文档 adapter 与 BlockSuite 类 Page/Edgeless adapter，产品可以深度使用上游 API，而不是虚构统一编辑 API；只有两个明显不同用例都通过才在 Phase 5 评估稳定 Editor Kit。Blankspace 验证的是集成、数据和升级边界，不自研这些领域引擎。

### 3. 非功能基准

具体数值需通过技术原型校准，但每个参考产品必须发布并持续测量：

| 维度 | 必须记录的指标 |
| --- | --- |
| 启动 | 冷启动、热启动、可交互时间 |
| 构建 | 初次构建、增量检查、受影响测试时间 |
| 产物 | 各 runtime bundle，未启用 Kit 是否被裁剪 |
| 数据 | Workspace 数、资源数、索引规模、迁移时间 |
| 编辑 | 大文档加载、输入延迟、内存占用 |
| 同步 | 首次同步、增量同步、离线队列、恢复时间 |
| 协作 | 并发客户端、冲突收敛、awareness 延迟 |
| 可靠性 | 崩溃恢复、重复/乱序、断网和磁盘不足 |
| 安全 | 租户隔离、权限拒绝、secret 边界、供应链 |
| 可用性 | 键盘、屏幕阅读器、响应式、多语言 |
| 升级 | 预检时间、自动迁移比例、人工检查项 |

RFC 不预填未经测量的漂亮数字。每个 Phase 在实现开始前必须冻结数据集、设备/浏览器、缓存和网络条件、计时边界、采样方式与回归阈值；退出时报告实测值和测试环境。

### 4. 参考产品梯度

仅用一个 AFFiNE 克隆会把框架边界误写成单一产品边界，因此维护两个参考产品：

1. `Reference SaaS`：remote-only、登录、Workspace、表单/列表和基础权限，验证通用 SaaS 简洁性；Billing 在 Phase 5 作为后续能力加入；
2. `Reference Workspace`：Local Workspace、Block 文档、迁移、复制和自定义 Shell，逐步逼近 AFFiNE 能力。

同一 Foundation API 必须同时服务二者；只对 Workspace 产品有意义的能力不得进入 Foundation。

## 验收场景

1. 每个路线阶段都能映射到矩阵状态变化和自动化证据；
2. 未安装 Local-first/Editor Kit 的 Reference SaaS 产物不包含相应实现；
3. Reference Workspace 完成首条 Local → Cloud 验证链；
4. 自定义 Shell 升级 fixture 与上一 minor 持续通过；
5. 性能、可靠性和可访问性回归有预算而非只看功能测试；
6. 新增 Foundation 领域能力原则上必须由两个参考产品共同需要，否则下沉到 Kit 或 Product；生命周期、编译、诊断等装配能力可通过 RFC 证明其为所有产品的结构性需求，并记录例外理由。

每项 `Verified` 证据必须链接到版本化 fixture、CI job、测试环境和最近通过时间。依赖的 Contract 或测试数据发生变化后状态自动退回 `Prototyped`，直至新证据通过。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 直接复刻完整 AFFiNE | 目标直观 | 周期巨大，框架被单产品绑架 | 拒绝 |
| 只做通用 TODO 示例 | 易完成 | 无法证明能力上限 | 拒绝 |
| 双参考产品 + 渐进矩阵 | 同时验证简洁性与上限 | 维护两套 fixture | 采用 |

## 重审触发条件

- 两个参考产品仍无法暴露 Kit 边界问题；
- 能力矩阵长期只有文档状态而无自动证据；
- AFFiNE 的关键产品形态发生根本变化。
