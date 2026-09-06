# Proposed 多客户端 Schema

这里保存 RFC-0017 的下一 schema major 草案。它们供 CR1/DS1 原型与第三方评审使用，不是 Phase 1 Compiler 的输入，也不代表对应 Runtime 已交付。

## Schema 目录

| Schema | 负责的事实 |
| --- | --- |
| `client-runtime-manifest.schema.json` | Runtime host、UI Family、artifact requirements、tools、renderers、providers、probes 与 Shell |
| `kit-manifest-v2.schema.json` | Service、UI feature、跨 UI Family bindings 与 capability requirements |
| `product-clients-v2.schema.json` | 产品的 ClientTargetV2、根 capability requirements 与 feature exclusions |
| `distribution-manifest.schema.json` | 一个逻辑版本对应的跨生态 artifacts |
| `product-graph-v2.schema.json` | 单个 client 的确定性依赖与证据闭包 |
| `assembly-index-v1.schema.json` | 产品所有 client Graph 的稳定索引 |
| `tool-protocol.schema.json` | Generator、Theme Renderer、Builder 与 Verifier 的 request/result envelope |
| `design-system-v1.schema.json` | Semantic Tokens、Recipes 与 client-scoped overlays |
| `theme-ir-v1.schema.json` | 平台无关的已解析主题中间表示 |
| `theme-result-v1.schema.json` | Renderer、输出 hashes 与实际 fallback |
| `support-evidence.schema.json` | 一次 compatibility suite 执行证据 |
| `support-trust-v1.schema.json` | Suite、受信 verifier 与独立撤销快照 |
| `support-evaluation-v1.schema.json` | release gate 对 evidence、trust、撤销与产品 policy 的锁定判定 |
| `upgrade-contracts-v2.schema.json` | Lock V2、兼容清单和原子升级计划 |
| `request-transcript-v1.schema.json` | 跨 TypeScript、Swift、Kotlin 比较的规范化请求结果 |

## 两层校验

JSON Schema 校验字段、枚举和局部形状；`x-semanticConstraints` 与 `x-canonicalization` 标记必须由 Compiler/Verifier 实现的跨记录规则。不能因为 AJV 通过就跳过以下检查：

- ID、选择键和 requirement key 唯一；
- Graph 引用完整、排序稳定、fallback 无环；
- artifact contract hash 与逻辑发布一致；
- mandatory contract 恰好一个 primary renderer；
- evidence 覆盖 suite 全部 required fixtures，签名和撤销快照有效；
- output realpath 位于分配的 client/operation staging root；
- locks、生成物和多客户端升级计划在 verify 后原子提交。

运行 `pnpm verify:docs` 会严格编译全部 proposed schemas，并执行 `fixtures/` 中的正反用例。fixtures 当前只是最小 corpus，CR1/DS1 完成前必须覆盖本页全部语义规则。

## 规范化

- JSON 签名和 hash 使用 RFC 8785 JCS；hash 文本格式为 `sha256:<lowercase hex>`；
- 排序使用 UTF-8 字节序，不依赖 locale；
- 协议路径统一为 `/` 分隔的 workspace-relative path；拒绝绝对路径、drive、UNC、反斜杠、NUL、`.` 与 `..` segment；执行器还必须检查解析后的 realpath；
- schema aggregate contract hash 按 schema `$id` 排序，对每份 JCS bytes 求 hash，再对有序 `(id,hash)` 列表求 SHA-256；
- 版本范围统一为半开区间 `{ minInclusive, maxExclusive }`；完整版本使用无 prerelease 的 SemVer `major.minor.patch`，contract/UI major 使用正整数。`minInclusive >= maxExclusive` 是语义错误。首版不接受 prerelease、并集、通配符或隐式上界。

Tool entrypoint 由 Runtime manifest 按 ecosystem 声明。CLI 始终使用 `<entrypoint> --request <workspace-relative-request.json> --result <workspace-relative-result.json>` 调用；工具必须以 result 文件作为唯一机器输出，进程退出码非零或 result 缺失均视为失败。
