# RFC-0010：升级计划、兼容清单与恢复

## 状态

Proposed

## 背景

Blankspace 只有在产品长期跟随上游时才具有框架价值。普通 package 更新无法解释 Kit、adapter、Contract、Client、Server、UI 和数据格式之间的兼容关系，也不能安全处理生成物和 codemod。

## 决策

### 1. 两份 lock 的职责

- package manager lockfile 固定实际 packages 和完整依赖树；
- `blankspace.lock` 固定 Blankspace 解析出的 Framework、Kit、adapter、Contract、Graph schema、Runtime 与 Server protocol 关系；
- `blankspace check` 必须验证两者一致，不一致时拒绝构建。

### 2. Compatibility manifest

每个 Framework、Kit 和 adapter release 发布机器可读清单：

```ts
interface CompatibilityManifestV1 {
  schemaVersion: '1';
  package: { name: string; version: string };
  frameworkRange: string;
  contracts: Record<string, string>;
  runtimes: Record<string, string>;
  serverProtocol?: { min: number; max: number };
  rollout?: {
    order: Array<'server' | 'client' | 'data'>;
    readFormats: string[];
    writeFormats: string[];
    incompatibleClient: 'reject' | 'read-only';
    offlineClientDeadline?: string;
  };
  deprecated: Change[];
  breaking: Change[];
  codemods: Codemod[];
  migrations: MigrationDescriptor[];
}

interface MigrationDescriptorV1 {
  id: string;
  owner: string;
  contentHash: string;
  mode: 'transactional' | 'checkpointed';
  requiredFrom: string;
  compatibleAppVersions: string;
  backupRequired: boolean;
  checkpointSchema?: SchemaRef;
  externalSideEffects?: Array<{
    kind: 'object-storage' | 'search-index' | 'external-api' | 'filesystem';
    scope: string;
  }>;
  recovery: {
    strategy: 'forward-fix' | 'restore-backup' | 'manual';
    runbook: string;
  };
}
```

能在单个 PostgreSQL 事务完成的 migration 必须使用 `transactional`。无法保持单事务的长任务或外部数据变更必须使用 `checkpointed`，定义持久检查点、幂等重入和已处理范围；不能用普通进程内游标冒充恢复能力。没有明确 recovery、runbook、兼容应用版本或所需备份的 descriptor 在计划阶段标记 `Blocked`。

合法组合如下；schema 与 plan validator 必须拒绝表外或条件不满足的组合：

| mode | recovery.strategy | 语义与附加条件 |
| --- | --- | --- |
| `transactional` | `forward-fix` | 事务已回滚到旧状态；修正实现后从 migration 起点完整重跑，不读取 checkpoint |
| `transactional` | `manual` | 事务回滚后停止，由 owner 按 runbook 决定重跑或放弃 |
| `transactional` | `restore-backup` | 仅当 `backupRequired=true` 且 `externalSideEffects` 非空时允许；事务内状态先回滚，再按 runbook 恢复每个已声明副作用 |
| `checkpointed` | `forward-fix` | `checkpointSchema` 必需；修正后从已验证检查点幂等继续 |
| `checkpointed` | `restore-backup` | `checkpointSchema` 和 `backupRequired=true` 必需；停止新批次后进入备份恢复 |
| `checkpointed` | `manual` | `checkpointSchema` 必需；保留检查点并等待 owner 决策 |

清单必须签入 release artifact 并可离线读取。发布物、manifest 和 codemod 必须经过 package registry 完整性校验；未来引入第三方 Kit 前必须通过供应链 RFC 决定额外签名与信任策略。解析器输出所选版本及每个排除候选的原因，不能只返回“依赖冲突”。

### 3. 四阶段升级

```text
check（只读求解和影响分析）
→ plan（冻结输入、变更集和验证）
→ apply（代码级事务化应用）
→ verify（图、类型、测试、构建和 migration 预检）
```

Plan 必须包含源/目标版本、输入文件 hashes、package/config/codemod changes、generated diff 摘要、UI 人工检查项、数据 migrations、验证命令和恢复点。输入 hash 变化后旧 plan 失效。

每个 migration 的计划还必须包含执行 owner、模式、预计影响范围、检查点/重入方式、应用兼容窗口、备份证据、恢复决策人和 runbook hash。生产执行记录实际 operator、开始/结束时间、最后检查点和结果；这些审计字段不进入可复现 Product Graph。

### 4. Apply 原子性

`apply` 在项目同一文件系统的临时工作区计算结果，所有代码与 lockfile 步骤成功后才原子替换工作树。任何步骤失败或进程重启后，工具根据 upgrade journal 恢复原工作树。已存在的用户未提交和未跟踪文件都属于 plan 输入，不能被覆盖；输入集合、文件 hash、工具版本与解析结果变化都会使 plan 失效。空间不足、权限、符号链接越界或无法保证原子替换时必须在写入前停止。

`apply` 完成后项目进入 `applied-unverified` 状态。`verify` 成功后才提交新的 `blankspace.lock` 完成标记；失败时默认保留差异供诊断，并提供 `blankspace upgrade --restore <plan-path>` 恢复代码和两份 lock。验证命令为 `blankspace upgrade --verify <plan-path>`；apply、verify 和 restore 都从 plan 读取源/目标版本，不再接收位置参数 version。CI 可在 `--verify` 时使用 `--restore-on-failure`，让验证失败立即执行同一 plan 的代码级 restore；结果必须分别记录验证失败与恢复结果。恢复不包含任何数据库 migration。

数据库 migration 与生产部署不由 `apply` 自动执行。它们使用独立审批、备份和恢复流程，因为 forward-only migration 通常不能安全回滚。

失败后的默认决策由 descriptor 的两个字段共同决定，并严格遵循上表：transactional 先回滚，checkpointed 先停止并固化检查点；随后才执行所选 recovery strategy。`manual` 始终阻止自动继续。只有 compatibility manifest 明确旧应用仍能读取当前部分状态时才允许应用回退。任何 PITR 会影响恢复点后的其他写入，必须由产品运维负责人审批并先量化数据损失窗口。

`externalSideEffects` 必须穷举事务外写入的类型和稳定资源范围；普通 PostgreSQL 事务内写入不得列入。实际 trace 出现未声明副作用时 migration 失败，`scope` 为空、重复或无法由 runbook 定位时 plan 标记 `Blocked`。非空声明也不会自动授权外部写入，执行权限仍由部署流程单独批准。

### 5. 风险分类

| 等级 | 例子 | 默认处理 |
| --- | --- | --- |
| Safe | 兼容 Contract、重生成文件 | 可计划执行 |
| Codemod | 已知 API 机械替换 | 展示 diff 后执行 |
| Manual | Shell major、Public Override、业务语义变化 | 阻止自动完成 |
| Data | 本地/远端/replicated schema | 只预检，不自动生产执行 |
| Blocked | 无兼容 adapter、协议无重叠 | 不生成可应用计划 |

### 6. 滚动升级

涉及 Client、Server 或 replicated 数据时，manifest 必须描述：

- 协议重叠范围；
- 允许的发布顺序；
- 最低客户端与服务端版本；
- 旧格式双读/双写窗口；
- 离线旧客户端重新连接策略；
- 不兼容时拒绝连接还是只读降级。

没有安全发布顺序的目标版本必须标记 `Blocked`。

## 验收场景

1. 一个上一 minor 生成且含自定义 Module/Shell 的产品能无修改或经声明 codemod 升级；
2. 不兼容 adapter 给出完整约束链和候选版本；
3. plan 后修改任一输入文件，apply 因 hash 不匹配停止；
4. codemod 中途失败时工作树和两份 lock 均不变化；
5. Public Override 被列为人工复查，确认记录包含操作者与差异摘要，不能由 AI 自动确认；
6. Client N、Server N+1、离线 Client N-1 的组合有协议 fixture；
7. forward-only migration 明确备份点、事务或检查点模式、幂等重入、应用兼容窗口、恢复 owner 和不可自动回滚边界；
8. 磁盘不足、进程中断、重复 apply 与 verify 失败均不会留下无法识别的半完成状态。
9. 非事务 migration 在任一检查点失败后可按相同 descriptor 重入，或以明确的 Blocked 状态转交 runbook；系统不自动选择 PITR 或应用回退。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 只依赖 SemVer 和 package manager | 生态成熟 | 表达不了跨维度产品语义 | 拒绝 |
| 永远保持内部兼容 | 理想体验 | 限制演进且不现实 | 拒绝 |
| Public Contract + manifest + plan | 影响可解释、可自动验证 | 发布和 CI 成本较高 | 采用 |

接受的代价是每个稳定 Kit 和 adapter 都必须维护 manifest 与旧产品 fixture。没有这份成本，就不能对外宣称可平滑升级。

## 非目标

- 自动批准生产数据迁移；
- 支持 internal patch；
- 保证任意 Public Override 视觉不变；
- 将 Git 作为唯一恢复机制。
