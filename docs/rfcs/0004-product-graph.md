# RFC-0004：Product Graph 与 Runtime Entries

## 状态

Proposed

## 背景

Preset、Kits、adapters、Product Modules 和多平台 entries 组合后，开发者与 AI 必须看到框架最终装配了什么。若 Graph 只是内部构建缓存，升级分析、受影响测试、安全检查和运行时复现都会各自重建不一致的事实。

## 决策

### 1. Product Graph 是派生的单一装配事实

Graph 由以下输入确定：

```text
blankspace.config.jsonc
installed package manifests
Product Module JSONC descriptors
statically referenced Module declarations and hashes
blankspace.lock
target runtime
```

它记录解析结果，不取代源码配置或 package lock。Graph 只能由 Compiler 生成，提交策略由后续原型决定，但 CI 必须能重建并比较。

### 2. 最小 schema

```ts
interface ProductGraphV1 {
  $schema: string;
  schemaVersion: '1';
  frameworkVersion: string;
  target: RuntimeTarget;
  inputHash: string;
  assemblyId: string;
  kits: KitNode[];
  adapters: AdapterNode[];
  modules: ModuleNode[];
  services: ServiceBinding[];
  events: EventBinding[];
  contributions: ContributionNode[];
  migrations: MigrationNode[];
  entries: RuntimeEntryNode[];
  edges: GraphEdge[];
  diagnostics: Diagnostic[];
}
```

Graph 保存 secret reference 的名称、作用域和是否满足，不保存 secret 值。绝对本机路径在可分发 Graph 中规范化为产品相对路径或 package identity。

Module descriptor 必须静态引用它提供/消费的 Services、Events、API operations、Jobs、UI contributions、migrations、data domains 和 policy/invariant metadata。Compiler 只读取静态数据，不执行 entry 代码做发现；Registry 对账实际 bindings/handlers，少报、多报或 hash 不一致均使构建失败。对应 V1 schema 在 Phase 1A 实现，未完成前不能宣称 Graph 对产品代码完整。

Compiler 同时生成 Executable Registry。Registry 只映射 Graph entry、binding 和 handler ID 到静态 module specifier、export name 和 factory，不包含新的依赖决定：

```ts
interface RegistryDescriptorV1 {
  schemaVersion: '1';
  assemblyId: string;
  entries: Array<{
    entryId: string;
    module: string;
    exportName: string;
  }>;
  bindings: Array<{ serviceId: string; providerId: string; entryId: string }>;
  handlers: Array<{ eventId: string; handlerId: string; entryId: string }>;
}
```

`assemblyId` 来自规范化 Graph（计算时省略 `assemblyId` 字段）与 Registry descriptor（同样省略 `assemblyId` 字段）的 canonical serialization，避免自引用。Registry 生成模块嵌入同一 ID；Runtime 在导入 entry module 或执行任何 factory 前比较二者。package lock、产品源码和 manifests 的内容摘要进入 `inputHash`，构建系统另外校验实际 bundle trace；`assemblyId` 不冒充代码签名。

### 3. 明确边类型

`GraphEdge` 至少区分：

- `requires-service`；
- `optional-service`；
- `provides-service`；
- `subscribes-event`；
- `orders-migration-after`；
- `contributes-ui`；
- `includes-entry`；
- `consumer-import`。

初始化顺序只使用硬依赖边，不因 Event subscription 或 UI contribution 建立启动顺序。`test --affected` 使用硬依赖、公开 import、Event consumer 和 migration 关系，并在无法静态确认动态依赖时扩大测试范围而不是漏测。

Phase 1 的 affected 扩张以整个 target 为安全上界：解析失败的 dynamic import 会触发 warning 并运行该 target 全部测试。Event Contract 或 schema 变化先加入直接 subscribers，再沿这些消费者的硬依赖与公开 import 反向传播。

### 4. Preset 展开

Preset 只生成显式配置片段。Compiler 先展开 preset，再处理根 `kits`。同一 Kit ID 同时存在时，产品配置对象整体替换 preset 配置对象；禁止递归深合并、数组拼接或按字段执行“最后注册获胜”。Graph 必须记录 preset 原始对象、产品替换对象、最终对象及 `source: product-replacement`，并由 `explain` 展示替换链。产品未重复声明时才使用 preset 对象。Preset 不能绕过产品对 secret、adapter 或关键领域策略的显式选择。

### 5. Entry 裁剪

每个 entry 声明 target 和所需 capabilities。Compiler 从目标根入口沿硬依赖和 import 边计算闭包：

- server-only entry 不进入 browser；
- desktop-only adapter 不进入 web；
- 未启用 Kit 的 entry 不进入任何产物；
- shared entry 只能依赖所有目标均可用的 Contract 与纯逻辑；
- server SecretRef 流向 web 或 shared 代码时编译失败。

“未出现在 Graph”不等于已经从 bundler 产物删除，因此 release 验证还必须检查 bundle/module trace。

RFC-0015 引入多客户端后，Graph 以 client ID 而不是模糊的 `mobile`/`desktop` 枚举作为客户端构建根，记录 platform、Client Runtime、UI Family、renderer coverage、capabilities、fallback 与支持证据。Phase 1 schema 仍只生成现有 `web`/`server` Graph，不提前接受未来字段。

### 6. 确定性与安全

相同规范化输入必须生成字节稳定的 Graph：节点按 type/id/version 排序，边按 kind/from/to 排序，时间戳不得进入内容 hash。Product config 和 Module descriptors 使用 RFC-0013 定义的 JSONC 静态数据，不执行产品代码；环境配置只能通过结构化 SecretRef 表达。

Compiler 校验 descriptor 和 entry 的真实路径、符号链接边界、package identity、schema 与 lock 一致性。错误 Graph 不得交给 Runtime 启动。

Import 边界以目标语言解析器和 package exports 的真实解析结果为准；type-only import 不进入 runtime 闭包但仍检查 public boundary，无法静态解析的 dynamic import 禁止跨 Module/Kit internal。SecretRef 只表示 `server` scope 的不透明秘密引用；客户端可见值是普通公开配置，不使用 SecretRef。任何包含 SecretRef 的配置节点沿 binding 与 entry 边到达 web/shared 时失败。Runtime 只在 server host 启动时通过 host secret provider 解析值。

### 7. Inspect 接口

```bash
blankspace inspect graph
blankspace inspect service blankspace.billing
blankspace inspect affected product/modules/documents
blankspace inspect graph --json
```

输出必须解释“为什么存在”和“为什么被排除”，包含完整依赖链，而不是只列最终节点。

### 8. Phase 1 可执行子集

首个原型只需把以下节点和关系做成完整 schema：web/server entry、Kit、Module、Service binding、Event subscription、SecretRef、hard/optional/import edges、Graph/Registry assemblyId，以及一个 affected-test mapping。UI、job 和 migration 节点可以先作为带稳定 ID 的 opaque contribution，不阻塞 Runtime。

具体 JSON Schema 在实现 PR 前作为 `@blankspace/contracts` 的源文件发布，并由它生成 TypeScript types 与 validators；RFC 中的 TypeScript 是语义示例，不替代该交付物。每个 entry 具有 `entryId`、owner identity、target、module specifier、export name、requires bindings 和 content digest。稳定拓扑使用 Kahn 算法并以 entryId 作为同层排序键；循环 diagnostic 返回最短可复现环路径。

## 验收场景

1. 相同 checkout 在两个绝对目录生成相同 Graph；
2. preset、产品覆盖和依赖来源均可追溯；
3. 缺失 Service、循环硬依赖、重复 provider 和 secret 泄漏阻止 Graph 生成；
4. Phase 1 的 web 与 server 两个目标只包含各自闭包；desktop 在对应 Runtime RFC 后使用同一规则补充验证；
5. 修改 Event schema 能把订阅消费者纳入 affected tests；
6. 动态依赖不确定时 affected 选择安全扩大；
7. Runtime 在 Graph 与 Registry 的 assemblyId 不匹配时拒绝导入 entry 并启动；
8. bundle trace 证明未启用 Kit 实现没有进入产物。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 运行时扫描注册 | 开发灵活 | 不可复现、难裁剪和升级 | 拒绝 |
| 各工具自行解析源码 | 工具独立 | 事实漂移、重复实现 | 拒绝 |
| 编译生成版本化 Graph | 可解释、AI 友好、可验证 | schema 成为公共兼容面 | 采用 |

接受的代价是配置表达能力受到限制，Graph schema 需要版本化迁移。

## 重审触发条件

- 受限配置无法表达两个真实产品；
- Graph 生成明显拖慢反馈循环；
- bundler 与 Graph 闭包长期无法一致。
