# 配置参考

本文集中说明当前 Phase 1 schema 接受的配置。它是阅读帮助，字段合法性仍以 `packages/contracts/schemas/` 为准。文中的多客户端示例属于 Proposed schema，不可放入当前配置。

## 1. 配置层级

```text
blankspace.config.jsonc
└── product → product/manifest.jsonc
                └── modules[] → product/modules/*/module.jsonc
```

三层文件都使用静态 JSONC：允许行注释、块注释和尾逗号；拒绝重复 key、函数、变量、环境读取和其他 JavaScript 表达式。V1 路径必须以 `./` 开始并使用 `/` 分隔，不允许绝对路径、反斜杠、`..` segment 或路径内部的 `/./`。

## 2. 根配置 V1

```jsonc
{
  "$schema": "./node_modules/@blankspace/contracts/schemas/product-config.schema.json",
  "schemaVersion": "1",
  "preset": "workspace-saas",
  "product": "./product",
  "targets": ["web", "server"],
  "kits": {
    "@blankspace/kit-database": {
      "adapter": "postgres"
    }
  },
  "enabledFeatures": ["documents/search"]
}
```

| 字段 | 必需 | 语义 |
| --- | --- | --- |
| `$schema` | 否 | 编辑器提示，不参与运行时决策 |
| `schemaVersion` | 是 | 当前只能是 `"1"` |
| `preset` | 否 | 要展开的静态默认组合；Phase 1 候选为 `remote-saas-core` 或 `workspace-saas` |
| `product` | 是 | Product Directory 相对路径 |
| `targets` | 是 | 非空、无重复；V1 只允许 `web`、`server` |
| `kits` | 否 | 以 package identity 为 key 的完整 Kit 配置覆盖 |
| `serviceProviders` | 否 | Service ID 到 provider package identity 的显式选择；只在过滤后仍有多个候选时需要 |
| `enabledFeatures` | 否 | 显式启用的 Module optional feature，格式为 `<module-id>/<feature-id>` |

Preset 展开后，同 ID 的产品 `kits` 项替换整个 Kit 配置对象，不做字段级深合并。未知字段一律失败。Kit 自身配置由对应 Kit schema 继续校验；根 schema 中的开放对象不是绕过 Kit 校验的出口。

`serviceProviders` 不是安装列表，也不允许把不满足 target、capability 或 version range 的 provider 强行绑定。Compiler 先过滤候选：零个失败、一个自动选择、多个时要求这里存在唯一选择；配置了不存在、不兼容或没有消费者的选择同样失败。key 使用不带版本的 Service ID，value 使用实际提供它的 package identity。

例如同时安装两个兼容的 Search provider 时，产品需要增加：

```jsonc
{
  "serviceProviders": {
    "blankspace.search": "@acme/search-postgres"
  }
}
```

`enabledFeatures` 使用全局无歧义的 `<module-id>/<feature-id>`。Compiler 必须确认 Module 已声明对应 `optional` requirement；启用后把它规范化为硬 requirement，再参与 provider 解析、affected tests 和贡献裁剪。重复、未知、未被产品 allowlist 启用的 Module 或没有对应 optional 声明的 feature 均失败。未列出的 optional feature 不进入 Graph、Registry 或 bundle。

配置不能包含 secret 值。密码、token 和私钥使用 Kit 定义的 `SecretRef`，由运行环境解析；SecretRef 的名称可进入 Graph，值不能进入 Graph、日志或生成物。

## 3. Product Manifest V1

```jsonc
{
  "$schema": "../node_modules/@blankspace/contracts/schemas/product-manifest.schema.json",
  "schemaVersion": "1",
  "entries": {
    "web": "./frontend/index.ts",
    "server": "./backend/index.ts"
  },
  "modules": ["./modules/documents"]
}
```

`entries` 和 `modules` 可以省略。`modules` 省略时启用扫描到的全部 `product/modules/*/module.jsonc`；一旦出现，它就是 allowlist。不存在、重复、越界或未声明的目录失败。空 `entries` 虽能通过结构 schema，但会由 Compiler 给出无意义配置诊断。

## 4. Product Module V1

```jsonc
{
  "$schema": "@blankspace/contracts/schemas/module.schema.json",
  "schemaVersion": "1",
  "id": "documents",
  "requires": ["blankspace.workspace@^1"],
  "optional": [
    { "service": "blankspace.search@^1", "feature": "search" }
  ],
  "entries": {
    "shared": "./shared/index.ts",
    "web": "./frontend/index.ts",
    "server": "./backend/index.ts"
  }
}
```

`id` 使用小写 kebab-case。`requires` 是硬 Service requirements；解析不到唯一兼容 provider 时失败。`optional` 必须绑定稳定 feature ID：provider 缺失时删除该 feature 及其显式 contributions，业务代码不能在运行时偷偷探测 Kit。`entries` 至少一个且 V1 只允许 `shared/web/server`。

跨 Module TypeScript 导入只能通过目标 Module 的 `public.ts`。`web` 不能导入 `server`，client 代码不能读取 Server Secret。声明依赖与真实 import graph 不一致时由 Compiler 失败。

## 5. 多客户端 V2 边界

未来客户端输入由 [`ProductClientsV2`](schemas/proposed/client-runtime/product-clients-v2.schema.json) 描述，包含 ClientTarget、锁定 Runtime、根 capability requirements 和 feature exclusions。它与 Runtime/Kit、Graph V2、Theme 和 Upgrade schemas 都位于 Proposed 目录。

不要把 `clients`、`runtime`、`uiFamily`、SwiftPM 或 Maven 字段加入 V1 根配置。当前 V1 schema validator 必须拒绝；未来 Compiler 也必须拒绝而不是忽略。只有 RFC-0017、CR1/DS1 和 schema major 迁移通过后才能启用。

## 6. 解析与优先级

```text
读取并严格解析 JSONC
→ 按当前 schema 校验单文件
→ 展开 preset
→ 以完整对象应用产品 Kit 覆盖
→ 扫描并应用 Module allowlist
→ 校验 enabledFeatures 并规范化为硬 requirements
→ 解析 Service/provider/adapter
→ 应用 serviceProviders 消除多候选；拒绝无效或多余选择
→ 对账 import 与 entry 边界
→ 生成确定性 Product Graph
```

文件系统顺序、安装顺序、对象 key 顺序和当前工作目录不能影响结果。多解不猜测优先级；缺失或冲突必须返回稳定 diagnostic。

## 7. 当前验证

```bash
pnpm verify:docs
pnpm test:s1
python3 spikes/s1-config/validate_schemas.py
pnpm typecheck
```

这些命令验证文档、JSONC、schema corpus 和当前 TypeScript 源码，但不等于完整 Compiler 已实现。Node.js 24 下的测试证据已经取得；最终生产 validator 和规定的跨平台矩阵仍未关闭，因此 S1 保持 Provisional pass。当前可运行边界见[当前实现参考](current-implementation.md)。
