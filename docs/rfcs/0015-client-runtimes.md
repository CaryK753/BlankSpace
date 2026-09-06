# RFC-0015：多客户端 Runtime 与 UI Family

## 状态

Proposed

## 背景

Blankspace 既要让小团队用 Web 技术快速覆盖浏览器、桌面和移动端，也要允许重视平台体验的产品使用 SwiftUI 与 Jetpack Compose。把 `web | desktop | mobile` 同时当作平台、UI 技术和构建目标会产生歧义；强制一套页面运行在所有平台，则会把移动端降级成桌面页面的窄屏版本。

AFFiNE 证明了 React core、Electron Desktop 与 Capacitor Mobile 的高复用路线可承载复杂 local-first 产品。Blankspace 借鉴该模式，但同时提供原生移动 Runtime；不复制 AFFiNE 的内部 API 或全部依赖组合。

参考核对日期：2026-09-05。

- [AFFiNE Web package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/apps/web/package.json)
- [AFFiNE Electron package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/apps/electron/package.json)
- [AFFiNE iOS package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/apps/ios/package.json)
- [AFFiNE Android package](https://github.com/toeverything/AFFiNE/blob/canary/packages/frontend/apps/android/package.json)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [SwiftUI](https://developer.apple.com/swiftui/)
- [Jetpack Compose state](https://developer.android.com/develop/ui/compose/state)

## 决策

### 1. 分离 Client、Platform、Runtime 与 UI Family

```ts
interface ClientTargetV2 {
  id: string;
  platform: 'web' | 'windows' | 'macos' | 'linux' | 'ios' | 'android';
  runtime: { id: string; version: string; manifestHash: string };
  uiFamilyAssertion?: { id: string; major: number };
  requiredCapabilities: Array<{ id: string; major: number }>;
}
```

- `id` 标识一个可独立构建、测试和发布的客户端；
- `platform` 表示产物运行环境，不推导 UI 技术；
- `runtime` 是可锁定的 Client Runtime Kit 引用；
- UI Family 由 Runtime 派生，产品只能写可选 assertion，不能另选不一致的值；
- 同一 platform 可以有多个 client，例如内部 Capacitor iOS 与公开 SwiftUI iOS；
- 一个 client 只能绑定一个主 UI Runtime，不能在同一导航树中隐式混用两个主框架。

Phase 1 的 `targets: ["web", "server"]` schema 保持不变。上述结构属于后续 schema major，经独立 spike 后才能替换当前字段。

### 2. Client Runtime Kit

```ts
interface ClientRuntimeManifestV2 {
  schemaVersion: '2';
  kind: 'client-runtime';
  id: string;
  version: string;
  platforms: string[];
  uiFamily: { id: string; major: number };
  distribution: ImmutableRef;
  artifactRequirements: ArtifactRequirement[];
  capabilities: CapabilityProvider[];
  contractGenerators: ContractGeneratorRef[];
  tools: ToolRef[];
  renderers: RendererRef[];
  shell: ShellManifest;
}
```

Runtime、Renderer、artifact、Tool Protocol、support evidence 与 ProductGraphV2 的规范化关系由 RFC-0017 定义；本 RFC 中的接口是概念摘要，不能替代其机器 schema。

Foundation 只校验 manifest、Graph、capability 和生命周期，不导入 React、Electron、Capacitor、SwiftUI 或 Compose 类型。Runtime Kit 负责脚手架、平台 host、renderer registry、构建、打包和验证。

“Kit”是逻辑产品能力，不表示所有语言实现必须装进一个 npm archive。跨生态 Runtime/renderer 使用受审查的 distribution manifest 将同一逻辑 identity/version 映射到 npm、Swift Package 和 Maven artifacts；`blankspace.lock` 固定每个 client 实际解析的坐标、版本、source 和 hash。缺失 artifact、逻辑版本不一致或 hash 漂移在执行 Xcode/Gradle 构建前失败。

第一方目标 Runtime：

| Runtime | Platform | UI Family | 路线 |
| --- | --- | --- | --- |
| `runtime-web-react` | web | `react-desktop` | Web |
| `runtime-electron-react` | windows/macos/linux | `react-desktop` | 共享 Web UI 的 Desktop |
| `runtime-capacitor-react` | ios/android | `react-mobile` | Hybrid Mobile |
| `runtime-ios-swiftui` | ios | `swiftui` | Native Mobile |
| `runtime-android-compose` | android | `compose` | Native Mobile |

React Native、Flutter、Tauri、Compose Multiplatform 等通过同一 Contract 接入，但在真实 conformance evidence 前不是第一方稳定 Runtime。

### 3. React Desktop 与 React Mobile 分离

`react-desktop` 和 `react-mobile` 是不同 UI Family，即使二者使用同一语言和 React。它们可以共享 hooks、repositories、screen models 和基础组件，但默认拥有不同 Shell、route presentation、navigation、overlay、输入和布局。

Web 与 Electron 默认消费 `react-desktop`。Capacitor 默认消费 `react-mobile`，不能把 Desktop renderer 作为隐式 fallback。产品确实拥有自适应通用页面时，可以让两个 entry 显式引用同一文件。

### 4. Screen Contract

跨端共享页面语义，不共享具体组件树：

```ts
interface ScreenContractV1<State, Event> {
  id: string;
  version: string;
  stateSchema: SchemaRef;
  eventSchema: SchemaRef;
  requiredCapabilities: Array<{ id: string; major: number }>;
}
```

Screen Contract 定义 loading、empty、ready、offline、permission denied 和 error 等稳定状态，以及用户可以触发的语义事件。Renderer 决定 Sidebar、Tab、NavigationStack、Sheet、系统返回、多窗口、Hover、手势和具体组件。

页面状态类型从公共 schema 生成 TypeScript、Swift 和 Kotlin 类型。它不是跨语言 UI DSL，也不包含 JSX、SwiftUI View、Compose `@Composable`、DOM 或平台 ViewModel。

### 5. Route 与导航

Route Contract 使用稳定 ID、参数 schema、结果 schema和 capability，不使用跨端共享 URL：

```text
documents.detail
├── Web       URL route
├── Electron  当前窗口、新标签或新窗口
├── SwiftUI   NavigationStack destination
└── Compose   navigation destination
```

Shell/Runtime 负责 presentation；Module 只贡献 route identity 和 renderer binding。未知 mandatory route、缺失 renderer 或参数 schema 不兼容在构建期失败。

### 6. 请求与数据

API Contract 是唯一协议事实源，生成 server binding、TypeScript client、Swift client、Kotlin client 和 mocks。共享内容包括 operation ID、输入输出、错误类别、版本、权限、幂等和分页语义。

Transport 是平台 adapter，负责 session、TLS、取消、超时、前后台、上传下载和 trace。页面只调用 Repository/use case，不直接依赖 Fetch、URLSession、OkHttp、Capacitor plugin 或 Electron IPC。

Remote-only API 与 local-first Sync Protocol 继续分离。Sync wire boundary 由 RFC-0019 提出；共享 Rust engine、平台独立实现或混合方案由 N1 的 FFI/WASM/原生数据库 spike 比较，不因支持原生客户端而提前成为 Foundation 依赖。

### 7. Platform Capability

文件、相机、分享、安全存储、通知、多窗口和菜单等通过版本化 capability Contract 使用。Runtime 声明 provider；产品和 Kit 声明 requirement 与 fallback。

Compiler 对每个 client 计算能力闭包：capability 使用带 major 的引用，requirement 区分 required/optional 并声明平台约束、provider selector 与无环 fallback；缺少硬 capability 时失败。Compiler 只固化可行链，OS、权限和用户设置只能在该链内运行时选择。业务代码不能通过 `window.electron`、Capacitor 全局对象或任意平台 singleton 绕过 Registry。

Electron renderer 默认无 Node 权限，只能通过最小 typed preload bridge 调用 main process；IPC 校验 sender、输入 schema 和授权。Capacitor plugin 同样通过 capability binding 暴露，不进入普通 Web 构建。

### 8. Product Module entries

未来 descriptor 可以声明：

```jsonc
{
  "entries": {
    "shared": "./shared/index.ts",
    "react-desktop": "./react/desktop/index.tsx",
    "react-mobile": "./react/mobile/index.tsx",
    "swiftui": "./apple/DocumentsModule.swift",
    "compose": "./android/DocumentsModule.kt",
    "server": "./server/index.ts"
  }
}
```

这是未来 schema 示例；Phase 1 的 module schema 仍只接受 `shared`、`web` 和 `server`。跨语言源码由对应 Runtime toolchain 解析，Foundation Graph 使用 manifest 与生成的 contract metadata 对账，不能用 TypeScript resolver 假装验证 Swift/Kotlin imports。

Phase 1 的 `public.ts` 只是 TypeScript 模块出口，不是跨语言 ABI。多客户端 Module 的公共事实位于 `contracts/` schema；Runtime generator 生成各语言 contract module，Swift Package/Gradle module/TypeScript exports 分别承担本语言可见性。平台 renderer 禁止 deep import 其他 Product Module 的实现目录，Runtime verifier 把真实语言依赖与 Graph 声明对账。

### 9. UI coverage 与 fallback

Kit/Module 对每个 mandatory Screen/Contribution 声明 renderer coverage。Graph 记录 `provided`、`fallback`、`excluded` 或 `missing`，以及证据等级。缺失 mandatory renderer、静默忽略 mandatory contribution 或自动把 Desktop renderer 塞入 Mobile 均失败。

无 UI Kit 可以只提供 Service。某项产品能力只有在 Kit manifest 明确声明 `clientOptional: true`，且目标 client 没有 Screen、route、contribution、capability 或产品 requirement 依赖它时才能显式排除。Compiler 在裁剪前做反向依赖检查；存在任一依赖就拒绝 `excluded`。Identity 登录、强制安全/法务界面等 client 必需能力不能通过排除绕过。合法排除结果进入 Graph、用户能力清单与升级报告。

### 10. 支持等级

```ts
type SupportLevel =
  | 'official'
  | 'verified'
  | 'community'
  | 'experimental'
  | 'unavailable';
```

- `official`：Blankspace 维护并进入 release gate；
- `verified`：外部实现通过指定版本 compatibility conformance suite，有可追溯证据；这不是安全审计或信任结论；
- `community`：可安装但没有持续兼容保证；
- `experimental`：Contract 或实现可发生 breaking change；
- `unavailable`：明确拒绝该组合。

`verified` 证据包括 Runtime/Contract 版本、平台工具链、日期、fixture 结果、限制和 artifact hash。产品 release policy 决定是否允许非 official Runtime；默认生产 preset 只接受 official。使用 verified/community/experimental 必须显式 allowlist，并独立完成来源、权限、供应链与安全审查。

### 11. Presets

目标 presets：

| Preset | Web | Desktop | iOS | Android |
| --- | --- | --- | --- | --- |
| `remote-saas-core` | React | 无 | 无 | 无 |
| `workspace-saas` | React | 无 | 无 | 无 |
| `universal-hybrid` | React Desktop | Electron React | Capacitor React Mobile | Capacitor React Mobile |
| `native-mobile` | React Desktop | Electron React | SwiftUI | Compose |

Preset 只生成显式 client/Runtime 配置；产品整体替换规则遵守 RFC-0004。Preset 名称表达脚手架路线，不承诺所有 Kits 已覆盖全部客户端。

### 12. 跨生态 artifacts 与 codegen

一个逻辑 Kit/Runtime release 可以引用：

```text
logical @blankspace/kit-identity@1.4.0
├── npm      @blankspace/kit-identity@1.4.0
├── SwiftPM  BlankspaceIdentity 1.4.0
└── Maven    dev.blankspace:identity:1.4.0
```

Distribution manifest 声明每个 artifact 的 ecosystem、coordinate、version、content hash、contract hash、支持的 UI Family 和签名/provenance 引用。版本号相同不自动证明内容兼容；所有 artifacts 必须指向同一 contract hash 并通过对应 conformance corpus。

API/Screen/Theme codegen 默认从锁定 schema 在产品构建目录本地生成，产物写入 `.blankspace/generated/<client>/`，不手工发布为另一份事实源。Generator 本身是需要锁定和审查的构建工具；生成结果的 input hash、generator version 与 output hash 进入 Graph/evidence。

### 13. Toolchain 与仓库

pnpm 只管理 TypeScript workspace，不冒充 Xcode/SwiftPM 或 Gradle。Blankspace CLI 统一调用各 Runtime builder，Product Graph 记录 Node、Xcode/Swift、Gradle/JDK/Android plugin 等实际工具链及输出。任何平台未安装工具链时报告 blocked，不把其他平台通过当作全客户端通过。

### 14. 交付顺序

1. Phase 1：Web/Server；React Screen Contract 仅作为 opaque `web` contribution 的非门禁实验，不改变 V1 schema；
2. Desktop milestone：Electron Host、typed IPC、打包签名和 Desktop capabilities；
3. Hybrid Mobile milestone：React Mobile Shell、Capacitor host 与 plugin boundary；
4. Native Contract milestone：Swift/Kotlin codegen、SwiftUI/Compose Shell 和一个纵向切片；
5. Local-first milestones：各平台存储/sync fixtures，之后决定共享 Rust engine。

未来 Runtime 不阻塞当前 Phase 1；只有目标 milestone 的矩阵通过后才能把对应 preset 标为可用。

## 验收场景

1. Web 与 Electron 显式共享一个 React Desktop renderer，Electron-only capability 不进入 Web bundle；
2. Capacitor 使用 React Mobile renderer，不因同为 React 自动选择 Desktop renderer；
3. 同一 Screen Contract 的 React Mobile、SwiftUI 与 Compose renderer 通过相同状态/事件 fixtures；
4. 缺失 mandatory renderer 或 capability 在构建前给出 client、来源和修复选项；
5. 生成的 TypeScript、Swift、Kotlin clients 对同一 API corpus 产生等价的规范化 request transcript 与 typed error；
6. 一个产品可以选择 iOS SwiftUI 与 Android Capacitor，不强制路线成对；
7. community Runtime 不能在缺少证据时被报告为 verified；
8. 未启用 Runtime 的源码、SDK 和 secret 不进入 client artifact。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 只支持 Capacitor | 复用最高 | 平台体验上限不足 | 作为官方路线之一 |
| 只支持原生 | 平台体验最佳 | 小团队成本高 | 作为官方路线之一 |
| 万能跨端页面 DSL | 单一表面 | 最低公分母、难以使用原生能力 | 拒绝 |
| Runtime Kit + 语义 Contract | 开放且边界明确 | conformance 与 codegen 成本 | 采用 |

## 重审触发条件

- 两个 Runtime 无法使用同一 Screen/API Contract 而不泄漏框架类型；
- Hybrid 与 Native 的 conformance 成本超过真实产品收益；
- UI Family 数量使 Kit 作者无法提供可理解的 coverage；
- 平台工具链无法被 Graph 和 release evidence 稳定描述。
