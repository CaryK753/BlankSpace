# S8：双 Product Shell 与 UI 验收

## 状态

Draft matrix，尚未执行；React、UI library、Playwright 与 a11y 工具待锁定。

## 要回答的问题

同一 semantic contributions 能否被默认 Shell 和布局明显不同的 Product Shell 消费，同时保持标准状态、可访问性和升级兼容，而不让业务导入 Framework internal？

## 实验设置

建立默认 `sidebar-saas`、`mobile-tabs` 与自定义工作台 Shell，消费同一 navigation、command、route contributions。每个 Shell 覆盖 loading、empty、content、error、forbidden、offline/unsupported 状态；固定 browser、viewport、字体、locale、timezone 和动画策略。Route/Navigation proposed contract 与布局基线见[基础 UI Shell 模板与路由](../ui-templates.md)。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| 两个 Shell 消费相同 contributions | 语义一致，布局可不同 |
| Desktop Sidebar expanded/collapsed/drawer | route 不变，焦点和设备偏好可恢复 |
| Mobile tabs + per-tab stack | 最多五个主入口，系统 Back、safe area 和滚动恢复正确 |
| compact/medium/expanded 转换 | 不改变 route identity、Actor 或 access decision |
| deep link 到 detail/edit | Desktop content 与 Mobile push 命中同一 Route ID |
| Kit 未启用 | contribution 和实现均不出现 |
| loading/empty/error/forbidden | 状态完整且动作可达 |
| 键盘导航与焦点恢复 | 顺序稳定，无焦点陷阱 |
| overlay/route error boundary | 局部失败不摧毁整个 Shell |
| Product token/recipe 替换 | 不导入 renderer internal |
| Public Override | 标为人工复查并进入升级报告 |
| 上一 minor Product Shell | 无修改通过兼容 fixture |
| 固定环境截图 | 差异可重复并受阈值控制 |
| accessibility scan | blocker 为零，语义树符合预期 |

## 通过条件与失败选择

两个 Shell 均通过行为、截图、键盘和 accessibility fixtures；产品业务只依赖 public contracts。若候选 UI library 强迫 Shell 依赖 internal 或无法稳定测试，替换 React UI adapter/library，不降低 semantic contribution 边界。

## 尚待冻结

React/React Router/UI primitives/Playwright/a11y 精确版本、浏览器矩阵、响应式阈值、截图容差、fixtures、命令和基准资产。
