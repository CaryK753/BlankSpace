# 从零理解并构建一个 Blankspace 产品

> 本文描述 Blankspace 的目标开发体验，不是当前可执行教程。当前仓库仍处于 Phase 1A spike 阶段；文中的 CLI 在实现前均视为接口草案。

## 1. 先理解三个所有者

使用 Blankspace 不等于复制一份框架源码。一个产品由三层组合而成：

| 层 | 谁维护 | 开发者通常做什么 |
| --- | --- | --- |
| Foundation | Blankspace | 升级版本，不修改内部源码 |
| Optional Kits | Blankspace 或兼容作者 | 选择能力、adapter 和策略 |
| Product Overlay | 产品团队 | 编写业务、UI、数据与跨 Kit 流程 |

判断代码放在哪里时使用一个简单问题：它能否在两个不同产品中保持相同领域语义？如果能，可能属于 Kit；如果它表达当前产品的差异化体验，属于 Product Overlay。不要为了“以后可能复用”过早创建 Kit。

## 2. 目标黄金路径

```text
创建 workspace-saas 示例产品
→ 运行默认 Web 与 Server
→ 创建 Product Module
→ 通过 Service 使用 Kit 能力
→ 用 Coordinator 组合跨领域流程
→ 自定义 Shell 或语义 UI contribution
→ 检查 Product Graph
→ 运行受影响测试
→ 预检并应用框架升级
```

开发者不需要手写 Kit 初始化顺序、扫描注册文件或维护第二套依赖图。这些内容由 Product Compiler 从静态配置、package manifests 和源码边界生成。

## 3. 创建产品

目标命令：

```bash
pnpm create blankspace my-product --preset workspace-saas
cd my-product
pnpm dev
```

`pnpm create blankspace` 是无需预装 CLI 的脚手架入口；它调用与当前 scaffold package 同版本的创建实现。未来已安装的 `blankspace create my-product --preset workspace-saas` 是等价便捷入口，必须生成相同 change set 和 lock。自动化应固定 package/CLI 版本，不能混用两个不同版本。两个入口目前都尚未实现。

`remote-saas-core` 只提供 Identity、Database 和可靠身份邮件，不选择租户模型；`workspace-saas` 在其上增加 Workspace starter，是第一个可运行黄金示例。请求 `local-first-workspace` 时，在 Phase 2 交付前 CLI 必须明确返回 unavailable，不能生成半可用工程。

根配置示例：

```jsonc
{
  "$schema": "./node_modules/@blankspace/contracts/schemas/product-config.schema.json",
  "schemaVersion": "1",
  "preset": "workspace-saas",
  "product": "./product",
  "targets": ["web", "server"]
}
```

该 preset 已展开 Identity、Workspace 和 Database。只有需要替换某个 Kit 的 preset 配置时，才在根 `kits` 中再次声明同一 Kit；替换以完整配置对象为单位，不做字段级深合并。

配置是静态 JSONC 数据，只允许注释和尾逗号；不能执行函数、读取环境变量或通过任意 JavaScript 改变装配结果。Secret 使用结构化引用，值不进入 Product Graph。

## 4. Product Directory

```text
product/
├── manifest.jsonc
├── modules/
│   └── notes/
│       ├── module.jsonc
│       ├── public.ts
│       ├── shared/
│       ├── frontend/
│       ├── backend/
│       └── tests/
├── coordinators/
├── frontend/
├── backend/
├── theme/
└── assets/
```

产品团队拥有整个 `product/`。`.blankspace/generated/`、框架 packages 和生成后的兼容性结论不属于产品编辑区。生成器修改产品文件前必须给出可审查 change set。

产品 manifest 显式列出入口和模块：

```jsonc
{
  "$schema": "../node_modules/@blankspace/contracts/schemas/product-manifest.schema.json",
  "schemaVersion": "1",
  "entries": {
    "web": "./frontend/index.ts",
    "server": "./backend/index.ts"
  },
  "modules": ["./modules/notes"]
}
```

`entries` 和 `modules` 都允许缺省：一个产品可以只由 Module entries 构成，也可以暂时没有目录模块。空的 `entries` 没有意义，Compiler 应给出诊断；schema 只负责结构边界，跨文件语义由 Compiler 校验。

Compiler 先扫描 `product/modules/*/module.jsonc` 得到候选集。`modules` 缺省时启用全部候选；一旦显式填写，它就是候选集的 allowlist：列出的目录不存在会失败，未列出的候选不进入产品。最终结果按 Module ID 排序并写入 Product Graph，不能依赖文件系统顺序。

## 5. 创建第一个 Product Module

目标命令：

```bash
blankspace module create notes
```

最小描述符：

```jsonc
{
  "$schema": "@blankspace/contracts/schemas/module.schema.json",
  "schemaVersion": "1",
  "id": "notes",
  "requires": ["blankspace.workspace@^1"],
  "entries": {
    "shared": "./shared/index.ts",
    "web": "./frontend/index.ts",
    "server": "./backend/index.ts"
  }
}
```

Phase 1 TypeScript 中，`public.ts` 是跨 Product Module 的唯一导入入口。模块内部可以自由组织，但其他模块不得 deep import；Web entry 也不得导入 Server entry。Compiler 将声明的 Service 依赖与真实 import 对账。未来 Swift/Kotlin 使用生成 Contract module 与各自工具链的公开入口，不导入 `public.ts`。

简单模块不必生成所有目录。一个只贡献静态页面的模块可以只有描述符和 Web entry；目录结构随真实复杂度增长。

## 6. 选择 Kit 和 adapter

> 阶段说明：Phase 1 只实现 Identity、Workspace 和 Database 最小 Kits。本节的 Billing/Stripe 是 Phase 5 的目标示例，目前不可用。

Kit 提供跨产品复用的领域能力，adapter 连接具体供应商或技术。产品依赖 Billing Service，而不是 Stripe SDK：

```text
Product Module → Billing Service → Billing Kit → Stripe Adapter
```

目标命令：

```bash
blankspace kit add billing --adapter stripe
```

该命令应提出一个 change set，包括 package、根配置、SecretRef、`.env.example` 和 migration 变化。添加 Kit 不应要求开发者编辑 Foundation 注册表。

没有启用的 Kit 不进入目标 Graph 或 bundle。adapter 不支持所需 capability 时，Compiler 在构建前失败，不能运行到供应商 API 才发现。

## 7. Kit 之间如何交互

日常开发只使用三条规则：

| 意图 | 使用方式 |
| --- | --- |
| 需要返回值或确认成功 | 调用公共 Service |
| 通知一个已经发生的事实 | 发布 Event |
| 组合多个领域形成产品流程 | 编写 Product Coordinator |

例如注册后创建 Workspace 是产品流程：Coordinator 依次调用 Identity 和 Workspace Service，并明确处理部分失败。Blankspace 负责注入已绑定 Service，不引入 Command Bus、Workflow DSL 或隐藏式 Kit 探测。

如果多个 provider 都能满足同一 Service，产品必须显式选择。框架不按安装顺序或最高版本猜测。

## 8. 定制 UI

从低风险到高风险依次使用：

1. Design Tokens；
2. route、navigation、command、renderer 等语义贡献；
3. Product Shell；
4. 带兼容范围的 Public Override。

产品可以通过 Product Shell 获得完全不同的应用结构，而不复制认证、路由或 Workspace 内部实现。导入未公开框架组件不属于逃生口，Compiler 应直接拒绝。

后续多客户端 Runtime 允许选择 `universal-hybrid`（Web/Electron React + Capacitor React Mobile）或 `native-mobile`（Web/Electron React + SwiftUI/Compose）。这些 preset 当前不可用；详细目标体验见[客户端 Runtime 与多端开发](client-runtimes.md)。移动端共享 Screen/API/Design semantics，不承诺直接复用 Desktop 页面。

越靠后的方式，升级时产品承担的验证责任越大。Public Override 永远进入人工视觉复查。

## 9. 查看框架实际装配了什么

目标命令：

```bash
blankspace check
blankspace inspect graph
blankspace inspect service blankspace.workspace
blankspace test --affected
```

Product Graph 应解释：

- 某个 Kit、entry 或 binding 为什么存在；
- 它来自 preset、产品配置还是依赖；
- 哪些目标包含或排除了它；
- 某个 Service 最终绑定到哪个 provider；
- 修改某份 Contract 后为什么选择这些测试。

Graph 是配置、package manifests、源码边界和 lock 的派生事实，不是另一个需要手改的配置文件。

## 10. 跟随上游升级

```bash
blankspace upgrade 2.4.0 --check
blankspace upgrade 2.4.0 --plan upgrade-plan.json
blankspace upgrade --apply upgrade-plan.json
blankspace upgrade --verify upgrade-plan.json
```

`--check` 必须只读。计划需要分开列出安全更新、可执行 codemod、人工复查、阻塞项和数据 migration。`--apply` 只能修改计划内文件，并保留普通 diff 供审查。

产品越遵守公开边界，框架越能承担迁移责任；Public Override 需要产品验证，internal patch 不受兼容承诺保护。生产 migration、Secret 与发布凭据不由 AI 自动处理。

## 11. AI 编程闭环

AI 从产品根 `AGENTS.md` 开始，读取与 `blankspace.lock` 匹配的本地上下文，而不是先递归扫描整个仓库或查询最新在线文档：

```text
AGENTS.md
→ .blankspace/product-graph.json
→ .blankspace/contracts.json
→ .blankspace/commands.json
→ 目标 module.jsonc + public.ts
```

一次安全修改应形成闭环：

```text
确认产品拥有区域
→ inspect 当前 Graph/Contract
→ 使用结构化生成器或修改普通产品代码
→ blankspace check
→ blankspace test --affected
→ 汇报 change set、诊断与剩余人工步骤
```

AI 不得修改 generated 文件来消除错误，也不得通过全局 ignore/skip 开关绕过 Contract。框架诊断需要同时提供稳定错误码、人类说明、源码位置和仅在确定安全时给出的自动修复。

## 12. 当前可以做什么

当前仓库可用于评审架构、RFC、JSON Schema 和 spikes，也可运行最小 Product Graph 与 workspace source resolver。S1 已取得 provisional pass；S2 已在 Linux、macOS、Windows 上通过 TypeScript、Node、Vite、Vitest 五种 mode 及双 checkout/双 pnpm store 矩阵。当前下一工作项是 S3 bundle trace contract 与 fixture matrix。

因此现在不要按照本文命令创建真实产品，也不要基于示例发布 Kit。实施进度以 [Phase 1 实施蓝图](phase-1-blueprint.md) 和 [开发路线图](roadmap.md) 为准；设计细节分别见 [开发者体验](developer-experience.md)、[Product Module](product-modules.md)、[Optional Kit](kits.md)、[升级协议](upgrades.md) 与 [核心术语](glossary.md)。
