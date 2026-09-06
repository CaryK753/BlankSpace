# RFC-0011：开发者黄金路径与 AI Contract

## 状态

Proposed

## 背景

Blankspace 的首要使用者是独立开发者和小团队。他们需要在不了解框架内部装配机制的情况下启动产品，也会让 AI 代理承担大量日常编码。仅提供目录建议和自然语言文档不能保证生成结果正确。

约束：

- 当前尚无实现，本 RFC 先定义体验验收面；
- 人与 AI 必须使用相同的公开工具和规则；
- 生成器不能静默覆盖产品代码；
- 默认流程必须简单，同时保留普通 TypeScript 逃生口。

## 决策

### 1. 三条黄金路径

创建并运行：

```bash
pnpm create blankspace my-app --preset workspace-saas
cd my-app
pnpm dev
```

创建业务模块：

```bash
blankspace module create documents
blankspace check
blankspace test --affected
```

添加 Kit：

```bash
blankspace kit add billing --adapter stripe --dry-run
blankspace kit add billing --adapter stripe
```

`remote-saas-core` 是不固定主体模型的 core preset；`workspace-saas` 是 Phase 1 首个完整黄金示例。`local-first-workspace` 在 Phase 2 之前只能标记为 unavailable，CLI 必须返回所需框架阶段，不能生成半可用项目。

### 2. 命令协议

所有会写文件的命令必须支持：

- `--dry-run`：计算完整变更集但不写入；
- `--json`：输出带 schema version 的结构化结果；
- 冲突即停止，不使用文本拼接覆盖已修改文件；
- 使用与 upgrade apply 相同的 change-set journal 保证崩溃恢复与重复执行幂等；
- 所有 change path 必须是 workspace-relative，解析真实路径和符号链接后仍位于对应所有权区域；
- 成功时列出 created、updated、unchanged、validation 和 nextActions；
- 失败时返回稳定错误码、文件位置、原因和安全修复建议。

候选结果结构：

```ts
interface ChangeSetResult {
  schemaVersion: '1';
  command: string;
  status: 'planned' | 'applied' | 'blocked';
  changes: Array<{
    path: string;
    action: 'create' | 'update' | 'delete';
    owner: 'product' | 'generator';
    patch?: string;
  }>;
  diagnostics: Diagnostic[];
  nextActions: string[];
}
```

删除文件默认不属于 safe change，必须由命令显式说明原因。

### 3. AI 上下文入口

项目根 `AGENTS.md` 是唯一稳定入口，指向与 `blankspace.lock` 一致的：

```text
docs/generated/blankspace-context.md
.blankspace/product-graph.json
.blankspace/contracts.json
.blankspace/commands.json
```

每个 JSON 必须带 `$schema` 和 `schemaVersion`。上下文必须声明：产品拥有区域、生成区域、禁止导入路径、可用 Contracts、标准验证命令和当前已实现能力。在线文档不能覆盖本地版本事实。

### 4. 权限等级

| 操作 | 默认策略 |
| --- | --- |
| 读取、inspect、check、dry-run | 允许 |
| 修改产品拥有区域 | 允许，必须返回 diff |
| 更新 package/config/未执行 migration | 允许生成变更集；apply 需要独立审查凭证 |
| 直接修改 generated、framework internal、兼容结论 | 拒绝；generated 只能由受信 CLI 依据可审查变更集重建 |
| 生产 migration、secret、签名与发布 | 不属于自动编码权限 |

独立审查凭证绑定 change-set hash、允许路径、过期时间和 reviewer identity，由交互式用户或预先配置的 CI policy 签发；发起变更的 AI 进程不能自行签发或扩大范围。凭证不包含 secret。普通 Product Overlay 源码修改可以按工作区既有策略直接进行，但仍必须输出 diff 并通过验证。

### 5. 验收场景

Phase 1 原型必须证明：

1. 新开发者在参考硬件、已安装 Node/package manager、正常网络且从命令开始计时的条件下，十分钟内运行 `workspace-saas` 示例；CI 同时记录冷缓存与热缓存结果；
2. AI 仅以根 `AGENTS.md` 为起点，按其声明读取机器上下文后能创建一个资源 CRUD Module；
3. 人和 AI 得到相同 Product Graph 与检查结果；
4. 生成器遇到手改文件时输出冲突且零部分写入；
5. 引入 Kit internal、跨 Module internal 或 client secret 时构建失败；
6. `test --affected` 至少运行新增 Module 及其消费者测试；
7. 上下文缺失、损坏、schema 不支持或与 lock 不一致时默认失败，并提示通过受信 CLI 重建，不能退回猜测模式。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 只提供模板与文档 | 实现最快 | 容易漂移，AI 只能猜测 | 拒绝 |
| 为 AI 单独提供专用 API | 可高度定制 | 人机行为分裂，维护两套系统 | 拒绝 |
| 共享 CLI、Contract 与诊断 | 单一事实源，可在 CI 验证 | CLI 协议需要稳定维护 | 采用 |

接受的代价是把 CLI JSON 和生成器行为纳入公共兼容面。若真实使用证明 JSON 稳定成本过高，只能版本化演进，不能退回非结构化输出。

## 非目标

- 自主决定产品需求；
- 自动操作生产基础设施；
- 用 AI prompt 替代 compiler/lint 边界；
- 为每个 AI 工具维护专属插件。
