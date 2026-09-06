# 上游升级与兼容性

## 1. 目标

产品与 Blankspace 分离的价值只有在升级时才能被证明。框架必须让开发者在修改产品前知道升级影响，在自动修改后看到完整差异，在验证失败时能够回滚。

“容易升级”不等于永不出现 breaking change，而是：

- 影响可提前检测；
- breaking change 有迁移路径；
- 自动修改范围明确；
- 数据迁移可预检；
- UI override 风险可识别；
- 失败可以回到升级前状态。

## 2. 兼容性边界

Blankspace 只对公开 extension surfaces 提供兼容承诺：

- Foundation Public API；
- Kit Service Contracts；
- Event schemas；
- Product Module descriptor；
- Product Graph schema；
- Design semantic tokens、component recipes、semantic contributions 和 Shell Contracts；
- public component overrides；
- Workspace Provider 和 Runtime Adapter contracts；
- Client Runtime/UI Family、Screen/Route Contract 和 renderer coverage；
- Design Semantic Tokens、Component Recipes 与平台 mapping；
- CLI 命令与结构化输出。

框架内部文件、未导出的组件和生成实现不属于兼容边界。Product Overlay 导入 internal 路径必须在构建时失败，而不是只在文档中劝阻。

## 3. 版本维度

版本不应全部混入一个数字：

| 版本 | 说明 |
| --- | --- |
| Framework version | Blankspace 发布版本 |
| Contract version | Service、Event、Shell 等公共契约版本 |
| Product Graph schema | 编译器输入输出结构版本 |
| Server protocol version | 客户端与 Server 兼容范围 |
| Data schema version | Kit、Module、本地库与远端库迁移状态 |
| Client Runtime version | client 绑定的 host、UI Family、toolchain 与 capability 范围 |
| Design System version | semantic tokens、recipes 与 renderer mapping 的兼容范围 |

产品通过 `blankspace.lock` 固定解析结果：

```text
framework
kits and adapters
contract versions
product graph schema
runtime targets
server protocol range
```

lockfile 是工具生成的事实记录，不存放 secret，也不替代 package manager lockfile。
解析器必须同时校验 package manager lockfile 与 `blankspace.lock`；二者记录的框架、Kit 或 adapter 版本不一致时，`check` 直接失败。Kit 和 adapter 可以独立发布，但 compatibility manifest 必须声明其 Contract、Framework 和 Runtime 兼容范围，由同一个解析器给出可解释的版本选择或冲突原因。

## 4. 版本策略

- 公共 Contract 使用语义化版本；
- 同一 major 内新增字段应保持可选或有默认值；
- 删除 API 前必须经历明确 deprecation 周期；
- breaking change 必须附带 migration guide；
- 可以机械转换的 breaking change 必须提供 codemod；
- Server protocol 明确客户端兼容范围和降级行为；
- 数据 migration 不因 package downgrade 自动回滚。

框架 release 必须发布机器可读 compatibility manifest：

```json
{
  "version": "2.4.0",
  "contracts": {},
  "deprecated": [],
  "breaking": [],
  "codemods": [],
  "minimumServerProtocol": "3"
}
```

## 5. 升级流程

### 5.1 预检

```bash
blankspace upgrade 2.4.0 --check
```

只读取当前项目并生成报告，不修改文件：

```text
Safe
  12 compatible Contract updates

Codemod available
  WorkspaceShell props 2.1 → 2.2

Manual review
  Product override: DefaultWorkspaceSwitcher

Blocked
  stripe adapter does not support Billing Contract 3

Data
  2 pending migrations, both forward-only
```

### 5.2 生成升级计划

```bash
blankspace upgrade 2.4.0 --plan upgrade-plan.json
```

计划包含：

- package 变更；
- config 变更；
- codemods；
- generated graph 变化；
- migrations；
- 需要人工确认的 UI overrides；
- 验证命令；
- 回滚边界。

### 5.3 应用

```bash
blankspace upgrade --apply upgrade-plan.json
```

工具只执行计划内的变更，不触碰未声明产品文件。应用后保留普通文件差异供开发者或 AI 审查。

`--apply` 必须先建立可恢复点，并以变更集为单位工作：package/config/codemod 任一步失败时恢复代码与 lockfile。数据库 migration 不纳入这种自动回滚；它必须在计划中单独标记、先备份和预检，并由部署流程显式执行。

### 5.4 验证

```bash
blankspace check
blankspace test --affected
blankspace build --all-targets
blankspace migrations verify
blankspace upgrade --verify upgrade-plan.json
```

前四个命令是计划记录的底层验证项；最后一个命令校验 plan 输入未变化、汇总这些结果，并把 `applied-unverified` 转为完成状态。验证失败时默认保留差异供诊断；需要放弃本次代码级升级时运行 `blankspace upgrade --restore upgrade-plan.json`。恢复不包含数据库 migration。

升级只有在 Product Graph、Contract、测试、构建和 migration 检查通过，并由 `upgrade --verify` 完成新 lock 标记后才算完成。

## 6. UI 兼容

UI 最容易破坏升级，因此按风险分级：

| 定制方式 | 升级风险 | 兼容策略 |
| --- | --- | --- |
| Tokens | 低 | schema 检查和废弃提示 |
| Semantic Contributions | 低 | 稳定 ID 和类型 |
| Product Shells | 中 | 带版本 Shell Contract |
| Public Override | 高 | 必须声明兼容范围并人工复查 |
| Internal import/patch | 不支持 | 构建失败 |

视觉回归不能只依赖类型检查。框架应提供标准页面状态和截图测试 harness，产品为自定义 Shell 与 overrides 保存自己的基准图。

跨 UI Family 不比较像素相同，而是分别比较各 Renderer 的兼容版本；跨平台共同检查 Screen 状态覆盖、动作可达性、Design semantics 和 accessibility。跨生态升级按 RFC-0017 将目标 client 所需 artifacts、generators、renderers、theme mappings、evidence 与各包管理器 lock 作为一个 staging 计划验证后提交。更换一个 client 的主 Runtime（例如 Capacitor → SwiftUI）属于人工 migration，不是普通主题或 minor upgrade。

## 7. 数据兼容

升级报告必须区分：

- 只影响代码的 migration；
- 服务端数据库 migration；
- 客户端本地数据库 migration；
- replicated 数据格式 migration；
- 需要 Server 与 Client 协调的 protocol migration。

对 local-first 产品，升级必须考虑旧客户端仍会同步旧格式。任何 schema 变更都要说明：

- 最低兼容客户端；
- 新旧数据是否双读或双写；
- 离线设备重新上线时如何处理；
- migration 是否可暂停和恢复；
- 备份与恢复点。

涉及 Client、Server 与数据格式的版本不能假定同时发布。compatibility manifest 必须描述可接受的滚动升级顺序、协议重叠窗口和拒绝连接/只读降级行为。

## 8. AI 升级协作

AI 可以：

- 运行 `--check` 和读取 JSON 报告；
- 解释 breaking changes；
- 应用标记为 safe 的 codemod；
- 修改 Product Overlay 以适配新 Contract；
- 运行受影响测试并总结差异。

AI 不应自动：

- 执行生产 migration；
- 删除旧数据；
- 接受高风险 UI override 兼容；
- 修改 secret 或发布凭据；
- 绕过失败的 compatibility check；
- 使用全局忽略开关隐藏类型或迁移错误。

## 9. 框架自身的兼容测试

Blankspace release CI 应维护：

- 上一个 minor 版本生成的参考产品；
- 当前 AFFiNE 参考产品切片；
- remote-only SaaS 参考产品；
- 自定义 Product Shell 示例；
- 至少一个第三方 adapter fixture；
- local 与 replicated 数据升级 fixture。

新版本必须验证旧 Product Overlay 在不修改或经过声明 codemod 后仍可构建和运行。

## 10. 诚实的限制

Blankspace 无法保证任意深度定制永远自动兼容。兼容成本由产品跨越的边界决定：

```text
Public Contract 内定制
→ 框架承担迁移责任

Public Override
→ 框架提供报告，产品承担视觉复查

Internal patch
→ 不受支持
```

这条边界必须从 Phase 1 由编译器执行，否则“轻松同步上游”会退化为口号。
