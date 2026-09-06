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

当前唯一 ready 工作项是 `A1-S5-01`：冻结串行 A→B→C→D factory/start/stop 生命周期 core、ready 状态、资源账本、启动失败回滚，以及幂等/并发 stop。开始前完整阅读：

1. [`implementation/phase-1a-work-items.json`](implementation/phase-1a-work-items.json) 中的 `A1-S5-01`；
2. [S5 启动失败与资源回收](spikes/S5-lifecycle.md)；
3. [RFC-0001 Foundation Boundary](rfcs/0001-foundation-boundary.md)；
4. [RFC-0002 Kit Contract](rfcs/0002-kit-contract.md)；
5. [验证策略](testing-strategy.md)、[安全模型](security.md)与已通过的 S2/S3/S4 regression corpus。

S4 已在 Linux、macOS、Windows 上取得 Pass。`A1-S5-01` 只允许实现最小、可测试的生命周期状态机和内存资源账本：不得提前加入 Event publish/dispatch、shutdown deadline、host 强制终止、真实网络/数据库资源、生产 Runtime 扫描或业务 Service/Kit。失败 start 的自身清理必须由 fixture 显式建模，Runtime 只反序停止已经成功 started 的前置 entries；主启动错误不能被 stop/cleanup 错误覆盖。若机器状态指向新的 work item，以机器状态和 work-item 文件为准，本节只作为人类导航。

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
- `assemblyId` 当前只是 graph-local；Graph/Registry 联合 identity 尚未实现。
- S2 已由三平台真实工具矩阵证明为 Pass；S3 仍必须独立证明最终 bundle module 与 source edge 对账。
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
