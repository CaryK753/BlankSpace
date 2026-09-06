# 客户端 Runtime 与多端开发

## 1. 目标

Blankspace 同时支持两种移动端路线：以 React + Capacitor 获得高复用和快速交付，以 SwiftUI/Jetpack Compose 获得原生平台体验。开发者按客户端选择路线，不要求一个产品的 iOS 和 Android 使用相同 UI 技术。

当前这些能力尚未实现。Phase 1 只交付 `web`/`server`；概念契约见 [RFC-0015](rfcs/0015-client-runtimes.md)，Graph V2、artifact selector、Tool Protocol、coverage 与 support evidence 的机器契约见 [RFC-0017](rfcs/0017-client-runtime-machine-contracts.md)。

每种 Runtime 的自动构建、原生 runner、签名、公证、商店提交和 update channel 见[多产物 CI/CD](ci-cd.md)。Runtime 被设计出来不等于已经具备官方可发布流水线；两类 evidence 必须分别取得。

## 2. 官方目标路线

```text
Web                React Desktop UI
Desktop            Electron + React Desktop UI
Hybrid iOS/Android Capacitor + React Mobile UI
Native iOS         SwiftUI
Native Android     Kotlin + Jetpack Compose
```

React Desktop 与 React Mobile 可以共享业务 hooks、repositories、screen models 和基础组件，但不是同一个隐式页面入口。移动页面默认采用触摸、safe area、底部导航和移动 overlay；Desktop 页面默认采用宽屏、多栏、键盘、Hover 和窗口能力。

首批模板分别为 React Desktop `sidebar-saas` 和 React Mobile `mobile-tabs`；窄屏 Web、Capacitor 与原生端的选择和返回栈不能仅靠 CSS 猜测。详细 route/navigation/presentation 契约见[基础 UI Shell 模板与路由](ui-templates.md)。

## 3. 开发者选择

目标 presets：

```bash
blankspace create my-product --preset workspace-saas
blankspace create my-product --preset universal-hybrid
blankspace create my-product --preset native-mobile
```

- `remote-saas-core`：Web + Server，不固定 Workspace/Organization 模型；
- `workspace-saas`：Web + Server，在 core 上增加 Workspace starter；二者均尚未实现；
- `universal-hybrid`：Web React、Electron React、Capacitor React Mobile；
- `native-mobile`：Web/Electron React、iOS SwiftUI、Android Compose。

也可以逐端选择，例如 iOS 使用 SwiftUI、Android 使用 Capacitor。Preset 最终展开成显式 client/Runtime 配置，不能隐藏 Kit coverage 或 capability 缺失。

## 4. 共享边界

| 内容 | 是否跨端共享 | 方式 |
| --- | --- | --- |
| Domain/API/Error schema | 是 | 生成 TS/Swift/Kotlin 类型与 clients |
| Screen state/event | 是 | Screen Contract 与共同 fixtures |
| Route identity | 是 | 各 Runtime 映射 URL/Navigation destination |
| 请求语义 | 是 | API Contract、Repository/use case |
| Transport | 否 | Fetch、Electron bridge、URLSession、Android client |
| 页面组件树 | 默认否 | 按 UI Family renderer |
| Web/Desktop 页面 | 通常是 | 显式共享 React Desktop entry |
| React Mobile 页面 | 部分 | 与 Desktop 共享 core，不自动共享页面 |
| Design semantics | 是 | Theme Compiler 与平台 Renderer |
| 系统交互 | 否 | Platform Capability adapter |

框架不提供万能跨端页面 DSL。共享的是页面为什么存在、有哪些状态和动作，不是 Sidebar、Tab、Sheet 或具体控件。

## 5. Product Module

未来多端模块可按需增长：

```text
product/modules/documents/
├── contracts/
├── shared/
├── react/
│   ├── shared/
│   ├── desktop/
│   └── mobile/
├── apple/
├── android/
├── server/
└── tests/
```

没有选择的 UI Family 不生成目录。一个只做 Web 的团队不需要安装 Xcode 或 Gradle；一个选择 Capacitor 的团队不需要维护 SwiftUI/Compose renderer。

## 6. Kit coverage

Kit 可以提供 Service 而不提供 UI。包含 mandatory Screen/Contribution 的 Kit 必须声明各 UI Family renderer：

```text
Identity Kit
├── react-desktop  official
├── react-mobile   official
├── swiftui        official
└── compose        official
```

构建报告必须区分 `provided`、`fallback`、`excluded` 和 `missing`。缺失 mandatory renderer 时失败。只有 Kit manifest 明确将该能力声明为可按 client 排除，且该 client 没有 Screen、route、contribution、capability 或产品 requirement 依赖它时，才能选择 `excluded`；否则只能更换 Runtime 或安装兼容 renderer。Identity 登录、强制安全/法务界面等 client 必需能力不能借排除绕过。

逻辑 Kit 不等于一个 npm 文件包。React renderer 可以来自 npm，SwiftUI renderer 来自 Swift Package，Compose renderer 来自 Maven artifact；distribution manifest 把它们绑定到同一逻辑 Kit/Contract，lockfile 固定各端真实坐标、hash 和验证证据。`verified` 只表示兼容性 conformance 通过，不表示安全可信；生产默认只接受 official，其他等级需要产品显式 allowlist 和独立安全审查。

## 7. 平台能力

相机、分享、安全存储、通知、文件、多窗口、菜单和系统支付通过 Capability Contract 使用。产品代码不直接读取 Electron、Capacitor 或原生全局对象。

```text
ShareCapability
├── Web Share adapter
├── Electron adapter
├── Capacitor adapter
├── Apple adapter
└── Android adapter
```

缺失硬能力时构建失败；可选能力只有声明明确 fallback 才能降级。

## 8. 实施边界

多 Runtime 是长期兼容方向，不是 Phase 1 同时实现的工作量。交付顺序是 Web/Server、Electron、Capacitor、Native Contracts、Native vertical slice、Local-first。每个 Runtime 只有通过自身 toolchain、conformance、视觉/accessibility、签名和升级 fixtures 后才可以标记为 official。
