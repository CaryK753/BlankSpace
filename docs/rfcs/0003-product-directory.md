# RFC-0003：Product Directory 与 Module Boundary

## 状态

Proposed

## 背景

开发者需要清楚知道业务代码放在哪里、哪些文件属于自己、AI 可以修改什么，以及升级框架时哪些区域不会被覆盖。将每个功能强制做成 package 会拖慢小团队；完全自由目录又无法静态检查依赖和裁剪目标。

## 决策

### 1. Product Overlay

```text
product/
├── manifest.jsonc
├── coordinators/
├── shared/
├── modules/*/
├── frontend/
├── backend/
├── data/
├── theme/
├── assets/
└── locales/
```

`product/` 全部归产品所有并纳入版本控制。框架生成器可以提出 patch，但不能把生成实现写入其中后再宣称不可编辑。

### 2. Module 是一层目录边界

Compiler 只发现：

```text
product/modules/*/module.jsonc
```

子目录只是模块内部组织，不递归变成 Module。简单 Module 可以只有 descriptor 和一个入口；不要求 repository/controller/use-case 等固定分层。

Compiler 先扫描上述路径得到候选集。`product/manifest.jsonc#modules` 缺省时启用全部候选；显式存在时作为 allowlist。列出的目录不存在时编译失败，未列出的候选被排除，禁止把列表与扫描结果隐式合并。

### 3. Descriptor

```jsonc
{
  "$schema": "@blankspace/contracts/schemas/module.schema.json",
  "schemaVersion": "1",
  "id": "documents",
  "requires": ["blankspace.workspace@^1", "blankspace.editor@^1"],
  "optional": [{ "service": "blankspace.files@^1", "feature": "files" }],
  "entries": {
    "shared": "./shared/index.ts",
    "server": "./backend/index.ts",
    "web": "./frontend/index.ts"
  }
}
```

- `id` 在产品内永久唯一；删除后不能被不同语义复用；
- `requires` 决定启动和受影响测试依赖；
- `optional` 声明可供产品启用的 feature；未启用时不进入 Registry，启用后规范化为硬 requirement，不能让 Module 根据运行时存在性偷偷改变关键业务；
- descriptor 不执行 I/O；
- entry 必须位于本 Module 内且不能通过符号链接越界。

### 4. Public Boundary

每个需要被其他 Module 使用的模块提供 `public.ts`。跨 Module import 只能使用产品别名：

```ts
import { DocumentsService } from '#product/documents';
```

相对路径穿越模块边界、直接导入另一个 Module entry、Kit internal 或 Foundation internal 都是编译错误。`shared/` 只允许无业务所有权争议的类型、UI primitives 和工具；一旦包含领域状态或 Service，应归属具体 Module。

### 5. 贡献与编排

Module 可以贡献 Service provider、Event handler、route、navigation、command、setting、renderer、job、migration 和平台 entry。所有贡献必须有稳定 ID 并进入 Product Graph。

跨 Module/Kits 的产品流程放在 `product/coordinators/`，使用公开 Service 和 Event。Coordinator 不成为可被 Kits 依赖的底层 Contract，也不引入 Workflow DSL。

### 6. 数据生命周期

删除 Module 代码不删除数据：

```text
disable → remove code → archive data → purge data
```

`purge` 必须由显式、可审计管理操作或 migration 完成。Migration ID 使用 `<module-id>:<sequence>`，已执行 migration 不得修改；依赖其他模块数据的 migration 必须通过公开迁移 Contract 或产品级 migration 协调。

### 7. 产品拥有与工具管理区域

| 区域 | 规则 |
| --- | --- |
| `product/`、`tests/`、`public/`、产品文档 | 产品可直接编辑 |
| `blankspace.config.jsonc`、`package.json`、`.env.example` | 产品拥有，CLI 通过可审查 patch 修改 |
| `blankspace.lock`、`.blankspace/*.json`、generated | 受信工具生成，禁止手改 |
| Framework/Kit packages | 外部依赖，禁止 patch internal |

AI 使用相同边界。任何写命令都必须支持 dry-run、结构化变更集、冲突停止和崩溃恢复。

Module ID 与 migration 历史写入 `blankspace.lock` 的 tombstones。删除源码不会释放 ID；复用必须通过显式迁移 RFC，而不是删除一行 lock 记录。

## 验收场景

1. 一个只有页面的 Module 不需要生成多余层；
2. 一个复杂 Module 能分别贡献 web/server/data entry；
3. 跨 Module internal、entry 越界和符号链接越界在编译期失败；
4. Module ID 重用和 migration 篡改被拒绝；
5. 删除 Module 后数据保留，purge 需要独立明确操作；
6. Coordinator 可以直接单元测试，无完整应用和流程引擎；
7. AI 修改产品文件后，affected graph 能列出需要验证的消费者。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 每个 Module 都是 package | 隔离强 | 小功能开销大 | 未来可选，不作为 Phase 1 |
| 完全自由目录 | 上手快 | 边界、AI 和裁剪不可验证 | 拒绝 |
| 一层目录 Module + public boundary | 简单且可静态检查 | 超大型模块需自行内部组织 | 采用 |

## 重审触发条件

- 多个 Module 需要独立发布；
- 单层发现造成明显构建瓶颈；
- shared 持续成为规避所有权的垃圾场。
