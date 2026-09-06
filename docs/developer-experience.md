# 开发者体验与 AI 编程

## 1. 主要使用者

Blankspace 首先服务独立开发者和小团队，包括大量使用 AI 编程代理的开发方式。他们希望快速验证产品，而不是先成为框架内部专家。

开发者选择 Blankspace 时，核心需求不是“拥有最多抽象”，而是：

- 数小时内得到可登录、可创建 Workspace、可持久化和可部署的完整骨架；
- 大多数业务开发只修改产品拥有区域；
- 能深度定制业务和 UI，而不 fork 框架；
- 本地、远端、桌面和同步能力可以逐步开启；
- 上游升级前能看到影响，升级后已有业务和 UI 仍可验证；
- AI 代理能理解边界、生成正确代码并自行检查。

## 2. 开发者承诺

Blankspace 应把以下体验作为产品验收标准。

### 2.1 第一次运行

```bash
pnpm create blankspace my-app --preset workspace-saas
cd my-app
pnpm dev
```

首次运行应直接提供：

- Web 与 Server 开发环境；
- 默认登录和 Workspace 流程；
- 一个示例 Product Module；
- 本机开发用 PostgreSQL 或远端 PostgreSQL 的连接配置；这不是 Local Workspace 数据库；
- 类型检查、测试和格式化命令；
- 与当前框架版本一致的本地文档；
- 为 AI 代理生成的项目说明与机器可读图。

创建项目不应要求开发者先理解 Kit 生命周期、依赖注入、构建注册表或同步协议。
`remote-saas-core` 是不固定主体模型的 Phase 1 core preset；`workspace-saas` 是带 Workspace starter 的首个完整示例。`local-first-workspace` 在 Phase 2 前必须明确返回 unavailable，不能生成半可用工程。

### 2.2 第一个业务模块

```bash
blankspace module create documents
```

生成：

```text
product/modules/documents/
├── module.jsonc
├── public.ts
├── service.ts
├── api.ts
├── frontend/
└── tests/
```

示例必须可以立即运行和修改，不生成无用占位层。简单页面允许只有 `module.jsonc` 和一个组件。

### 2.3 添加基础能力

以下 Billing 命令展示目标交互，不属于 Phase 1；Billing Kit 与支付 adapters 当前计划在 Phase 5 根据真实需求实现。

```bash
blankspace kit add billing --adapter stripe
```

CLI 应：

1. 安装兼容版本 packages；
2. 更新 Product 配置；
3. 生成环境变量模板；
4. 显示新增数据库 migrations；
5. 运行静态校验；
6. 输出需要开发者完成的最短清单。

## 3. 产品仓库边界

推荐产品仓库：

```text
my-product/
├── blankspace.config.jsonc
├── product/
├── tests/
├── public/
├── package.json
├── blankspace.lock
└── .blankspace/
    ├── product-graph.json
    ├── compatibility.json
    └── generated/
```

所有权规则：

| 路径 | 所有者 | 开发者是否编辑 |
| --- | --- | --- |
| `product/` | 产品 | 是 |
| `blankspace.config.jsonc` | 产品 | 是 |
| `tests/` | 产品 | 是 |
| `public/`、产品文档 | 产品 | 是 |
| 产品尚未执行的 migrations | 产品或 Kit | 仅通过生成器或审查后编辑 |
| `package.json`、`.env.example` | 产品 | CLI 可提出补丁，开发者审查后写入 |
| `blankspace.lock` | 框架工具 | 不手改，通过解析器更新 |
| `.blankspace/*.json` | 框架工具 | 否，可重新生成 |
| `.blankspace/generated/` | 框架 | 否 |
| `node_modules/@blankspace/*` | 框架 packages | 否 |
| 平台 host 工程 | 产品或受控生成器 | 通过明确策略编辑 |

生成文件必须带有机器可读标记并在构建时可重建。框架不得静默覆盖产品文件。
任何生成器修改已有产品文件前，必须先计算变更集；交互使用时显示 diff，CI/AI 使用时支持 `--dry-run` 和 JSON 输出。若目标区域已被产品修改且无法结构化合并，生成器应停止并报告冲突。

## 4. 深度 UI 定制

要做出 AFFiNE 级产品，开发者不能只修改主题色；但任意覆盖框架内部组件又会破坏升级兼容。

Blankspace 提供四级 UI 定制：

```text
Level 1  Tokens
颜色、字体、圆角、间距、动效

Level 2  Semantic Contributions
路由、导航、命令、设置、资源渲染器

Level 3  Product Shells
替换应用外壳、Workspace 布局、认证布局等稳定组件接口

Level 4  Explicit Overrides
针对带版本的公开组件进行有限覆盖
```

Product Shell 是深度定制的主要出口：

```ts
defineProductUI({
  shells: {
    app: ProductAppShell,
    workspace: ProductWorkspaceShell,
    auth: ProductAuthShell,
  },
});
```

Shell Contract 只提供稳定上下文和语义组件，不暴露框架内部 DOM。产品可以拥有完全不同的视觉结构，同时保留认证、路由、Workspace 和 Kit UI contributions。

首个 UI Shell RFC 必须具体定义：版本化 props/context、Kit contributions 的注入与排序、路由和焦点、命令与快捷键、弹层、错误/加载/权限状态、样式隔离、响应式和平台差异、可访问性，以及用于视觉回归的标准页面状态。没有这些可执行契约，不能宣称深度 UI 定制具有升级兼容性。

Explicit Override 必须声明目标公共组件与兼容范围：

```ts
overrideComponent(DefaultWorkspaceSwitcher, ProductWorkspaceSwitcher, {
  compatibleWith: '^2.1',
});
```

框架升级时，override 总是进入兼容性报告。未声明为 public extension surface 的内部组件不得覆盖。

### 4.1 选择客户端路线

Blankspace 的目标体验允许开发者按客户端选择 UI Runtime：

```bash
blankspace create my-product --preset universal-hybrid
blankspace create my-product --preset native-mobile
```

`universal-hybrid` 目标是用 React Desktop 覆盖 Web/Electron，用 React Mobile + Capacitor 覆盖 iOS/Android；`native-mobile` 目标是保留 Web/Electron React，同时生成 SwiftUI 与 Compose 客户端。也可以逐端混合选择，例如 iOS SwiftUI、Android Capacitor。

生成器只创建选中 UI Family 的目录和工具链配置。一个 Web-only 开发者不需要安装 Xcode/Gradle；选择 Hybrid 的团队不需要维护 SwiftUI/Compose。`blankspace inspect clients` 应输出每个 client 的 platform、Runtime、UI Family、Kit renderer coverage、capabilities、支持等级和缺失项。完整目标模型见[客户端 Runtime](client-runtimes.md)。

Swift/Kotlin Contracts 默认由锁定 schema 和 generator 在 `.blankspace/generated/<client>/` 生成；开发者不维护三份 DTO。React、SwiftPM 与 Maven artifacts 的逻辑绑定由 distribution manifest 和 `blankspace.lock` 解释，CLI 不能通过版本号相同猜测它们兼容。

## 5. 框架默认值与逃生口

开箱即用要求框架提供完整默认实现，而不是只有接口：

- 默认 App/Auth/Workspace shells；
- 默认错误、加载、空状态和权限界面；
- 默认数据库和开发环境；
- 默认日志、配置和健康检查；
- 常用 Kits 的默认 adapter 或明确安装向导。

同时必须允许产品替换 adapter、shell 和 public Service provider。逃生口必须显式、可诊断，不能要求修改 `node_modules` 或复制框架源码。

## 6. 开发反馈循环

以下命令组成稳定的开发接口：

```bash
blankspace dev
blankspace check
blankspace test --affected
blankspace inspect graph
blankspace inspect service blankspace.billing
blankspace explain error BS1024
blankspace doctor
```

要求：

- `check` 在数秒内完成增量检查；
- 错误包含文件、字段、原因和修复建议；
- `inspect` 输出人类可读结果，也支持 `--json`；
- `doctor` 检查版本、配置、数据库、adapter 和生成物；
- `test --affected` 根据 Product Graph 只运行受影响测试；
- 所有命令在 CI 中无交互运行并返回稳定退出码。

## 7. AI-first，而不是 AI-only

AI 编程优化必须让人类开发也受益。核心原则是把隐式规则变成机器可读、可执行契约。

### 7.1 项目上下文包

创建项目时生成一个总入口及其机器可读附件：

```text
AGENTS.md
.blankspace/product-graph.json
.blankspace/contracts.json
.blankspace/commands.json
docs/generated/blankspace-context.md
```

内容包括：

- 当前 Blankspace、Kit 和 adapter 版本；
- Product Modules 及依赖；
- 可用 Services、Events、UI contributions；
- public 与 internal import 边界；
- 允许编辑和禁止编辑的路径；
- 标准验证命令；
- 与已安装版本匹配的 API 示例。

AI 不应依赖可能已经过时的在线文档猜测当前 API。
`AGENTS.md` 是 AI 的稳定入口，指向与当前 lock 匹配的上下文文档和 JSON 文件；代理不必猜测应读取哪一份。所有 JSON 都必须发布 schema、schema version 和兼容策略。

### 7.2 结构化生成器

```bash
blankspace module create documents --json
blankspace service create documents.search --json
blankspace ui add workspace-shell --json
```

CLI 输出变更文件、Contract、后续命令和验证结果。AI 可以调用同一命令，而不是手工猜目录和 boilerplate。

### 7.3 可执行边界

重要规则必须由工具强制执行：

- 禁止导入 Kit internal；
- 禁止跨 Product Module 读取内部文件；
- 禁止 client entry 读取 server secret；
- 禁止手改 generated 文件；
- 校验 Service 和 Event schema；
- 禁止公共 Service 暴露 HTTP request、隐式 context bag 或其他 Kit 的 transaction；
- 检查 Runtime 不兼容依赖；
- 检查 UI override 的兼容范围。

AI 犯错时应收到可修复错误，而不是只违反一段长文档。

### 7.4 AI 友好诊断

```json
{
  "code": "BS1024",
  "message": "documents imports an internal billing module",
  "file": "product/modules/documents/service.ts",
  "line": 8,
  "expected": "Import BillingService from @blankspace/kit-billing",
  "fix": {
    "kind": "replace-import",
    "safe": true
  }
}
```

诊断同时提供人类文本和 JSON。只有确定、安全、局部的修改才能提供自动修复。

## 8. AI 修改的安全边界

默认允许 AI 修改：

- `product/`；
- 产品测试；
- `blankspace.config.jsonc` 中的非秘密配置；
- 产品文档。

默认禁止 AI 直接修改：

- `.blankspace/generated/`；
- 框架 packages；
- lockfile 中的兼容性结论；
- 生产 secret；
- 已执行的 migration；
- 平台签名和发布凭据。

需要修改框架边界时，AI 应生成建议或 RFC，而不是绕过 Contract。

## 9. 体验预算

Phase 1 以这些指标约束设计：

| 行为 | 目标 |
| --- | --- |
| 创建项目到首次运行 | 一个命令，十分钟内 |
| 创建简单模块 | 一个命令，生成不超过必要文件 |
| 常规业务修改 | 只修改产品拥有区域，不触碰框架源码或生成物 |
| 添加 Kit | 安装、配置、环境模板、校验一条命令完成 |
| 理解当前架构 | `inspect graph` 可回答 |
| AI 获取完整上下文 | 从 `AGENTS.md` 一个入口即可发现所需上下文 |
| 升级前判断风险 | 不修改文件即可生成兼容报告 |
| 错误定位 | 每个框架错误都有稳定代码和修复建议 |

具体时间可以根据原型调整，但任何新抽象都必须说明它是否改善这些指标。
