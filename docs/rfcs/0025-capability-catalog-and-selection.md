# RFC-0025：Capability Catalog 与集成选型

## 状态

Proposed

## 背景

Integration-first 允许 Blankspace 复用成熟上游，但仅列出项目名称仍有三个问题：开源库与托管服务被当作等价 adapter；“候选”容易被误读为官方支持；统一 Contract 容易掩盖供应商能力、许可证和迁移差异。

本 RFC 冻结能力目录的分类、晋级和选择规则。具体候选和会变化的生态信息放在 [Capability Catalog](../capability-catalog.md)，不在 RFC 中冻结某个赢家或版本。

## 决策

### 1. 产品选择 capability，不直接选择品牌

稳定输入是命名 capability，例如：

```text
identity.authentication
authorization.check
jobs.enqueue
files.object-storage
search.full-text
notifications.transactional-email
feature-flags.evaluate
observability.telemetry
```

Kit 可以提供多个 capability，一个 capability 也可以由不同 Kit/adapter 提供。Product Graph 必须记录需求、provider 和解析结果，Compiler 在构建前拒绝缺失或冲突 provider。

### 2. Manifest 分离五个维度

每个 adapter/direct integration 至少声明：

- `capabilities` 及每项 portable/extended/provider-native；
- `deliveryModel`: embedded/self-hosted/managed/hybrid；
- `license`: SPDX 或 proprietary-service，并标记 open-core/source-available 边界；
- `supportLevel`: candidate/experimental/official-reference/verified/community/direct/deprecated；
- artifact/service coordinate、version、targets、owner、security contact 和 evidence。

`self-hosted` 不等于 OSS，`source-available` 不等于 OSI 开源，`managed` 不等于付费或专有；字段必须独立表达。价格、免费额度和销售套餐不进入稳定 Contract，只能是有核对日期的选型备注。

### 3. 支持状态具有严格语义

- `candidate`：只完成资料筛选，没有集成承诺；
- `experimental`：存在 spike，Contract 和数据可能变化；
- `official-reference`：Blankspace 维护指定矩阵和升级窗口；
- `verified`：第三方指定版本通过受信 conformance bundle；
- `community`：没有 Blankspace 持续兼容承诺；
- `direct`：Product Overlay 自行集成和维护；
- `deprecated`：有退出日期和迁移建议，不再推荐新产品使用。

Registry 展示的宣传名称不能提升 effective support level。过期、签名无效、Contract hash 不符或已撤回的 evidence 必须降级或阻断，而不是继续显示 verified。

### 4. 默认路线最小化运营面

Preset 只带完成其纵向目标所需的能力。初始 Web SaaS 优先验证能复用现有 PostgreSQL 的 embedded adapter；外部 Identity、Redis queue、Search cluster、Workflow engine、Notifications platform 和 analytics backend 都按需求显式增加。

默认最小不等于永远使用单体实现。选择器必须在 enterprise federation、关系授权、数据驻留、吞吐、隔离、离线或合规需求超过 starter capability 时给出升级路线和不满足项。

### 5. Contract 只覆盖真实公共语义

公共 Contract 只包含跨产品/Kit 需要稳定的输入输出、错误、生命周期、诊断和迁移 receipt。供应商高级能力通过 capability extension 或 provider-native API 使用，不扩大基础 Contract 去追求功能交集。

Product Graph 必须标记每个调用面的 portability：

- portable：受稳定 Contract 与迁移工具覆盖；
- extended：依赖可选 capability；
- provider-native：由产品承担上游升级和迁移。

### 6. 选型必须产生 Selection Record

未来 CLI 的每次集成选择至少输出机器可读记录：

```json
{
  "capability": "identity.authentication",
  "constraints": {
    "targets": ["web", "server"],
    "deliveryModels": ["embedded", "self-hosted"],
    "dataResidency": "product-controlled"
  },
  "selected": "better-auth",
  "supportLevel": "experimental",
  "reasons": ["typescript-runtime", "no-extra-service"],
  "rejected": [{ "id": "auth0", "reason": "managed-not-allowed" }],
  "evidenceAsOf": "2026-09-06"
}
```

自动选择只能在约束完整且结果唯一时执行；否则输出候选差异，不静默决定涉及数据驻留、许可证或外部付费服务的选项。

### 7. 官方参考 adapter 的晋级门禁

除 RFC-0020 的门禁外，晋级必须通过该 capability 的 conformance profile：

1. 正常行为与 typed errors；
2. 超时、限流、重复、乱序、撤销和部分失败；
3. secret、tenant/isolation、PII 和审计边界；
4. backup/export/import/reconciliation；
5. provider outage 和 degraded behavior；
6. 上一支持版本升级与回滚；
7. unsupported capability 的构建时或启动前拒绝；
8. Product Overlay 的真实纵向验证。

不同 capability 使用不同 profile，不能用一个通用 smoke test 给所有 adapter 授予 verified。

### 8. 替换需要迁移计划

“可替换”表示业务代码依赖稳定语义，并存在显式出口；不表示数据和运行状态可热切换。切换前必须生成影响报告，覆盖数据导出、身份重绑、密码/密钥、历史记录、进行中任务、订阅、索引重建、客户端兼容、停机和回滚。

如果 provider 没有充分出口，Product Graph 必须显示 lock-in risk，不能把它标成 portable。

### 9. AI Context 使用解析后的事实

AI context package 只输出当前 Product Graph 已解析的 capability、允许 imports、config schema、unsupported、diagnostics 和文档。AI 不得从 `package.json` 中看到一个 SDK 就假定对应 Kit 已启用，也不得把 Catalog 中的 candidate 写成当前可用功能。

## 与现有 RFC 的关系

- RFC-0002 定义 Kit/Service/Event；本 RFC 定义 capability 如何选择实现；
- RFC-0010 定义升级协议；本 RFC 增加 adapter、provider 和迁移风险输入；
- RFC-0017 定义支持证据与信任；本 RFC 复用其有效性原则；
- RFC-0020 定义 integration-first 与薄 adapter；本 RFC 补齐目录和支持状态；
- RFC-0021 至 0024 的领域 Contract 优先于 Catalog 中的候选描述。

## 验收条件

1. Catalog 能清楚区分 Better Auth 类 embedded OSS 与 Auth0 类 managed service；
2. 同一候选的 delivery、license、support 和 portability 不再压缩成一个标签；
3. 未验证候选不会出现在 Product Graph 中作为 official/verified；
4. 一个 capability 缺失或 provider 冲突时有稳定诊断；
5. 至少两个不同 adapter 通过同一领域 conformance，证明 Contract 没有镜像某一供应商；
6. provider-native 使用和退出风险可被 upgrade/context 工具识别；
7. Preset 不因目录扩展而静默增加服务。

## 非目标

- 冻结所有 SaaS 领域的唯一技术选型；
- 建立在线 marketplace 或远程自动安装；
- 保证所有候选开源、免费、可自托管或功能等价；
- 抽象供应商的全部高级 API；
- 承诺无停机、无损或自动 provider 迁移。

## 重审触发条件

开放标准已经完整覆盖某 capability、support/evidence 模型无法反映托管服务、真实产品普遍绕过公共 Contract，或维护多个官方 adapter 的成本超过替换价值时重审。
