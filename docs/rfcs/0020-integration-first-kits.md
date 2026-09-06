# RFC-0020：Integration-first Kit 与薄适配边界

## 状态

Proposed

## 背景

Blankspace 是应用框架，不应重新实现富文本编辑器、CRDT、支付网关、认证协议、搜索引擎、任务队列或对象存储。重复建设这些领域引擎既降低首个产品速度，也会让框架承担远超自身规模的安全、兼容和性能责任。

但“直接安装一个库”仍不能解决多目标裁剪、配置与 secret、生命周期、诊断、能力发现、跨 Kit 数据流、升级检查和 AI 可理解性。本 RFC 冻结两者之间的边界：成熟项目提供领域引擎，Blankspace 提供可检查的集成产品化能力。

## 决策

### 1. 默认购买复杂度，不重造领域引擎

对已有合适成熟实现的领域，官方 Kit 首先选择集成，不自行实现同类核心算法或完整 UI。例外必须在 RFC 中证明：现有方案均无法满足必需约束，且维护、迁移和安全成本已有 owner。

Blankspace 负责：

- adapter manifest、安装和目标裁剪；
- 配置 schema、secret 边界和启动前校验；
- 生命周期、依赖注入、capability discovery 和 typed diagnostics；
- 跨领域所需的最小稳定 Service/Event、数据所有权与事务边界；
- conformance fixtures、版本兼容、升级报告和撤回路径；
- 给人和 AI 使用的集成说明、Product Graph 与机器可读能力。

上游库或服务负责：

- 领域内部数据结构、算法、命令和扩展模型；
- 自身 SDK/API、性能修复、安全修复与版本发布；
- 其明确提供的渲染器、协议、驱动或服务端实现。

Product Overlay 负责：

- 选用哪个 adapter、启用哪些上游扩展和商业能力；
- 产品特有的领域规则、页面、交互、品牌与跨 Kit Coordinator；
- 超出可移植边界时直接使用上游公共 API，并承担相应锁定。

### 2. Adapter 必须薄，不镜像上游 API

Adapter 只桥接 Blankspace 必须统一的装配面，不给上游每个方法再造同名 wrapper。它的公共面限制为：

```text
manifest + config + lifecycle + capabilities
+ portable inputs/outputs required by other Kits
+ diagnostics + conformance + upgrade metadata
```

编辑器的 node command、搜索引擎的 ranking 参数、支付供应商的完整对象、队列的高级调度和认证库的插件 API，都不进入一个假想的最低公分母 Contract。产品可在自己拥有的模块中导入所选 adapter 明确再导出的上游公共 API，或直接导入上游 package。

直接导入上游不是违规，但 `blankspace upgrade --check` 只能保证已声明的集成边界。Product manifest 的目标声明至少包含稳定 ID、package coordinate、version range、targets、capabilities、owner/security contact 和用途；Compiler 从各目标依赖图核对 resolved version，发现未声明的产品级直接依赖时给出诊断。Product Graph 记录声明值与真实解析值，使锁定与升级影响可见。该 schema 与漏报检查尚未实现，在交付前由 DEC-018 冻结；当前文档不能据此声称 direct integration 已受工具保护。

### 3. 官方 adapter 不是 Foundation 依赖

“官方”“默认”和“必选”是三个不同概念：

- `official-reference`：Blankspace 维护并运行兼容矩阵；
- `verified`：第三方 adapter 通过指定版本的 conformance suite；
- `community`：可安装但没有 Blankspace 的持续兼容承诺；
- `direct`：产品直接集成，由产品自行验证。

Preset 可以显式选定官方参考 adapter，但 Foundation 不导入它，未启用 Kit 的产物也不得包含它。产品始终可以替换 adapter；不同 adapter 的 capabilities 不必完全相同。

除 `official-reference` 外，安全与升级风险默认由选择它的产品承担。`verified` 只证明记录版本通过指定 conformance，不代表 Blankspace 持续监控漏洞；`community` 也不产生响应承诺。所有 adapter manifest 和 direct integration 声明必须记录 maintainer/owner、security contact、support level、targets、package coordinate、resolved version 与 capabilities；缺失时不能获得 verified 或进入官方 preset。发现漏洞时，可信 registry 可以撤回验证状态并让 `doctor`/升级检查产生阻断诊断。

### 4. 一个领域可以需要多个引擎

Kit 名称不是“一个库包办整个领域”的承诺。以 AFFiNE 级内容产品为例：

- Tiptap 可作为富文本/结构化文档的 reference adapter 候选；
- BlockSuite 可作为共享 Block 数据与 Page/Edgeless 体验的 reference adapter 候选；
- Monaco/CodeMirror 适合代码编辑，而不是通用文档；
- Yjs 可承担协作数据结构，但网络 provider、权限和持久化仍需显式选择。

因此不能把 Tiptap 包装成万能 `EditorService`，也不能声称安装 Tiptap 就自动获得 AFFiNE 的 Edgeless、数据库视图、文件、搜索与 Workspace。Product 可以组合多个内容能力，Blankspace 只统一它们必须参与的 document identity、生命周期、持久化 receipt、blob reference、index projection 和 sync envelope。

### 5. UI 组件同样 integration-first

“不重造”同时适用于领域 UI。Web/Desktop 应优先复用成熟的 headless primitives、accessibility primitives、上游 widgets 或可复制模板；SwiftUI/Compose 优先使用平台原生控件和成熟平台库。Blankspace Design System 只提供 token、recipe、状态语义和跨 Kit Shell contributions，不建设另一套覆盖所有业务领域的组件库。

但复用 UI 不等于把同一组件树强行运行在所有端。产品负责组合、布局、品牌和平台交互；只有重复出现在多个产品、携带稳定 Kit 语义且通过可访问性/升级验证的 UI，才可以成为可选 Kit renderer。一个上游只提供 Web renderer 时，原生端必须显式选择 native implementation、hybrid/WebView、read-only 或 unsupported。

### 6. 选型门禁

将一个上游实现列为官方参考 adapter 前，至少记录：

1. 许可证与商业功能边界；
2. 目标 runtime、平台和渲染技术支持；
3. 扩展 API、数据格式与导出/迁移路径；
4. local-first、离线、事务和同步适配性；
5. 安全响应、发布节奏和上一 minor 兼容证据；
6. 包体、启动、内存和大数据性能；
7. adapter 删除后产品数据是否仍可解释或导出；
8. 不适配时的明确 fallback、read-only 或拒绝行为。

Manifest 还必须记录准确 SPDX license、delivery model（embedded/self-hosted/managed）、自托管能力和商业功能边界。“开源核心”不等于托管免费，价格和免费额度不进入稳定 Contract。

候选清单只表示待验证，不构成依赖冻结。确切版本只写入 lockfile、adapter compatibility manifest 和阶段 evidence。

### 7. 上游升级与安全责任

官方 adapter 维护者跟踪上游安全公告和兼容窗口，提供 version range、已测试矩阵、迁移说明与必要 codemod。产品升级时 Compiler 同时检查 Blankspace Contract、adapter 和上游 package；无法证明兼容时拒绝自动升级，而不是用宽泛 peer range 假装兼容。

发生上游弃用或安全问题时，Blankspace 可以撤回某个 adapter 的支持等级，但不能静默替换数据引擎。迁移必须显式生成计划、备份、转换证据和回滚点。

## 开发者体验

理想路径是选择能力而不是手工拼装胶水：

```bash
blankspace add editor --adapter tiptap
blankspace doctor editor
blankspace inspect integration editor
blankspace upgrade --check
```

目标 CLI 负责安装兼容版本、写入 Kit 配置、列出可选扩展、生成环境配置、运行 smoke fixture 并把集成写入 Product Graph。上述命令是目标体验，当前尚未实现。

## 验收条件

1. 一个官方 adapter 可以移除或替换而不修改 Foundation；
2. adapter 没有镜像上游大部分 API，深度定制仍能使用上游公共 API；
3. 未启用的上游 package 不进入目标产物；
4. Product Graph 能区分官方、verified、community 和 direct integration；
5. 兼容矩阵同时覆盖 Blankspace、adapter 与上游版本；
6. 至少一个失败 fixture 证明 unsupported capability 在构建或打开前被拒绝；
7. 数据格式、迁移出口和上游锁定对开发者可见。

## 非目标

- 建立 Blankspace 自有的编辑器、搜索引擎、支付网络或认证协议；
- 为所有供应商设计功能完全相同的万能 API；
- 承诺任意两个 adapter 可以无损热切换；
- 仅凭下载量或知名度授予 official 支持等级；
- 把第三方库的完整 UI 强制用于所有平台。

## 重审触发条件

薄 adapter 无法提供必要事务或安全边界、产品普遍需要绕过 Contract、上游数据格式不可迁移、跨平台实现要求共享不可能共享的内部状态，或维护兼容矩阵的成本超过直接由产品集成时重审。
