# 基础 UI Shell 模板与路由

## 1. 目标与状态

Blankspace 首批提供两套同源但不强制共享组件树的基础模板：

- `sidebar-saas`：面向 Web/Desktop 的典型侧边栏 SaaS 布局；
- `mobile-tabs`：面向窄屏 Web/Capacitor 的底部导航与页面堆栈布局。

两者共享 Route、Navigation、Command、Screen state 和 Design Token 语义，分别决定布局、导航位置和 overlay 表现。当前文档和 proposed schema 是实现输入，不代表 React renderer、模板包或创建命令已经可用。

AFFiNE 证明了 React 工作区产品可以组合 Router、可折叠导航和成熟无障碍 primitives；其当前前端依赖中包含 React Router、Radix primitives、Floating UI、cmdk 和虚拟列表等，但 Blankspace 只参考这种组合方式，不复制 AFFiNE 的组件层级或产品导航：[AFFiNE frontend package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/core/package.json)。

## 2. 共同信息架构

```text
Root
├── Public layout
│   ├── Landing（产品可选）
│   └── Legal / Status
├── Auth layout
│   ├── Sign in
│   ├── Register
│   ├── Verify email
│   └── Recover account
└── App layout
    ├── Home
    ├── Product resources
    │   ├── List
    │   ├── Create
    │   ├── Detail
    │   └── Edit
    ├── Search / Command
    ├── Notifications（启用时）
    └── Settings
        ├── Profile
        ├── Members（主体支持时）
        ├── Billing（启用时）
        └── Integrations（启用时）
```

Route tree 决定 URL、权限和页面身份；Shell template 只决定这些 route 在何处呈现。React Router 官方支持 nested、layout 和 index routes，适合把 Auth/App/Settings 布局与 URL 层级显式对应：[React Router routing](https://reactrouter.com/start/framework/routing)。Blankspace 不把文件名约定写入公共 Contract；Product Compiler 生成具体 router adapter 输入。

## 3. `sidebar-saas` 桌面模板

### 3.1 线框

```text
┌──────────────────────────────────────────────────────────────┐
│ Sidebar                    │ Top bar                         │
│ ┌────────────────────────┐ ├─────────────────────────────────┤
│ │ Product / tenant switch│ │ Breadcrumb / title   Actions   │
│ ├────────────────────────┤ ├─────────────────────────────────┤
│ │ Home                   │ │                                 │
│ │ Primary resources      │ │        Route content            │
│ │ Saved / recent         │ │                                 │
│ │                        │ │                                 │
│ ├────────────────────────┤ │                                 │
│ │ Settings / Help / User │ │                                 │
│ └────────────────────────┘ │                                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 布局规格

| 区域 | Expanded | Collapsed | 责任 |
| --- | --- | --- | --- |
| Sidebar | 248 px 建议宽度 | 64 px 建议宽度 | product/principal switch、primary/secondary/utility navigation |
| Top bar | 56 px 建议高度 | 相同 | breadcrumb、页面标题、route actions、mobile sidebar trigger |
| Content | 剩余宽度 | 剩余宽度 | 当前 route outlet；页面自己决定 max width |
| Overlay root | viewport | viewport | dialog、popover、command palette、toast 的统一层级 |

具体尺寸通过 Component Recipe/Token 暴露，不是 Product Shell props。模板必须支持：

- Sidebar expanded/collapsed 状态持久化到本设备偏好，而非服务端业务模型；
- Primary、secondary 和 utility 三个语义区域；
- active、pending、disabled、badge 和 mandatory navigation 状态；
- 键盘折叠、跳到主内容、方向键/Tab 导航和焦点恢复；
- 长列表虚拟化或滚动区域，但不把虚拟列表库写入公共 Contract；
- 主体切换后清空不兼容 route state，并重新执行授权。

### 3.3 中等宽度

在 `medium` viewport 中，Sidebar 默认收起为 modal drawer，内容保持桌面页面语义。打开 drawer 后焦点进入导航，关闭后返回触发按钮；route change 自动关闭。不能只通过 CSS 把 248 px Sidebar 压窄到不可操作。

## 4. `mobile-tabs` 移动模板

### 4.1 线框

```text
┌──────────────────────────┐
│ Back?  Page title  Action│  ← safe-area aware header
├──────────────────────────┤
│                          │
│      Route content       │
│                          │
│                          │
├──────────────────────────┤
│ Home  Items  Create More │  ← bottom safe area
└──────────────────────────┘
```

### 4.2 规则

- Bottom navigation 最多显示 5 个一级目的地；超过时进入 `more` 页面，不横向滚动；
- 每个 tab 保留自己的 route stack 和滚动位置；重新点击当前 tab 回到该 tab 根 route，行为必须由 adapter 明确；
- Detail/Edit 使用同一 URL identity，但呈现为 stack push；临时 Create/Filter 可按 route metadata 呈现 full-screen sheet；
- Header 使用当前 route 的 title、back policy 和最多一个 primary action；其余动作进入 overflow；
- 触控目标、safe area、软键盘、返回手势和系统 Back 都进入 mobile fixtures；
- 桌面 hover、右键和快捷键只能作为增强能力，关键动作必须有触控入口；
- permission/error/offline 状态不得被 bottom bar 或 sheet 遮挡。

React Mobile 与 Desktop 可以共享 screen model、repository 和 route identity，但不自动复用 Desktop 页面。原生 SwiftUI/Compose 未来映射相同语义到 NavigationStack/系统导航，不消费 React element。

## 5. 响应式模式

首个 React Web renderer 使用三种语义 viewport class；S8 已冻结以下 conformance 阈值，实际执行证据仍待完成：

| Class | 冻结范围 | Shell 行为 |
| --- | --- | --- |
| `compact` | `< 768 px` | `mobile-tabs`；mobile page renderer |
| `medium` | `768–1023 px` | Desktop content + drawer navigation |
| `expanded` | `>= 1024 px` | 固定 `sidebar-saas` |

响应式变化不能改变 route identity、Actor 或数据权限。若某个 Screen 没有 compact renderer，Compiler 必须根据声明选择明确 fallback 或阻止 mobile target，不能在运行时显示空白页。

Web 窄屏切换和 Capacitor Mobile 是不同 target：前者可能在 resize 时改变 Shell；后者由 Mobile Runtime 固定选择 `mobile-tabs`，并额外处理系统生命周期和 native capabilities。

## 6. Route Contract

### 6.1 Route descriptor

每个 route contribution 至少声明：

| 字段 | 含义 |
| --- | --- |
| `id` | 稳定 route identity，不从 URL 文本反推 |
| `path` | 相对父 route 的 URL pattern；index route 不填写 |
| `parentId` | 父 route；形成无环树 |
| `screenId` | 对应 Screen Contract |
| `surface` | `public`、`auth`、`app` 或 `settings` |
| `access` | `public`、`signed-in` 或显式 policy ID |
| `presentation` | Desktop 与 Mobile 的页面呈现建议 |
| `params` | path/search params 的 schema 引用 |
| `errorBoundary` | route-local error renderer identity |

Route ID、Screen ID 和 URL 是不同事实。URL 可以在兼容升级中增加 redirect，Route ID 不随文案、导航位置或平台改变。

### 6.2 Navigation descriptor

Navigation 是指向 route 的可选入口，不是 route 本身。它声明：

- `id`、`routeId`、`labelKey` 和语义 `icon`；
- `region`: `primary | secondary | utility | mobile-primary | mobile-more`；
- priority 与稳定排序；
- required capability、badge source 和 visible policy；
- `mandatory` 只允许安全、法务或 Kit Contract 明确要求的入口。

同一 route 可以在 Desktop Sidebar 和 Mobile More 中有不同 navigation contributions，也可以没有常驻入口而只从详情链接进入。

### 6.3 Router adapter

Phase 1 React 候选锁定 `react-router@8.3.1` Data Mode；nested layout、loader/action、pending/error 能覆盖 SaaS 页面生命周期，同时不采用 Framework Mode 的文件/构建约定。公共 Route Contract 不暴露 `RouteObject`、loader args 或 React components，实际适用性仍由 S8 runner 验证。

```text
Route Contributions
→ Compiler 校验 ID、parent、path、access、renderer coverage
→ target-specific Route Graph
→ React Router adapter 生成 route objects/modules
→ Product Shell 渲染 outlet、navigation 和 route state
```

## 7. 标准页面与状态

基础模板必须交付以下页面 recipes，而不是只交付空壳：

| Recipe | Desktop | Mobile |
| --- | --- | --- |
| Auth | 居中 card 或 split layout | 单列、键盘安全、系统返回明确 |
| Resource list | toolbar + table/list + filters | list/cards + filter sheet + FAB/primary action |
| Resource detail | header + sections + optional inspector | stack page + sticky/overflow actions |
| Settings | settings sidebar + content | settings list → detail stack |
| Search/command | command palette | full-screen search route |

每个 recipe 固定 `loading | empty | ready | refreshing | error | permission-denied | offline`。Skeleton 保留最终布局；error 提供 retry/correlation；empty state 只在成功加载且确实为空时出现；permission denied 不泄漏资源存在性。

## 8. Product 定制边界

产品可以：

- 替换 Logo、字体、tokens、图标映射和页面 recipes；
- 隐藏或移动非 mandatory navigation；
- 增加 route/navigation/command contributions；
- 复制官方模板到 Product Overlay 后成为产品拥有的 Shell；
- 分别替换 Desktop 与 Mobile renderer。

产品不能：

- deep import 模板 internal component；
- 用 CSS selector patch 内部 DOM；
- 在 Shell 中绕过 route access 或 Service authorization；
- 因为移动端空间不足而隐藏 mandatory 安全/法务入口；
- 让 Desktop 和 Mobile 使用相同 route ID 表达不同业务资源。

## 9. 可访问性与交互门禁

- landmark、heading、page title 和 skip link 完整；
- Sidebar、drawer、bottom navigation、dialog 和 command palette 的可访问名称稳定；
- active route 不只依赖颜色；
- 200% zoom、系统字体放大和窄屏不丢失关键动作；
- 键盘、触控、屏幕阅读器和 reduced motion fixtures；
- route transition 宣告新页面标题，焦点按 navigation 类型恢复；
- drawer/dialog 无焦点陷阱泄漏，关闭后返回触发点；
- destructive action 需要明确确认和可恢复策略。

## 10. 实现与验证顺序

```text
冻结 proposed Route/Navigation/ShellTemplate schema
→ S8 锁定 React、Router、primitives、Playwright 与 a11y 工具
→ 实现 react-desktop sidebar-saas fixture
→ 实现 react-mobile mobile-tabs fixture
→ 接入同一组 route/navigation contributions
→ 标准状态、截图、键盘、触控和 a11y
→ 上一 minor Shell compatibility fixture
→ 作为 workspace-saas scaffold 的可选模板
```

首个实现不复制 AFFiNE 的编辑器、Workspace 业务或内部组件，只验证 SaaS Shell、路由和响应式边界。模板只有通过 S8 才能标记 `official`。
