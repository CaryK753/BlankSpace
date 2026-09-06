# Phase 1 风险实验索引

本页是 S1～S8 的状态入口。成功条件和失败决策以 [RFC-0013](../rfcs/0013-phase-1-technology.md) 为准，实施门禁以 [Phase 1 蓝图](../phase-1-blueprint.md) 为准。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| Not started | 尚未冻结实验输入和成功条件。 |
| Draft matrix | 已起草场景，但工具、环境或输入仍未锁定。 |
| Matrix frozen | corpus/matrix、阈值和失败选择已写入文档，尚未获得执行证据。 |
| Provisional pass | 当前环境或替代工具通过，但目标环境或最终候选工具尚未验证。 |
| Pass | 目标环境、最终候选工具和要求的跨平台矩阵均通过。 |
| Failed | 已有证据推翻候选方案，需要执行预先声明的替代选择。 |

## 当前状态

更新时间：2026-09-06。机器可读状态以 [`../status/project-status.json`](../status/project-status.json) 为准。

| Spike | 状态 | 已有证据 | 下一门槛 |
| --- | --- | --- | --- |
| [S1 Config](S1-config.md) | Provisional pass | Node 24 内置测试 8/8、Vitest、TypeScript、Ajv 与跨目录 hash 通过 | 用选定的生产 validator 替换 spike parser，并完成规定的跨平台矩阵 |
| [S2 Resolver](S2-resolver.md) | Pass | Linux、macOS、Windows 上五种 mode、双 checkout 与双 pnpm store 对账同一 records hash | 保持 S2 corpus 为跨平台回归门，并由 S3 消费 canonical records |
| [S3 Bundle trace](S3-bundle-trace.md) | Pass | JS/CSS/worker/WASM/assets/virtual modules 均进入 canonical trace；Linux、macOS、Windows 运行同一 corpus 并匹配 trace `855f208d…0c14` | 保持 S3 corpus 为跨平台回归门，并由 S4 消费稳定 Graph/产物边界 |
| [S4 Registry](S4-registry.md) | Pass | resolved Service/Event bindings、Registry 双向对账、18 组 pre-factory mismatch、双目录/双顺序和 guarded `fetch` entry probe 已在 Linux/macOS/Windows 匹配同一 canonical identity | 保持 S4 corpus 为跨平台回归门，并由 S5 消费显式 Graph + Registry |
| [S5 Lifecycle](S5-lifecycle.md) | Provisional pass | 串行 factory/start/stop、单一 ready、资源账本、失败回滚、幂等/并发 stop 与启动中取消已在 macOS arm64 取得确定性本地证据 | 冻结生命周期 Event dispatch、嵌套深度和活动 dispatch 排空，再执行 Linux/macOS/Windows 完整对账 |
| [S6 Server](S6-server.md) | Draft matrix | 已起草端口、排空、signal 与 shutdown 场景，无执行证据 | 锁定 Fastify、client、deadline 与 runner，完成 fixture 后冻结矩阵 |
| [S7 Database](S7-database.md) | Draft matrix | 已起草 Kysely/Drizzle/direct SQL 对比场景，无执行证据 | 锁定数据库、候选工具与 runner，完成 fixture 后冻结矩阵 |
| [S8 UI](S8-ui.md) | Draft matrix | 已起草双 Shell、标准状态、视觉与 a11y 场景，无执行证据 | 锁定 UI、浏览器、容差与 runner，完成 fixture 后冻结矩阵 |

## 未来 Client Runtime 轨道

这些实验不改变 S1～S8 或 Phase 1 的退出门禁。只有产品选择相应客户端路线时，才要求对应轨道通过。

| Spike | 状态 | 目标 |
| --- | --- | --- |
| [CR1 Client Runtime](CR1-client-runtime.md) | Draft matrix | Electron、Capacitor、SwiftUI、Compose 的 Contract/codegen/artifact/capability 验证 |
| [DS1 Design System](DS1-design-system.md) | Draft matrix | React Desktop/Mobile、Apple、Android 的 Token/Recipe/Renderer 验证 |

## 发布完整性轨道

| Spike | 状态 | 目标 |
| --- | --- | --- |
| [SC1 Release Integrity](SC1-release-integrity.md) | Draft matrix | source approval、依赖审查、provenance/签名、撤销与离线策略 |

## 数据与原生可行性轨道

| Spike | 状态 | 目标 |
| --- | --- | --- |
| [N1 Native Storage/Sync](N1-native-storage-sync.md) | Draft matrix | 在至少一个 SwiftUI/Compose probe 验证 Editor/storage/sync transcript 与跨语言实现路线 |
| [E1 Editor Boundary](E1-editor-boundary.md) | Draft matrix | 用真实 adapter 与第二用例验证 transaction、extension、blob/index 和升级边界 |
| [Y1 Sync Protocol](Y1-sync-protocol.md) | Draft matrix | 用两个 data-domain codecs 验证 operation、ack/checkpoint、quarantine 与故障收敛 |

## 状态更新规则

- 只有实验文档中记录的命令、环境、fixture 和结果可以推进状态；
- “代码已经写好”不构成 pass；
- 目标环境缺失时不能从 provisional 推进为 pass；
- 失败时保留证据，并记录采用了 RFC-0013 中哪条替代路线；
- 本页只汇总，不取代各 spike 的原始证据。
