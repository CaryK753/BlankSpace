# 跨平台 Design System

## 1. 原则

Blankspace 统一品牌和设计语义，不要求 Web、Desktop、iOS 与 Android 像素相同。设计模型见 [RFC-0016](rfcs/0016-cross-platform-design-system.md)，Theme Renderer、Theme IR、selector 与确定性工具协议见 [RFC-0017](rfcs/0017-client-runtime-machine-contracts.md)。当前 Theme Compiler 和平台 Renderer 尚未实现。

首批可运行布局不从 tokens 临时拼装，而由 `sidebar-saas` Desktop Shell 与 `mobile-tabs` Mobile Shell 消费同一设计语义。布局、路由和响应式规则见[基础 UI Shell 模板与路由](ui-templates.md)。

```text
Brand Primitives
→ Semantic Tokens
→ Component Recipes
→ Platform Renderer
```

业务组件消费 `content.primary`、`action.primary`、`material.navigation` 等语义，不直接消费品牌色阶或固定 blur。

## 2. 产品主题

目标目录：

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

简单产品只配置基础 tokens。平台 overlay 只用于真实平台差异，不能覆盖 renderer internal。

覆盖顺序：

```text
Framework defaults
→ Kit defaults
→ Product base theme
→ Product platform overlay
→ Runtime system preferences
```

系统高对比度、减少透明度、文字缩放和减少动态效果最终优先。

## 3. Liquid Glass 与平台材质

主题声明：

```jsonc
{
  "material": {
    "navigation": {
      "role": "system",
      "prominence": "regular",
      "fallback": "standard-material"
    }
  }
}
```

Apple Renderer 使用系统 Navigation、Toolbar、Sheet，并在支持时获得 Liquid Glass；Android Renderer 使用适合 Android 的 Material surface；Web Renderer 使用 Web 表现。不要给所有平台复制固定 blur、opacity 和 refraction 数值。

## 4. 生成产物

Theme Compiler 为每个启用 UI Family 生成专属产物：

```text
.blankspace/generated/<clientId>/render-theme/<uiFamily>/
├── react-desktop/
├── react-mobile/
├── swiftui/
└── compose/
```

Graph 解释每个 token 的来源、最终语义、renderer、capability 和 fallback。生成文件可重建且不由产品手工编辑。

## 5. 验证

视觉验证比较同一 Renderer 的版本兼容，不要求 React、SwiftUI 与 Compose 截图像素相同。跨平台共同验证：

- 品牌语义一致；
- 标准页面状态齐全；
- 操作均可达；
- accessibility 设置生效；
- capability 降级明确；
- 平台 overlay 没有越过公共边界。
