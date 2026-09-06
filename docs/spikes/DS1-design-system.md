# DS1：跨平台 Design System 实验

状态：Draft matrix，尚未执行；不属于 Phase 1 的 S1～S8 门禁。

## 目标

验证 RFC-0016/0017 的 Primitive → Semantic Token → Component Recipe → Platform Renderer 模型，证明品牌一致性不要求 React、SwiftUI 与 Compose 像素相同。token/recipe/overlay、Theme IR、Theme Result 与 Theme Renderer Tool Protocol 已有 Proposed schemas；本实验负责验证 merge、fallback、原生材质和确定性输出语义。

## 固定输入

一个品牌主题、一个平台 overlay 集合，以及 Button、Navigation Surface、Dialog/Sheet、Text Field、Empty/Error State 五类 recipes。每类包含 light/dark、disabled/focused/pressed、文字缩放与能力 fallback。

## Renderer 矩阵

| Renderer | 重点 |
| --- | --- |
| React Desktop | CSS variables、静态 CSS、宽屏/窗口 resize |
| React Mobile | safe area、触摸、横竖屏、WebView host |
| Apple | 系统 Navigation/Toolbar/Sheet、Liquid Glass/standard fallback |
| Android | Material surface、动态设置与 Compose semantics |

## 必测失败

- token 缺失、循环引用、类型错误和未知字段；
- platform overlay 修改非 overridable token；
- required material/capability 无实现且无 fallback；
- Product theme 试图覆盖强制 accessibility preference；
- renderer 使用 internal selector/component；
- generated output 含绝对路径、时间或不稳定顺序；
- minor mapping 变化未触发视觉/accessibility verify。

## corpus 分层

- 结构层：Schema 接受完整主题并拒绝未知字段、非法类型和不安全路径；
- 解析层：验证 overlay 按 `priority`、UTF-8 ID 稳定应用，`replace`、`merge-map`、`merge-recipe` 无多解；
- IR 层：相同输入在两个干净 checkout 生成相同 Theme IR hash；
- Renderer 层：四类 Renderer 通过相同 IR 产生 client-scoped outputs，不覆盖其他 client；
- 平台层：在实际 OS 设置下验证 Liquid Glass/Material/fallback 与 accessibility，运行时选择不改变源 Theme IR；
- 升级层：mapping 或 recipe 变化进入逐 client Compatibility Report 和视觉复验清单。

## 成功条件

同一语义主题生成四类稳定产物和可解释 Graph；Apple 在适用系统上使用系统材质并响应降低透明度，Android/Web 使用各自平台表现；共同 fixtures 的品牌语义、状态和动作可达性一致，各 Renderer 自身视觉基线通过。

## 失败后的选择

- Semantic schema 无法表达两个真实产品：增加经验证的语义，不开放任意 renderer internal；
- Recipe 过度限制原生组件：缩小 Recipe 到状态/角色，不增加跨端 UI DSL；
- 视觉测试噪声过高：比较 semantic/accessibility tree 并保留少量关键截图；
- 系统材质不可稳定截图：验证 capability、结构和 accessibility，视觉改为人工/设备 evidence。

## 尚待冻结

codegen 工具实现、颜色/对比度算法、目标 OS/浏览器版本、设备矩阵、截图容差和真实品牌 fixtures。Schema 结构已提出，但 merge 与平台行为必须通过本 corpus 后才算冻结。
