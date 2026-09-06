# Blankspace Agent Guide

本仓库处于 Phase 1A，不是可用的 SaaS 框架。开始任何代码任务前先阅读：

1. `docs/agent-start-here.md`
2. `docs/current-implementation.md`
3. `docs/status/project-status.json`
4. `docs/implementation/phase-1a-work-items.json`
5. 当前 ready work item 引用的 RFC、Spike 与源码

## 工作规则

- 只领取 `phase-1a-work-items.json` 中 `status: ready` 的一个工作项。
- 公共 JSON 结构先修改 canonical Schema，再修改类型、producer/consumer 和 fixtures。
- `packages/contracts` 不依赖其他 workspace package；`compiler` 不执行产品代码。
- 不实现工作项 `nonGoals` 中的能力，不顺手加入 UI、Identity、Database、CLI、Runtime 或新编排平台。
- 不修改 `dist/` 或 `*.tsbuildinfo` 作为源代码；它们由 build 生成。
- 不使用 `skipLibCheck`、`@ts-nocheck`、全局 ignore/disable 或跳过测试掩盖问题。
- 新增依赖前先满足 `docs/supply-chain.md` 的审查要求；当前 ready 工作项不需要新依赖。
- TypeScript/JavaScript 文件遵守仓库全局行数限制，新增代码优先拆成小模块。

## 验证

使用 Node.js 24：

```bash
fnm exec --using=24 pnpm build
fnm exec --using=24 pnpm typecheck
fnm exec --using=24 pnpm test
fnm exec --using=24 pnpm verify:docs
```

完成后更新 work item evidence、相关 Spike 和 `project-status.json`；状态只能依据可复现证据推进。遇到公共契约未定义、需要新增依赖或工作范围超过当前 item 时停止并记录 blocker，不自行扩展设计。
