# RFC-0016：跨平台 Design System 与 Token Resolver

## 状态

Proposed

## 背景

Blankspace 产品需要统一品牌，同时尊重 Web、Desktop、iOS 和 Android 的平台设计语言。把颜色、模糊、圆角和阴影数值直接复制到所有客户端，会使 Liquid Glass、Material、系统高对比度和减少透明度等能力失真。设计系统必须共享意图，而不是强制像素一致。

## 决策

### 1. 四层模型

```text
Brand Primitives
→ Semantic Tokens
→ Component Recipes
→ Platform Renderer
```

- Primitive 是品牌原始值，不由业务组件直接消费；
- Semantic Token 表达内容、操作、表面、材质、动效和密度等意图；
- Recipe 描述公共组件在不同状态下引用哪些语义；
- Renderer 将语义映射为 CSS、SwiftUI/UIKit/AppKit 或 Compose/Material 实现。

Design Token 不承担页面导航、数据状态或业务规则。Screen Contract 不携带具体颜色、blur 或平台组件类型。

### 2. 平台表现不要求相同

例如 `material.navigation = system`：

| Renderer | 实现 |
| --- | --- |
| Web | Web Runtime 的导航表面与 CSS variables |
| Electron React | React renderer 加 Desktop window/chrome policy |
| Capacitor React | Mobile Web renderer 与 safe-area/native host 协调 |
| Apple | 优先系统 Navigation/Toolbar/Sheet；支持时采用系统 Liquid Glass |
| Android | Material navigation surface 与系统动态设置 |

Liquid Glass 不是通用 `blur/opacity/refraction` token。Apple Renderer 优先标准系统控件，仅对确需自定义的交互表面使用平台 glass API；系统减少透明度、增加对比度和减少动态效果拥有最终优先权。

参考：[Apple Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)、[Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)。

### 3. 产品目录

```text
product/theme/
├── tokens.jsonc
├── components.jsonc
├── platforms/
│   ├── web.jsonc
│   ├── apple.jsonc
│   └── android.jsonc
└── assets/
```

平台 overlay 使用包含 `clientId` 的显式 selector，并可继续约束 platform、Runtime 与 UI Family；不能只用 `apple/web/android` 猜测实际 host。它只能覆盖 schema 标记为 platform-overridable 的语义节点，不能引用 renderer internal 或任意 CSS selector。简单产品只需 `tokens.jsonc`；其余文件按需生成。

### 4. 覆盖顺序

```text
Framework semantic defaults
→ Kit semantic defaults
→ Product base theme
→ Product platform overlay
→ Runtime system preferences
```

同一层禁止模糊深合并：schema 定义每个 token 的标量、map 或 recipe 合并语义；无法唯一确定时失败。Runtime system preferences 最终优先，产品不能关闭强制的 accessibility adaptation。

### 5. 目标产物

Theme Compiler 为每个 UI Family 生成独立、可重建产物：

```text
.blankspace/generated/
├── web/render-theme/react-desktop/
├── desktop/render-theme/react-desktop/
├── ios/render-theme/swiftui/
└── android/render-theme/compose/
```

第一层目录实际使用稳定 `clientId`；上例只是示意。典型输出包括 CSS variables/静态 CSS、Swift value types/assets 和 Kotlin theme values/resources。同 UI Family 的不可变基础产物可以按 hash 去重，但不同 client 不共享可变输出目录。Graph 记录 token 来源、最终语义、renderer、fallback 和 capability；生成目录不由产品手工修改。

Theme Renderer 是 Runtime 的版本化扩展点；规范化 Theme IR、Tool Protocol、selector 与输出清单由 RFC-0017 定义。DS1 必须先冻结 token、recipe 与 overlay schema，包括节点类型、`platformOverridable` 和 `replace | merge-map | merge-recipe` 合并策略。

### 6. 原生组件边界

系统导航、工具栏、Sheet、菜单、文本输入和 accessibility controls 优先由平台标准组件实现。Tokens 可以影响品牌 tint、prominence、允许的材质角色和 fallback，但不能要求 Renderer 用自绘控件模拟另一个平台。

自定义组件使用版本化 Recipe；没有对应 Recipe/Renderer 时不能把 Web CSS 当作跨平台规范。Public Override 仍按 RFC-0009 进入升级和视觉复查。

### 7. 能力与降级

材质、动态色、字体、触觉、指针和动画声明 required/optional capability。可选能力必须指定语义 fallback，例如 `system-glass → standard-material → opaque`。降级由 Renderer 根据平台版本和用户设置决定并可诊断，但不能记录敏感用户偏好。

### 8. 版本与升级

- 删除或重命名 Semantic Token 是 breaking change；
- 新增带默认值的可选 token 可以是 minor；
- Recipe 状态集合变化进入 component compatibility report；
- 平台 mapping 改变但语义不变仍需视觉与 accessibility verify；
- Product platform overlay 和 Public Override 总是进入升级风险报告。

### 9. 验证矩阵

每个第一方 Renderer 至少验证：

- light/dark、高对比度、文字缩放；
- reduce motion、reduce transparency 等适用设置；
- loading、empty、ready、offline、permission denied、error；
- 窄屏、宽屏、横竖屏、窗口 resize；
- 平台 capability 存在与 fallback；
- 截图、语义/accessibility tree、键盘或触摸操作；
- token 未使用、缺失、循环引用和越权平台覆盖。

视觉测试比较同一 Renderer 的兼容版本，不要求 SwiftUI、Compose 与 React 截图像素相同。跨平台 fixture 比较品牌语义、状态覆盖和动作可达性。

## 验收场景

1. 替换产品品牌色后所有启用 Renderer 重新生成且来源可解释；
2. Apple 系统支持 Liquid Glass 时标准导航采用系统表现，降低透明度时自动适配；
3. Android 不模拟 Liquid Glass，而使用相同 navigation material 语义的 Android renderer；
4. 未声明的 platform override、循环 token 和缺失 fallback 在构建前失败；
5. framework minor 升级不修改产品源文件，旧主题通过兼容验证或得到精确迁移报告。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 所有平台共享数值 token | 简单 | 平台失真、accessibility 风险 | 拒绝 |
| 每个平台完全独立主题 | 原生自由 | 品牌和升级事实分裂 | 拒绝 |
| 共享语义、平台 Renderer | 品牌一致且平台原生 | 需要 codegen 与视觉矩阵 | 采用 |

## 重审触发条件

- 两个真实产品无法用 Semantic Tokens 表达品牌而必须大量覆盖 internal；
- 平台 Renderer 为保持 Contract 被迫模拟其他平台；
- Theme Compiler 产物无法稳定重建或升级报告噪声过高。
