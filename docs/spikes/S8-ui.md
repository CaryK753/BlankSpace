# S8：双 Product Shell 与 UI 验收

## 状态

本地 provisional pass，Ubuntu canonical 尚未执行。`A1-S8-02` 已安装 exact candidates，以同一 contribution set 实现两个 Shell，并在 macOS arm64 执行三浏览器 behavior/a11y 与 Chromium visual corpus；这仍不是 S8 final Pass。

冻结日期：2026-09-08。依赖与浏览器预安装审查见 [S8 供应链审查](s8-ui/supply-chain-review.md)。Route/Navigation proposed contract 与布局基线见[基础 UI Shell 模板与路由](../ui-templates.md)。

## 1. 要回答的问题

同一组可序列化 semantic contributions 能否被默认 Shell 和结构明显不同的 Product Shell 消费，同时保持 route identity、标准状态、键盘/触控行为、可访问性和升级兼容，而不让产品业务导入 Framework internal？

S8 是可删除 conformance spike，不是产品 UI、组件库或 production renderer。通过 S8 也只证明冻结 corpus 中的 React Web Shell 边界，不证明 Native、Capacitor、Electron 或完整 Design System。

## 2. 冻结工具链

| 能力 | Exact candidate | 决策 |
| --- | --- | --- |
| UI runtime | `react@19.2.8`、`react-dom@19.2.8` | React-first；React 类型只进入未来 UI packages |
| Types | `@types/react@19.2.18`、`@types/react-dom@19.2.7` | 与 React 19 单线锁定，不允许 wildcard 漂移 |
| Router | `react-router@8.3.1` Data Mode | adapter 从 Blankspace Route Graph 生成 route objects；不采用 Framework Mode/file convention |
| Accessible primitives | `react-aria-components@1.21.1` | 无样式、可组合；Blankspace 自己拥有 tokens、recipes 与 DOM-independent public contract |
| Styling | CSS Modules + CSS custom properties | 本轮不新增 Tailwind、CSS-in-JS 或主题 runtime |
| Browser test | `@playwright/test@1.63.0` | behavior、keyboard、visual、trace 与固定 emulation |
| Accessibility | `@axe-core/playwright@4.13.0`、`axe-core@4.13.0` | 自动 scan 加显式键盘、焦点、announcement 与语义断言 |
| Fixture font | `@fontsource-variable/inter@5.3.0` | 只在 canonical `en-US` screenshot fixture 自托管；产品字体仍可替换 |
| Existing build | Vite `8.2.2`、TypeScript `5.9.3`、Node `24.20.0`、pnpm `10.32.1` | 复用已锁工具，不引入第二个 build/test lifecycle |

React Router 只负责浏览器路由实现。公共 Contract 不暴露 `RouteObject`、loader args、React element 或 library error；client-side navigation 后的标题宣告和焦点移动由 Shell adapter 明确实现，因为 router 不替产品决定这些无障碍行为。[React Router accessibility](https://reactrouter.com/how-to/accessibility)

React Aria Components 只提供 interaction/accessibility primitives，不采用 React Spectrum 视觉层；其官方定位就是无样式、可自定义且覆盖 accessibility、interaction 与 internationalization 的组件。[React Aria getting started](https://react-aria.adobe.com/getting-started) 若它迫使 public contract 暴露 library types、阻止两个 Shell 结构分离或无法稳定打包，则退回 `@base-ui/react` 重新执行同一 corpus；不通过深导入或 DOM selector patch 绕过。

S8 fixture 的独立 TypeScript project 将 `exactOptionalPropertyTypes` 设为 `false`：候选 `react-aria-components@1.21.1` 的 `GroupProps`/`OverlayArrowProps` 同时继承 React `HTMLAttributes` 与 `@react-types/shared` 的 `DOMProps`，两者对 optional `id` 的声明在该开关下不兼容。这个局部设置只放宽 S8 adapter 的 optional-property 精确性，不影响 `packages/contracts`、`packages/compiler` 或仓库主 project；`strict` 与 `skipLibCheck: false` 仍保持，依赖声明仍完整检查。升级候选后必须重新验证并优先移除此兼容边界。

## 3. Browser 与固定环境

Playwright `1.63.0` 的 `browsers.json` 固定：

| Project | Engine revision / version | Gate |
| --- | --- | --- |
| `chromium-canonical` | Chromium/headless shell revision `1243`，`153.0.8010.12` | 全部 behavior、keyboard、a11y；唯一 canonical pixel baseline |
| `firefox-behavior` | revision `1543`，`155.0` | behavior、keyboard、a11y；无跨引擎 pixel equality |
| `webkit-behavior` | revision `2359`，`26.6` | behavior、touch/back、keyboard、a11y；无跨引擎 pixel equality |

Canonical CI 是 `ubuntu-24.04` x64、headless、Node `24.20.0`、pnpm frozen lock 和 Playwright-managed browser revision。每份 transcript 记录 GitHub runner `ImageOS`/`ImageVersion`、browser executable identity、package lock hash 与 source commit。runner image 变化必须显式重跑并人工评审 baseline，不能批量接受。

固定 emulation：

| 字段 | Canonical value |
| --- | --- |
| viewport | compact `390×844`；medium `834×1112`；expanded `1440×900` |
| viewport class | compact `<768`；medium `768–1023`；expanded `>=1024` |
| device scale factor | `1`；真实高 DPR 只做 behavior 补充，不共享 baseline |
| locale / timezone | screenshot `en-US` / `UTC`；behavior 追加 `zh-CN`、`de-DE`、`ar` RTL |
| color / motion | light、dark 各有 baseline；`reducedMotion: reduce` 有 behavior gate |
| font | self-hosted Inter variable，等待 `document.fonts.ready`；禁止远程 font |
| data / clock | 固定 fixture IDs、文案、日期与 `2026-01-15T12:00:00Z` |
| network / animation | 默认无外网；CSS transitions/animations 关闭，caret 隐藏 |

响应式断点测试必须覆盖 `767/768` 与 `1023/1024` 两侧。resize 可以改变 layout/presentation，不能改变 route ID、Actor、access result 或业务数据。

## 4. 双 Shell corpus

只实现两个 Shell identity，避免把 desktop/mobile layout 误写成三个产品：

| Shell | expanded / medium | compact | 结构差异 |
| --- | --- | --- | --- |
| `default-shell` | `sidebar-saas` 固定 sidebar；medium modal drawer | `mobile-tabs` + per-tab route stack | 信息架构优先，主要导航沿 viewport 改变位置 |
| `workbench-shell` | command rail + split workspace + inspector | workspace header + task tabs + full-screen overlays | 工作区/命令优先，不复用 default Shell 的页面 DOM 树 |

两者消费同一份 fixture contributions：6 routes、7 navigation entries、4 commands、相同 stable IDs、access policies 与 renderer bindings。`default-shell` 和 `workbench-shell` 可以有不同布局、navigation placement、overlay 和 recipe composition，但 canonicalized semantic evidence 必须一致。

贡献集至少包含 public/auth/app/settings layout、index/list/detail/edit routes；primary/secondary/utility/mobile-more navigation；global、route-local 和 selection command。未启用 Kit 的 route/navigation/command/renderer 必须同时缺席，不能只隐藏入口。

每个 Shell × viewport class 覆盖以下标准状态：

```text
loading | empty | ready | refreshing | error |
permission-denied | offline | unsupported
```

`permission-denied` 不泄漏资源存在性；`empty` 只在成功加载且确实为空时出现；`refreshing` 保留现有内容；`unsupported` 必须说明缺失 renderer/capability，不显示空白页。

## 5. 行为与失败矩阵

| 场景 | 必须证据 | 失败 code |
| --- | --- | --- |
| 两 Shell 消费同一 contributions | canonical route/navigation/command IDs、排序和 access 结果相同 | `E_UI_CONTRIBUTION_MISMATCH` |
| route tree / deep link | list/detail/edit 命中稳定 Route ID；刷新不丢 identity | `E_UI_ROUTE_IDENTITY` |
| compact/medium/expanded | 边界两侧 Shell layout 正确，Actor/access 不变 | `E_UI_RESPONSIVE_IDENTITY` |
| default sidebar/drawer/tabs | expanded/collapsed 偏好、drawer close、tab stack/scroll 可恢复 | `E_UI_NAVIGATION_STATE` |
| browser Back / direct URL | Desktop outlet 与 compact stack 表示同一 route | `E_UI_HISTORY_STATE` |
| standard states | 两 Shell 的八种状态均有可达主动作和稳定语义 | `E_UI_STATE_COVERAGE` |
| disabled Kit | contribution、renderer 与 bundle observation 全部不存在 | `E_UI_DISABLED_CAPABILITY` |
| keyboard / skip link | 只用键盘可达全部关键动作，顺序稳定且无 shortcut 冲突 | `E_UI_KEYBOARD` |
| route focus / announcement | route 后焦点到主标题或保留合理触发点；live region 宣告标题 | `E_UI_FOCUS` |
| drawer/dialog/palette | focus trap 不泄漏；Escape/close 恢复到原 trigger | `E_UI_OVERLAY_FOCUS` |
| route/local error boundary | 局部错误保留 Shell、导航、correlation 与 retry | `E_UI_ERROR_BOUNDARY` |
| token/recipe replacement | 品牌与结构可区分，无 internal import/selector patch | `E_UI_PUBLIC_BOUNDARY` |
| Public Override | compatibility report 标为 manual review，不能自动通过 | `E_UI_OVERRIDE_REVIEW_REQUIRED` |
| previous minor Shell | 相同 public contract 无修改运行，或输出明确 compatibility failure | `E_UI_COMPATIBILITY` |
| visual comparison | 固定命名、环境与阈值；diff artifact 可审查 | `E_UI_VISUAL_DIFF` |
| accessibility | axe、语义、键盘、focus/announcement 共同通过 | `E_UI_ACCESSIBILITY` |
| runner/tool identity | exact package/browser/runner input 与 lock 不匹配即先失败 | `E_UI_ENVIRONMENT` |

Diagnostic record 固定 `code`、`scenarioId`、`shellId`、`viewportClass`、`browserProject`、`routeId?`、`contributionId?` 和稳定 `message`。不得包含绝对路径、动态端口、时间戳、DOM 全量、浏览器 stack 或第三方原始错误；原始 trace/diff 只作为非 canonical CI artifact。

## 6. 视觉门禁

- Canonical baseline 仅由 `chromium-canonical` 在同类 Ubuntu runner 生成；snapshot 名包含 Shell、route、state、viewport、scheme，不包含本机路径。Playwright 明确说明 host OS、版本、设置和硬件会影响渲染，因此 baseline 与 comparison 必须来自同类环境。[Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
- `toHaveScreenshot` 固定 `threshold: 0.2`、`maxDiffPixels: 100`、`animations: 'disabled'`、`caret: 'hide'`。任何超阈值结果失败并上传 expected/actual/diff。
- baseline 覆盖两 Shell × 三 viewport × light/dark 的 `ready`，并覆盖 compact `loading/error/permission-denied/offline`；其余状态用结构化 DOM/a11y evidence，控制矩阵规模。
- 只允许 mask 已在 fixture contract 声明的非确定区域；时间、ID、动画和 font 必须从源头固定，不能用大面积 mask/CSS 隐藏变化。
- `--update-snapshots` 只能在专用人工评审变更中使用。CI、普通修复或依赖升级不能自动写回 baseline。
- screenshot 证明像素稳定，不证明语义正确；不同 browser/OS 不比较同一 PNG。

## 7. Accessibility 与交互门禁

- 每个 Shell、viewport class 和八种标准状态执行 axe WCAG A/AA（2.0/2.1/2.2）scan，`violations` 必须为零；禁止全局 `exclude`、`disableRules` 或保存已知违规快照。[axe rule tags](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)
- 显式断言唯一 `main`、landmark、heading hierarchy、page title、skip link、active route、accessible names、错误关联和 live region；axe 的 `incomplete` 结果进入 artifact 并阻止无评审的 Pass。
- 键盘脚本覆盖 Tab/Shift+Tab、Enter/Space、Arrow、Escape、Home/End、command shortcut；触控脚本覆盖最小 `44×44 CSS px` 目标、safe area 和关键动作无 hover 依赖。
- route change、drawer/dialog/palette open-close、retry、permission/offline transition 都断言 active element 和恢复目标；禁止焦点落到 detached/body。
- 200% zoom、forced colors、reduced motion、LTR/RTL 与长文本使用 behavior gate。自动 scan 不能替代屏幕阅读器/人工包容性评审；Playwright 官方也明确建议自动、人工与包容性用户测试结合，S8 Pass 前需记录至少一次人工 focus/announcement/zoom review。[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

## 8. Canonical transcript 与命令

实现项必须生成 `spikes/s8-ui/transcripts/<platform>.json`，包含 schema/version、source revision、lock hash、runner/browser identities、fixture hash、每场景 outcome、diagnostics、visual summary、axe summary 和最终 matrix hash。canonical JSON 不包含 PNG、trace、绝对路径或动态时长。

计划命令（当前不存在，不能作为已执行证据）：

```bash
fnm exec --using=24 pnpm test:s8
fnm exec --using=24 pnpm test:s8:update-snapshots  # 仅人工评审
fnm exec --using=24 pnpm test
fnm exec --using=24 pnpm verify:docs
```

实现顺序固定为：schema/fixture → exact install with scripts disabled → static contribution compiler → 两 Shell → behavior/a11y → canonical Chromium baseline → Ubuntu CI → previous-minor compatibility。浏览器安装/缓存、baseline 更新和 CI artifacts 必须是显式步骤。

## 9. 通过条件与失败选择

S8 只有在 exact candidates 和 frozen browser revisions 于目标 Ubuntu 环境运行全部 corpus、双 Shell canonical semantics 一致、visual/a11y/keyboard/focus gates 通过、previous-minor fixture 有证据且资源/artifact 边界可复现时才能标记 Pass。

失败选择：

1. React Router Data Mode 无法保持公共 Route Contract 独立时，改写 adapter；不把 router types 提升为公共 contract。
2. React Aria Components 破坏 public boundary、结构自由或稳定测试时，复审 `@base-ui/react` 并重跑完整 corpus。
3. Chromium visual 在固定输入仍不稳定时，先收窄 screenshot surface/修复 font 和环境；不提高容差掩盖。
4. Firefox/WebKit 的合法平台差异进入显式 browser outcome；关键行为缺失则候选失败，不能标记 unsupported 跳过。
5. 任一 a11y violation、focus trap、关键动作不可达或 permission 泄漏均阻止 Pass。

## 10. 已知限制与下一实施项

`A1-S8-02` 已在 macOS arm64、Node 24.20.0 完成：exact dependencies 以 scripts disabled 安装；Chromium `1243`、Firefox `1543`、WebKit `2359` 显式下载；同一组 6 routes、7 navigation entries、4 commands 驱动 `default-shell` 与 `workbench-shell`。三浏览器共通过 15 个 behavior/keyboard/focus/drawer checks 和 144 个零 violation/零 incomplete axe scans，Chromium 通过 20 个 local visual comparisons；matrix hash 为 `73a2e570c99f2ca088dcb4b6a2793c58477098558670dae287adb50f639df038`。本地 executable SHA-256 分别为 Chromium `8319963f…b668a`、Firefox `e75d92f6…7fbf5a`、WebKit launcher `a85baad3…c63b`。`A1-S8-03` 负责 Ubuntu canonical baseline 与最终候选决策。Production UI packages、业务页面、真实 Identity/API、Native renderer 与部署仍不在范围内。
