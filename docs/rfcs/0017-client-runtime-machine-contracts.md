# RFC-0017：多客户端机器契约冻结计划与分发协议

## 状态

Proposed

## 背景

RFC-0015 与 RFC-0016 确定了多客户端的概念边界，但仅靠字段叙述不足以让两个实现者生成相同的 Graph、选择相同 artifact 或得到相同 renderer coverage。本 RFC 确定下一 schema major 的协议边界、解析规则与冻结顺序；只有下列 schema 和 corpus 齐备后才算“机器契约已冻结”。它不是 Phase 1 已交付能力。

现有规范化草案及字段目录位于 [`docs/schemas/proposed/client-runtime`](../schemas/proposed/client-runtime/)。这些 schema 只供 CR1/DS1 spike 验证，不进入 Phase 1 Compiler 输入；验证通过后才迁入 `packages/contracts/schemas/`。它们不得被描述为已经交付的 Runtime SDK。

### 冻结门禁

| 必需产物 | 当前状态 | 进入实现的条件 |
| --- | --- | --- |
| Distribution Manifest | schema 草案 | 扩充 artifact 选择正反 corpus |
| Runtime/Renderer/Capability/UI/Shell manifests | schema 草案 | 扩充唯一解析与裁剪 corpus |
| ProductGraphV2 与 assembly index | schema 草案 | 扩充 canonical hash、引用和 fallback corpus |
| Tool/Generator Protocol | schema 草案 | 补各 operation result 与真实路径沙箱 spike |
| Support suite/evidence/trust/revocation | schema 草案 | 补签名、过期、撤销和全量通过 corpus |
| Design System/Theme IR/Theme Renderer | schema 草案 | 补 merge、override 与 fallback corpus |
| Lock V2/compatibility/upgrade plan | schema 草案 | 补跨生态 staging、逐 client 风险和恢复 corpus |
| Request Transcript V1 | schema 草案 | 补跨语言 canonicalization corpus |

任一项未通过对应 corpus 与 spike 都不能作为第三方稳定实现依据，也不能把 CR1/DS1 标为通过。以下章节中的类型与算法是要被 schema/corpus 固化的规范要求，而不是已交付声明。

## 决策

### 1. 每个 client 一张 Product Graph V2

采用 **每个 client 一张 Graph**，避免把 Xcode、Gradle 与 Node 的无关依赖混入同一闭包。一次产品解析另有 assembly index，按 `clientId` 升序引用各 Graph 的 `assemblyId`。

产品输入使用独立的 `ProductClientsV2`，声明 ClientTarget、锁定 Runtime、根 capability requirements 与 `excludeFeatures`；Graph 是 Compiler 输出，不能反过来充当产品配置。Phase 1 config 不接受该结构。

`ProductGraphV1` 不增加字段。`ProductGraphV2` 的节点至少覆盖 module、kit、runtime、artifact、generation、renderer、capability、theme、toolchain 与 evidence。节点以 `(kind,id,version,contentHash)` 排序，edge 以 `(from,to,kind)` 排序；canonical JSON 使用 UTF-8、对象键字典序、无多余空白。`assemblyId = sha256(canonical graph without assemblyId)`。用户偏好、当前 OS 设置和时间戳不进入 Graph。

### 2. 身份引用

- `RuntimeRef = { id, version, manifestHash }`，禁止裸字符串；
- `UiFamilyRef = { id, major }`，由 Runtime manifest 派生，产品最多声明 assertion；
- `RendererRef = { id, version, artifactId, contractKinds }`，独立于 Runtime 版本；
- 每个 client、每类 mandatory contract 必须最终解析到恰好一个 Renderer；零个或多个都失败。

同属 `react-desktop` 不表示 Web 与 Electron 使用同一 renderer；它只表示二者消费同一 major 的 UI 协议。

### 3. Distribution Manifest V1

[`distribution-manifest.schema.json`](../schemas/proposed/client-runtime/distribution-manifest.schema.json) 是跨 npm、SwiftPM、Maven 与受控 binary 的逻辑发布清单。Runtime 与业务 Kit 使用不同 manifest schema，但都通过不可变 URL 加 SHA-256 引用它：Runtime 只声明 host、单一 UI Family、Shell、providers、tools 与 artifact requirements；Kit 声明 Service、UI features、跨 UI Family bindings 与 capability requirements。

artifact role 为 `runtime-host | service | renderer | native-library | generator | build-plugin | verifier | theme-renderer`。Runtime manifest 为每种 `(platform, uiFamily)` 声明必需 role；resolver 只选择目标 client 所需 artifact，不要求无关生态存在。

选择键为 `(role, ecosystem, selector)`。selector 同时匹配 platform、完整 RuntimeRef 与 UI Family major；缺省 selector 字段表示通配。Runtime requirement 明确 ecosystem 与 cardinality，resolver 对每项 requirement 计算候选；零个、多个或 generic/specific 重叠不使用优先级消歧，而按 cardinality 失败。所选 artifact 的 `contractHash` 必须等于逻辑发布的 `contractHash`。坐标按 ecosystem 使用判别对象，不能用一个字符串同时解释 SwiftPM product、Maven GAV 和 npm package。

`blankspace.lock` 记录 distribution manifest hash，并在每个 client 下记录所选 artifact 的 coordinate、version、source revision、content hash、contract hash 与 provenance 摘要。坐标相同但 hash 不同视为供应链漂移。

### 4. UI contribution、coverage 与排除

Kit 必须显式声明 `ui: { kind: "none" }`，或声明版本化 feature 列表。feature 是 `clientOptional`、依赖与排除的最小单位，而不是整个 Kit。

Coverage 的 requirement key 为 `(clientId, contractKind, contractId, contractMajor)`；`rendererId` 与 `entry` 是唯一解析结果，不属于需求键。输入状态只能是 `provided` 或 `fallback`；`excluded` 由合法排除推导，`missing` 只由 Compiler 推导。fallback 必须指向同一 client 的明确 binding，图必须无环。

产品在 `clients.<id>.excludeFeatures[]` 写全局 feature ID。只有 `clientOptional: true` 且反向依赖闭包中没有 Screen、route、contribution、capability 或产品 requirement 时才能排除。Identity 登录、强制安全与法务界面必须标记 `nonExcludable`。Compiler 将 feature 展开为 contract requirements，并要求每个未排除的 mandatory contract 恰好一个 primary binding；fallback 仅在 primary 的已声明运行时条件不成立时按有序无环链启用。

Shell 通过机器可读 manifest 声明支持的 contract kind/major、region 与 presentation；未声明的 region 不能由惯例猜测。

### 5. Capability contract

Capability 使用 `{ id, major }`；requirement 另含 `mode: required | optional`、平台版本约束、provider selector 与显式 fallback IDs。Provider 声明实现版本、适用平台与运行时探测条件。

Compiler 只固化可行且无环的 fallback 链。Renderer 可按 OS 版本、权限和 accessibility 设置在该链内运行时选择；实际用户设置不进入确定性 Graph。没有编译期可行路径的 required capability 失败。

### 6. Tool Protocol V1

`ToolRef` 必须包含 identity、version、artifact content hash、按 ecosystem 定义的 entrypoint、protocol version、允许的 operations 及 request/result schema hashes。`ContractGeneratorRef` 是 ToolRef 加输入 schema kind/version 与输出语言/模块规则，不是自由命令字符串。

CLI 以 `<entrypoint> --request <path> --result <path>` 调用。工具接受一个 JSON request 文件并写一个 JSON result 文件；stdout/stderr 只作人类日志，不承载协议。request 固定 operation、client、Graph/lock/input roots、按路径排序的 input hash、唯一 output root、模块名和 options。result 固定 status、稳定 diagnostic code、按路径排序的 output hash 与 evidence。

默认工作目录为产品根，禁止网络，写入范围仅为分配的 `.blankspace/generated/<clientId>/<operation>/`；主题产物继续位于其下的 `<uiFamily>/`。输出禁止绝对路径、当前时间和随机值。相同 request 在两个干净 checkout 的 output manifest/hash 必须一致。失败不得留下被 Graph 引用的部分产物。

### 7. Theme Renderer

Theme Renderer 是 Client Runtime manifest 的正式扩展点，使用 `theme-renderer` artifact role，声明支持的 Design System schema、UI Family、recipe kinds 与 capabilities。

Theme Compiler 先生成与平台无关的规范化 Theme IR；overlay selector 至少包含 `clientId`，可再约束 platform、Runtime 与 UI Family。输出写入 `.blankspace/generated/<clientId>/render-theme/<uiFamily>/`，不得让 Web 与 Electron 覆盖同一路径。相同 family 的不可变基础产物可以按 hash 去重。

Token、recipe 和 overlay 必须由 DS1 冻结 schema：每个节点声明类型、是否 `platformOverridable` 和 `replace | merge-map | merge-recipe` 合并策略；未声明深合并失败。Theme result 使用 Tool Protocol，记录 renderer、IR、output 与 fallback hashes。

### 8. 支持证据与信任

[`support-evidence.schema.json`](../schemas/proposed/client-runtime/support-evidence.schema.json) 的 subject 绑定 logical runtime version、artifact hash、contract hash、suite identity/digest 与 toolchain matrix，并包含限制、签发者、有效期、签名/provenance 和撤销标识。

只有 Blankspace 维护的发布可获得 `official`。第三方自述不提升有效等级；只有产品信任策略认可的 verifier 所签、未过期且未被独立 revocation registry 撤销、suite 所有 required fixtures 均通过的证据才能得到 `verified`。证据自身的撤销布尔值不具有权威性。产品 allowlist 与独立供应链审查仍是额外门禁。Graph 分别记录 claimed level、evidence digest、effective level 与 policy decision。

时间相关有效性在 release gate 的 `SupportEvaluationRecord` 中计算，记录 evaluation instant、trust/revocation snapshot hashes 与结果；该 record 作为 evidence node 被锁定后才进入发布 Graph。日常打开项目时不得用本机当前时间重写 `assemblyId`。下一次 release/upgrade 必须重新评估过期与撤销状态。

### 9. 原子升级

升级 planner 必须同时解析某逻辑发布在所有目标 client 实际需要的 artifacts、generator、renderer、theme mapping、evidence 与 package-manager locks。兼容清单以 client 为单位报告 contract/design ranges、toolchain 与风险。

计划在 staging workspace 更新 `blankspace.lock`、pnpm lock、SwiftPM resolved、Gradle dependency lock 与生成物；全部 verify 通过后一次提交。迁移前失败恢复所有源文件、locks 和生成物；迁移后失败进入 RFC-0010 recovery，不宣称自动回滚数据。Capacitor 到 SwiftUI 等 Runtime 迁移始终是显式迁移项目，不作为普通依赖升级。

### 10. Phase 1 边界

Phase 1 的 React Screen Contract 只是实验：作为 opaque `web` contribution 承载，不改变 Phase 1 config、ProductGraphV1 或发布门禁。CR1/DS1 先验证本 RFC；只有 V2 schema 和 fixtures 被接受后，多客户端能力才可进入交付承诺。

跨 transport 测试比较规范化 request transcript：method、大写无关的规范化 headers 子集、规范化 path/query、canonical body、operation ID 与 typed error。只有协议明确要求 canonical encoding 的字段才比较 wire bytes。

## 验收场景

1. SwiftUI client 只锁定其必需 artifacts，不因缺少 Maven renderer 失败；
2. 同时匹配两个 renderer 时在构建前失败，且报告冲突选择键；
3. optional feature 存在反向依赖时不能排除；
4. 已过期或撤销的第三方证据不能产生 `verified`；
5. Web 与 Electron 的主题产物目录不碰撞；
6. 两个干净 checkout 产生相同 Graph、生成清单与 hashes；
7. Phase 1 Compiler 拒绝 V2 字段，而不是静默接受。

## 重审触发条件

- 每 client Graph 无法表达真实跨客户端原子发布；
- selector 在两个官方 Runtime 中仍产生合法多解；
- Tool Protocol 无法覆盖 Xcode/Gradle 的确定性构建；
- support registry 无法及时分发撤销信息。
