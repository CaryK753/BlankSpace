# Blankspace 品牌与视觉基线

## 1. 品牌表达

Blankspace 的视觉需要传达三个事实：稳定的 Foundation、留给产品代码的明确空间，以及能够持续演进的模块连接。品牌不使用火箭、云朵、机器人或“万能 AI”意象，也不以功能数量制造复杂感。

首页的核心表述是：

> 一个不会因为产品定制而失去上游更新能力的模块化应用底座。

语气保持克制、精确、面向工程实践。视觉可以有技术感，但不能比产品边界和证据更抢眼。

## 2. 正式资源

| 资源 | 文件 | 用途 |
| --- | --- | --- |
| Logo lockup | [`assets/brand/blankspace-logo.jpeg`](assets/brand/blankspace-logo.jpeg) | 浅色背景、文档标题、仓库与社区资料 |
| README cover | [`assets/brand/blankspace-readme-cover.jpeg`](assets/brand/blankspace-readme-cover.jpeg) | GitHub README 和阶段性介绍页首屏 |

当前文件保持原始比例：Logo 为 744×233，封面为 720×240。不得非等比拉伸、裁切标志或重新排版 wordmark。Logo 四周至少保留相当于左侧括号笔画宽度的净空。

## 3. 色彩

以下色值从当前资源提炼为文档与未来原型的视觉基线，不是已经冻结的 UI token contract：

| Token | 建议色值 | 用途 |
| --- | --- | --- |
| `brand.indigo` | `#5B5CE2` | Logo、主要品牌强调、链接或焦点候选 |
| `brand.indigoBright` | `#716CFF` | 深色表面的小面积高光，不作为长文本颜色 |
| `surface.midnight` | `#0D1020` | 封面与技术演示的深色基底 |
| `surface.paper` | `#F7F7FB` | 浅色文档与品牌留白 |
| `text.ink` | `#111218` | 浅色背景主要文字 |
| `text.muted` | `#9A9DB2` | 深色背景辅助文字，使用前必须验证对比度 |

品牌色不替代语义色。成功、警告、错误、权限与 disabled 状态仍需在 S8/UI Shell 中单独定义并通过对比度验证。

## 4. 字体与排版

- 品牌和正文优先使用中性、易读的无衬线字体；文档采用系统字体栈，避免为了 Logo 新增运行时字体依赖。
- 标题短而直接，正文行长保持可读；代码、hash、状态 ID 使用项目现有等宽字体环境。
- 英文品牌固定写作 `Blankspace`；Logo 原图中的小写 wordmark 不改变正文拼写规则。
- 不用全大写长句、霓虹描边或过度字距营造“未来感”。

## 5. 图形语言

- 方括号般的开放边界代表 framework-owned core 对产品扩展空间的保护；
- 模块节点和连接用于解释 build、compose、extend，但每张图只表达一个主要关系；
- 深色封面可使用少量靛蓝光感，普通文档和产品界面优先平面、清晰、低装饰；
- 留白是品牌结构的一部分，不用卡片、光效或装饰节点填满页面；
- 真实产品 UI 继续服从 Product Shell、Design System 与 accessibility contracts，本页不提前决定按钮、表单或导航样式。

## 6. 使用门禁

- 新增品牌资源时保留来源、尺寸、格式和用途说明；
- README、网站和社交封面使用同一定位，不宣传尚未实现的能力；
- raster Logo 适合当前阶段，正式发布前应依据同一几何结构补充可审查的矢量源文件、单色版和小尺寸图标；
- S8 前的视觉稿均为品牌探索，不得作为 UI conformance evidence。
