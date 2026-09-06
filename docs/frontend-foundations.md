# 前端基础能力：i18n、图标与资源约定

## 1. 定位

Blankspace 的前端 Runtime 不只需要路由、Shell 和 Design System，还需要一组跨产品可复用、但不侵入业务语义的基础能力：国际化、图标语义、静态资源与 locale-aware 格式化。

这些能力属于 Client Runtime / Design System 的基础设施，不进入 Foundation 领域模型，也不要求所有平台共享同一个 UI library。

## 2. i18n

Product Overlay 继续拥有文案与语言资源：

```text
product/locales/
├── en/
│   ├── common.json
│   └── product.json
├── zh-CN/
│   ├── common.json
│   └── product.json
└── de/
    ├── common.json
    └── product.json
```

Kit 可以贡献自己的 locale namespace，但不得覆盖另一个 Kit 或 Product 的 key。推荐稳定 key 形态：

```text
product.settings.profile.title
kit.identity.signIn.title
kit.files.upload.failed
```

首个 React Runtime 应复用成熟 i18n 实现（例如 i18next/react-i18next 或等价方案），Blankspace 只冻结以下语义：

- locale discovery 与用户显式选择；
- fallback locale；
- namespace ownership；
- ICU/复数/日期/数字/货币格式能力；
- missing-key diagnostics；
- lazy locale loading 与 bundle splitting；
- SSR/CSR hydration 一致性；
- RTL 与 locale-aware layout metadata；
- locale 变更不能改变 Route ID、权限或业务对象 identity。

产品应优先使用 `Intl` / ICU 语义，而不是手工拼接日期、货币和复数字符串。

## 3. locale 的作用域

语言设置分三类：

- `runtime/system`：浏览器或系统首选语言，只用于初始建议；
- `account preference`：登录用户跨设备偏好；
- `device preference`：产品允许设备独立选择时使用。

具体产品决定持久化策略。Blankspace 不把 locale 强制写入 Account 或 Workspace 核心模型。

## 4. 图标系统

公共 UI Contract 不直接写 `lucide-react`、Heroicons、SF Symbols 或 Material Icons 的组件名，而使用稳定的语义 icon ID：

```text
navigation.home
navigation.settings
resource.create
resource.delete
status.success
status.warning
```

各 renderer 将语义 ID 映射到平台实现：

```text
Semantic Icon ID
→ React renderer: Lucide/其他 icon package
→ Apple renderer: SF Symbols 或自定义 asset
→ Android renderer: Material Symbols 或自定义 vector
```

首个 React Runtime 可采用 Lucide 作为候选默认包，但在 S8 前不冻结为公共 Contract。Product Overlay 可以覆盖映射或增加产品私有 icon，但 mandatory 安全/状态 icon 必须保留可访问语义。

## 5. 图标与可访问性

- 纯装饰 icon 默认对辅助技术隐藏；
- icon-only button 必须有稳定 accessible name；
- 状态不能只靠图标或颜色表达；
- RTL locale 下方向性图标是否镜像由语义声明，而不是全局 CSS 猜测；
- 产品不得依赖某个 icon package 的内部 SVG path 作为稳定 API。

## 6. 静态资源

`product/assets/` 保存产品品牌与业务资源；Theme 的设计资产可位于 `product/theme/assets/`。Compiler/Runtime 需要区分：

- build-time immutable asset；
- locale-specific asset；
- user-generated blob；
- remote CDN asset。

用户上传内容必须走 Files/Object Storage 能力，不应混入前端静态 asset pipeline。

## 7. 构建与验证

S8 UI gate 最终应增加：

- 至少两种 locale 的 Shell/route fixture；
- 文案扩张、窄屏和 200% zoom；
- RTL fixture；
- missing translation / fallback diagnostics；
- locale chunk 不应把未启用语言全部打进首屏 bundle；
- semantic icon 在 React renderer 中完整映射；
- icon-only actions 的 a11y 测试。

这些能力目前都是目标设计，尚未实现 React i18n adapter、locale compiler 或默认 icon package。
