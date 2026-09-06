# RFC-0009：Public Extension Surface 与 Product Shell

## 状态

Proposed

## 背景

AFFiNE 级产品需要改变整体布局、导航和交互，而不仅是主题色。若产品复制或 patch 框架组件，上游升级会退化为手工合并；若框架只允许少量插槽，又无法形成真正不同的产品。

## 决策

### 1. 四级公共扩展面

| 层级 | 用途 | 兼容责任 |
| --- | --- | --- |
| Tokens | 视觉基础值 | 框架维护 schema 与弃用周期 |
| Semantic Contributions | route、command、navigation、setting、renderer | 框架维护 ID、类型和排序规则 |
| Product Shells | 产品拥有整体结构 | 框架维护带版本的 context 与 primitives |
| Public Overrides | 替换少量公开组件 | 框架报告风险，产品负责视觉复查 |

未列入清单的组件、DOM、CSS selector 和 internal import 不属于扩展面。

### 2. Shell Contract

Shell 是产品拥有的组件，接收稳定的语义能力，不接收框架内部组件树：

```ts
interface WorkspaceShellV1Props {
  contractVersion: '1';
  session: SessionView;
  workspace: WorkspaceView;
  navigation: NavigationController;
  commands: CommandRegistry;
  contributions: UIContributionRegistry;
  overlays: OverlayController;
  states: ShellStateRenderer;
  client: ClientView;
  slots: {
    content: UIElement;
  };
}
```

这只是逻辑契约形状；每个 UI Family 生成自己的 props/types，`UIElement` 不跨 TypeScript、Swift 与 Kotlin 传递。正式 RFC 接受前需用选定技术栈证明等价能力。Client、Runtime 与 UI Family 由 RFC-0015 定义。

### 3. Contributions

每项 contribution 必须包含稳定 `id`、来源、目标语义区域、优先级、运行时条件和所需 capability。排序使用明确规则：产品固定位置优先，其余按 priority、来源 Kit ID、contribution ID 稳定排序。重复 ID 在编译阶段失败。

Shell 只能通过 Registry 消费 contributions，不能扫描 Kit UI 文件。每种 contribution 必须声明已知 semantic region；Shell 必须为自己支持的 region 提供默认 renderer 或在编译期显式拒绝，不能静默忽略未知 region。产品可隐藏或重新放置非强制 contribution，但安全、权限和法务类强制项必须由具体 Kit Contract 声明适用条件与验证规则，不由 Foundation 猜测业务政策。

### 4. 交互所有权

- Router 管理 route identity、参数和导航结果；Shell 决定呈现位置；
- Command Registry 管理命令 ID、可用性和执行；Shell 决定入口；
- Overlay Controller 管理 modal、popover 和通知栈，防止 Kits 各建 portal；
- Shell State Renderer 统一 loading、empty、error、permission denied 和 offline；
- 焦点恢复、快捷键作用域和可访问性语义属于公共 Contract；
- 样式默认隔离于 Kit contribution，Tokens 通过版本化变量暴露，不承诺内部 class name。

### 5. 平台与响应式

一个 Shell Contract 可以有 React Desktop、React Mobile、SwiftUI 与 Compose 实现。Contract 描述 capability 而不是假设所有平台相同；缺失 capability 必须显式降级。响应式断点属于 Design System schema，平台原生窗口、菜单和系统快捷键通过 Client Runtime contribution 接入。Web/Electron 可以显式共享 renderer，Capacitor 不自动复用 Desktop renderer；完整 coverage 规则见 RFC-0015，Token/Recipe/Renderer 边界见 RFC-0016。

### 6. 标准视觉状态

框架提供可复现 fixtures：

- signed-out、signed-in；
- workspace loading、empty、populated、offline、permission denied；
- navigation expanded/collapsed；
- overlay open；
- light/dark、窄屏/宽屏；
- contribution 缺失和失败。

自定义 Shell 与 Public Override 必须基于这些状态保存截图基准，并配合键盘导航和可访问性检查。

### 7. 升级规则

- Shell props 只在对应 Contract major 内兼容演进；
- 新字段在 minor 中必须可选或有默认实现；
- 删除前至少经历一个稳定 minor 的 deprecation；
- Public Override 必须声明目标 component ID 与版本范围；
- upgrade check 只比较 Shell Contract、contribution schema、Tokens 与 fixture 定义的变化并报告风险；实际截图、键盘和可访问性回归在 upgrade verify 中运行；
- internal selector 或 patch 由 lint/compiler 拒绝。

## 验收场景

1. 同一套 Identity、Workspace 和 Editor contributions 能在默认 Shell 与完全不同布局的产品 Shell 中运行；
2. 新增可选 navigation contribution 在 Shell 已声明支持对应 region 时，无需修改 Shell 源码即可显示；不支持的 region 在编译期给出明确诊断；
3. duplicate ID、遗漏 mandatory contribution 和不兼容 override 在构建前失败；
4. minor Contract 升级无需修改旧 Shell；major 升级产生精确报告和迁移样例；
5. 标准视觉、键盘和可访问性测试可在 CI 无交互执行。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 固定组件加 slots | 简单、易实现 | 无法支撑完全不同产品结构 | 只用于局部扩展 |
| 允许覆盖任意组件 | 自由度最大 | 无兼容边界 | 拒绝 |
| 产品拥有 Shell、框架提供语义 Contract | 深度定制与升级责任可分离 | 需要维护 UI 协议和 fixtures | 采用 |

接受的限制是：Public Override 仍需人工视觉复查，框架不保证任意布局升级后像素不变。

## 重审触发条件

- 两个真实产品无法通过 Shell Contract 实现关键 UI；
- mandatory contributions 频繁迫使产品复制默认 Shell；
- 多技术栈支持显著削弱类型或测试能力。
