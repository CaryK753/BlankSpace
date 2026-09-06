# 参与 Blankspace 框架开发

> 当前仓库处于 Phase 1A spike 阶段。本文定义贡献流程和证据要求，不表示下文所有命令已经实现。

## 1. 贡献者首先判断改动类型

| 类型 | 例子 | 首要入口 |
| --- | --- | --- |
| 公共契约 | Service、Event、Graph、配置或 Shell schema | 对应 RFC 与 contracts schema |
| 风险验证 | resolver、bundle trace、生命周期、数据库或 UI 可行性 | `docs/spikes/` |
| Foundation 实现 | Compiler、Runtime、CLI、testing | `packages/` 与 Phase 1 蓝图 |
| 官方 Kit | Identity、Workspace、Database | Kit manifest、Contract 与 conformance fixtures |
| 产品示例 | Reference SaaS 或 AFFiNE 切片 | Product Overlay 与产品验收场景 |
| 文档修正 | 澄清现状、示例或导航 | 文档；涉及决策时仍需 RFC |

不要从“在哪个文件加代码”开始。先判断改动是否影响公共兼容面、确定性 Graph、target 边界、数据所有权或升级行为；命中任一项时必须追踪到 RFC 和 fixture。

## 2. 单一变更闭环

```text
确认问题与所有者
→ 找到现有 RFC/Contract
→ 冻结成功与失败场景
→ 必要时完成可删除 spike
→ 更新 schema 与 fixtures
→ 实现最小改动
→ 运行受影响验证
→ 记录命令、环境和结果
→ 更新状态与文档
```

实现不能成为事实源。公共结构以 JSON Schema 为边界事实源，架构决策以 RFC 为事实源，装配结果以 Product Graph 为事实源，当前完成度以状态文档和可复现验证为准。

## 3. 何时需要 RFC

以下变更必须修改现有 RFC，或在没有合适决策记录时新增 RFC：

- 增删 Foundation 职责；
- 增加新的 Kit 间交互原语；
- 改变 Service/Event/Graph/Registry/Module/Shell 公共契约；
- 改变 package 依赖方向、target 或 import 边界；
- 改变 Workspace identity、provider 或数据权威模型；
- 改变升级、恢复或兼容承诺；
- 引入新的核心工具且失败会改变架构选择。

实现细节、局部 bug 修复、保持契约不变的性能改进通常不需要新 RFC，但仍需要测试证据。不要为每个代码改动创建决策文档。

RFC 状态只能按证据推进：

```text
Proposed
→ 场景与失败条件完整
→ spike/fixture 通过
→ 实现与兼容验证通过
→ Accepted
```

`Accepted` 表示决策获得要求的证据，不等于相关远期能力全部完成。若证据推翻核心假设，应修订 RFC 并记录替代方案，不能只修改实现来绕开文本。

RFC 作者提出状态变更，仓库维护者负责审查；同一变更可由作者实现，但证据路径、基线 hash 和兼容分类必须可独立复核。公共 schema 的兼容新增保持当前 schema version；删除、重命名、收窄或改变既有字段语义属于不兼容变更，必须提升 schema major，并提供迁移或明确拒绝旧版本。

RFC baseline 的 schema 只验证结构；verifier 还必须比较所有编号 RFC 的实际文件集合，拒绝缺失、额外或重复路径，再逐文件验证 UTF-8 bytes SHA-256。

## 4. Spike 规则

Spike 用来回答一个会改变技术或架构选择的问题，必须可删除，不能悄悄成为生产实现。开始前在 `docs/spikes/S<n>-<name>.md` 冻结：

- 问题与非目标；
- 工具和运行环境；
- 输入 corpus 或 matrix；
- 成功阈值；
- 稳定错误分类；
- 失败后采取的替代选择。

执行后追加命令、时间、产物摘要和限制。环境不符合目标基线时最多标记 `provisional pass`。只有目标环境和最终候选工具重跑成功后才能记为 pass。

Spike 代码放在 `spikes/`，正式代码放在 `packages/`。把 spike 行为移入正式代码后，必须由正式工具链重新验证，不能沿用实验结果代替 typecheck 或集成测试。

## 5. Schema-first 变更

公开 manifest、Graph、diagnostic、change set 与 compatibility manifest 遵循：

1. 修改 canonical JSON Schema；
2. 增加有效、无效和兼容性 corpus；
3. 生成 TypeScript types 与 validator；
4. 实现生产者和消费者；
5. 验证旧 fixture 的读取或迁移路径；
6. 更新示例，确保示例能被同一 schema 校验。

不得手写一份 TypeScript 公共类型，再维护一份语义不同的 schema。Kit 配置采用两阶段校验：根 schema 校验通用容器，Compiler 根据已解析 Kit manifest 的版本化 `configSchema` 校验具体字段、adapter、capability 与 SecretRef。

## 6. Package 与依赖方向

Phase 1 目标 packages：

```text
contracts ← compiler
contracts ← runtime
contracts ← testing
contracts + compiler adapters ← cli
```

实际依赖以 RFC-0001 为准。核心约束是：

- contracts 不依赖 runtime、Kit、React 或具体 host；
- compiler 不执行产品代码；
- runtime 不重新解析 package versions 或扫描源码；
- Kit 不导入 Product Overlay；
- 产品和 Kit 只能通过公开 exports 导入 Foundation；
- Web/shared 不能导入 server implementation 或 server SecretRef。

为了方便测试而创建反向依赖同样属于边界破坏。测试辅助能力应通过 `testing` package 或 fixture adapter 注入。

## 7. 实现顺序

Phase 1A 按风险和依赖推进：

1. S1 配置与 schema；
2. S2 resolver；
3. S3 bundle trace；
4. S4 Graph/Registry assembly；
5. S5 lifecycle；
6. S6 server host；
7. S7 database；
8. S8 UI，为 Phase 1C 提供门禁。

S1～S7 未全部通过前不开始 Phase 1B 产品能力；S8 未通过前不开始 Phase 1C。可以编写不绑定具体领域的 1A 骨架，但不得借骨架提前承诺 preset、Kit 或 CLI 已可用。

## 8. 提交证据

每次实现型变更至少记录：

- 变更关联的 RFC、spike 或 issue；
- 实际运行的命令；
- Node、package manager、数据库和 OS 等相关环境；
- 通过、失败、跳过的检查；
- 未验证内容及原因；
- 对 Graph/schema/lock/generated 产物的影响。

增加或升级依赖还必须按[软件供应链政策](supply-chain.md)记录用途、owner、license、脚本、来源、漏洞、reviewer 和到期时间；没有审查记录的依赖不能进入 release。

不要只写“tests pass”。证据必须能让另一位贡献者在相同基线重跑。无法安装依赖、缺少目标 Node 或缺少外部服务时应报告阻塞，不得用 `skipLibCheck`、跳过测试或全局 ignore 获得绿色结果。

## 9. 文档与示例

文档中的命令和 API 必须标注为以下三类之一：

- 当前可执行；
- 目标接口草案；
- 未来提案，当前 schema 明确拒绝。

示例要使用与当前 schema 一致的字段和路径。修改 schema、CLI 名称、target 或阶段范围后，至少搜索 README、入门文档、对应领域文档和 RFC。发现设计与实现不一致时显式写出，不设置长期兼容层掩盖漂移。

文档或 RFC 修改必须运行 `pnpm verify:docs`。检查器覆盖严格 JSON 语法、Markdown 本地链接与代码围栏、带 `$schema` 示例验证、Schema formats、项目/Spike 状态对账，以及编号 RFC 的完整集合、稳定顺序和 SHA-256；它不替代行为测试或读者测试。权威来源与更新顺序见[文档维护规则](documentation-governance.md)。

## 10. 完成定义

一个变更只有在以下条件满足后才算完成：

- 请求范围内的行为已实现；
- 正向与失败场景都有测试；
- 相关 schema、types、diagnostics 和 examples 一致；
- 受影响 target 与升级 fixture 已验证；
- 没有越过所有权、internal 或 generated 边界；
- 文档诚实描述当前状态；
- 剩余限制被明确记录。

具体测试层次见[验证策略](testing-strategy.md)，实施顺序见 [Phase 1 蓝图](phase-1-blueprint.md)，决策状态见 [RFC 索引](rfcs/README.md)。
