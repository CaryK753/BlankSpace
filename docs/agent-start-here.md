# Agent 从这里开始

## 1. 你的任务环境

假设你对 Blankspace 和此前讨论一无所知。本仓库当前只有 Contracts、严格 JSONC/canonicalization 和最小内存 Product Graph builder；没有能启动的 Web/Server、CLI、Kit 或部署系统。

先运行：

```bash
node --version
pnpm --version
fnm exec --using=24 pnpm test
fnm exec --using=24 pnpm verify:docs
```

默认 shell 的 Node 可能不是 24，因此项目命令统一包在 `fnm exec --using=24` 中。基线失败时先记录现有失败，不在未理解原因时修改测试或全局配置。

## 2. 五分钟心智模型

```text
静态 JSONC / manifests / package metadata
                    │
                    ▼
             Product Compiler
 resolve → validate → bind → target graph → registry
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      Web Runtime         Server Runtime
          ▲                   ▲
          └──── Kits + Product Overlay ────┘
```

- Contracts 定义公共数据，不执行产品代码。
- Compiler 读取静态输入并生成确定结果，不启动 Runtime。
- Runtime 以后只消费 Graph/Registry，不重新扫描或解析依赖。
- Kit 是可复用领域能力；Product Overlay 是产品自己的业务和 UI。
- 当前只实现图中 Compiler 的一小部分。

## 3. 如何选择任务

打开 [`implementation/phase-1a-work-items.json`](implementation/phase-1a-work-items.json)。只有 `status: ready` 的 item 可以直接实施。`blocked` 表示依赖或决策尚未满足；`done` 不重复实现。

当前 ready 或 in-progress item 同时记录在 [`status/project-status.json`](status/project-status.json) 的 `nextWorkItem`。两处不一致时 `pnpm verify:docs` 会失败。

不要从 roadmap 中随意挑选远期能力。路线图描述顺序，work-item 文件描述现在获得授权且具备输入的最小变更。

## 4. 当前代码任务

当前唯一 ready 工作项是 `A1-S8-02`：按已经冻结的 UI 工具链与双 Product Shell contract 实现本地 S8 conformance runner。开始前完整阅读：

1. [`implementation/phase-1a-work-items.json`](implementation/phase-1a-work-items.json) 中的 `A1-S8-02`；
2. [S8 双 Product Shell 与 UI 验收](spikes/S8-ui.md)；
3. [S8 UI 供应链审查](spikes/s8-ui/supply-chain-review.md)；
4. [基础 UI Shell 模板与路由](ui-templates.md)；
5. [RFC-0013 Phase 1 技术栈](rfcs/0013-phase-1-technology.md)的 React/UI 边界；
6. [验证策略](testing-strategy.md)、[安全模型](security.md)与[供应链政策](supply-chain.md)。

S2～S7 已取得 Pass。S7 在 macOS arm64 与 Ubuntu linux-amd64 上用 exact package 与 PostgreSQL digest 完成 14 场景正反序 corpus，canonical hash 为 `8e48920e5c1adc8b9cf327ffeeb195dcc48d2c4c8290a7f0822cbf751313df04`，Kysely 为 query-layer 选择且资源余额为零。S8 已冻结 React `19.2.8`、React Router Data Mode `8.3.1`、React Aria Components `1.21.1`、Playwright `1.63.0`、axe `4.13.0`、两个 Shell、八种状态与 browser/visual/a11y 门禁，但尚未安装或执行。`A1-S8-02` 必须先复核审查有效期和实际 pnpm tree，再实现本地 runner；不得把 Matrix frozen 写成 Pass。若机器状态指向新的 work item，以机器状态和 work-item 文件为准，本节只作为人类导航。

## 5. 决策顺序

遇到不明确内容时按以下顺序判断：

1. 正式 Schema 和当前源码；
2. 当前 work item；
3. 对应 RFC 与 Spike；
4. Phase 1 蓝图和架构文档；
5. 仍无答案则停止，登记为需决策问题。

不要用领域概览覆盖 Schema，也不要把 Proposed 多客户端契约加入当前 V1。

## 6. 常见误区

- `buildMinimalProductGraphs` 的输入是内存对象，不是完整 Compiler 入口。
- `assemblyId` 已在 S4 对 Graph/Registry 建立联合 identity；Runtime 仍不得重新扫描或重写 Registry。
- S2、S3、S4 已由三平台真实工具矩阵证明为 Pass；后续 workflow 必须保持这些 regression corpus 绿色。
- `dist/` 存在不代表发布流程已经完成。
- 文档中的 `blankspace ...` 大多是目标 CLI；当前使用 pnpm scripts。
- proposed schemas 供实验使用，不是当前稳定 package API。

## 7. Handoff 模板

```text
Work item: <current-work-item-id>
Scope completed:
Files changed:
Contract/schema impact:
Diagnostics added/changed:
Commands and environment:
Passed/failed/skipped:
Evidence path:
Known limitations:
Next item made ready:
```

若无法完成，说明准确 blocker、已尝试的非破坏性检查和需要的决策，不把工作项错误标记为 done。
