# 验证策略与证据

## 1. 目标

Blankspace 的测试不是只证明函数返回正确结果，还要证明不同工具、目标、版本和绝对路径不会形成不同产品。验证围绕四个不变量：

1. 相同逻辑输入产生相同 Graph 与 Registry；
2. 非法依赖和 secret 流向在执行产品代码前失败；
3. Runtime 部分失败后没有泄漏或不确定状态；
4. 框架升级对 Product Overlay 的影响可预检、验证和恢复。

## 2. 测试层次

| 层次 | 证明内容 | 典型范围 |
| --- | --- | --- |
| Schema corpus | 边界格式接受与拒绝一致 | 单个 schema、diagnostic path |
| Unit | 纯算法和状态转换 | canonicalization、排序、版本匹配 |
| Compiler fixture | 一个产品能否生成预期 Graph/diagnostics | 合法与非法最小产品 |
| Runtime conformance | host/Kit 是否遵守同一生命周期 | register/start/stop、故障注入 |
| Adapter conformance | 实现是否满足 Contract 与 capability | Database、Workspace、Server adapter |
| Integration | 多个真实组件是否协作 | Compiler → Registry → Runtime |
| Bundle trace | 实际产物是否符合目标闭包 | JS、CSS、worker、WASM、asset |
| Product journey | 开发者黄金路径是否成立 | 创建、修改、检查、构建 |
| Upgrade fixture | 旧 Overlay 是否兼容和可恢复 | check/plan/apply/verify/restore |
| UI visual/a11y | Shell 和贡献的语义与视觉稳定性 | 标准页面状态、键盘、截图 |
| Client Runtime conformance | Runtime、renderer、codegen 与 capability 一致 | React Desktop/Mobile、SwiftUI、Compose |
| Release engineering | 构建图、权限、artifact identity、渠道状态与撤销成立 | OCI、Desktop、iOS、Android、promotion |

Unit 测试不能代替 fixture；类型检查也不能代替 runtime export、bundle 或 schema 验证。

## 3. Fixture 设计

每个 fixture 只证明一个主要事实，并包含可读的预期结果。失败 fixture 必须断言稳定错误码、来源位置和关键路径，不能只断言“抛出异常”。

```text
fixtures/
├── compiler/
│   ├── valid/
│   └── invalid/
├── runtime/
├── adapters/
├── products/
├── upgrades/
└── ui/
```

跨平台 fixture 的期望结果不得包含 checkout 绝对路径、pnpm store realpath、时间戳、随机端口或操作系统分隔符。确实依赖平台的差异应以显式 target/platform 字段表达。

## 4. 必测失败类别

- 配置语法、重复 key、未知字段与非法路径；
- 缺失、重复或多候选 Service provider；
- version、capability 或 target 不匹配；
- 硬依赖循环与不稳定排序；
- public/internal、Module、symlink 和 dynamic import 越界；
- server SecretRef 到达 Web/shared；
- Graph/Registry assemblyId 不匹配；
- register 声明漂移、部分启动、重复 stop 与关闭超时；
- migration 重复 ID、内容变化、并发 runner 与事务失败；
- bundle 包含未启用 Kit 或错误 target 实现；
- 升级输入变化、空间不足、中断、verify 失败与 restore 失败。

失败测试是公共行为的一部分。错误码变更需要兼容性评估，因为人类、CI 和 AI 都可能依赖它。

## 5. 确定性矩阵

涉及 Graph、lock、registry 或生成文件的测试至少比较：

- 两个不同 checkout 绝对路径；
- 冷运行与热运行；
- 输入枚举顺序变化；
- 支持的操作系统路径形式；
- 锁定范围内的 Node/pnpm 环境；
- S2 要求的不同 pnpm store/linker 配置。

比较对象是 canonical bytes 和结构化记录。不要通过删除不稳定字段后再比较来掩盖生产输出不确定性；时间、随机数或 realpath 本就不应进入内容。

## 6. 目标与边界矩阵

Phase 1 对 `shared`、`web`、`server` 分别验证：

| Import 来源 | shared | web | server |
| --- | --- | --- | --- |
| 纯 Contract/逻辑 | 允许 | 允许 | 允许 |
| Web UI/runtime | 禁止 | 允许 | 默认禁止 |
| Server implementation | 禁止 | 禁止 | 允许 |
| Node built-in | 禁止 | 禁止 | 允许 |
| server SecretRef | 禁止 | 禁止 | 仅 server entry 可用 |

“Bundler 最终 tree-shake 掉了”不能让非法源码边合法。Compiler 先检查源码边，S3 再检查最终 bundle trace。

## 7. 生命周期故障注入

Runtime conformance fixture 至少覆盖：

```text
register 零业务实例化
→ Draft 全量校验
→ 按稳定拓扑逐个执行 factory → start
→ ready
→ entries 反序 stop
```

在每个边界注入失败，断言哪些对象已创建、哪些 stop 被调用、diagnostic 如何记录以及进程最终状态。`stop` 必须幂等；第三个 entry 启动失败时，前两个已经启动的 entry 按反序清理，未启动对象不得收到 stop。

失败入口必须在 `start` 拒绝前回收自己的部分资源；factory 不得获取需要关闭的资源。fixture 同时断言资源余额为零和停止顺序，不能只检查 `stop` 调用次数。具体矩阵见 [S5 生命周期实验](spikes/S5-lifecycle.md)。

Event fixture 还要验证 register/start 阶段拒绝 publish、ready 后按 handler ID 串行 dispatch、stopping 后拒绝新 publish、已开始 dispatch 在 deadline 内排空，以及嵌套发布的深度限制。handler 失败不改变原业务 Service 的成功结果，但必须进入 diagnostics。

## 8. 数据与 migration

Database/Kit migration fixture 使用真实 PostgreSQL 行为验证，而不是只 mock SQL 字符串：

- 每个 Kit 拥有独立 namespace；
- migration 按显式依赖稳定排序；
- advisory lock 防止并发 runner；
- 已执行 migration 内容 hash 变化时失败；
- 声明事务的 migration 原子提交；
- checkpointed migration 在每个检查点失败后幂等重入，并保留准确处理范围；
- 缺失 recovery owner、runbook、兼容应用版本或备份证据时计划被阻止；
- 移除 Kit 不自动删除数据或历史。

生产 migration 永远不属于普通单元测试或自动升级 apply 的隐式副作用。

## 9. UI 与视觉

S8 和 Phase 1C 固定字体、locale、timezone、viewport、动画与标准数据状态。每个 Shell fixture 至少测试：

- loading、empty、error、permission denied 和 ready；
- 键盘导航、焦点恢复、overlay 与快捷键冲突；
- route/navigation/command contributions 的稳定排序；
- 默认 Shell 与布局明显不同的 Product Shell；
- Public Override 被兼容报告识别。

截图差异需要人工或明确阈值判断，不能通过批量更新基准图让失败消失。

## 10. 受影响测试

`test --affected` 从 Product Graph 的硬依赖、公开 import、Event consumer 和 migration 关系计算。Contract 变化先加入直接消费者，再反向传播到传递消费者。无法静态确认的 dynamic import 将范围扩大到整个 target。

受影响分析只用于缩短本地反馈；发布门禁仍运行完整 conformance、reference products、upgrade 与跨目标验证。

## 11. 多客户端与 Design System fixtures

每个第一方 Client Runtime 使用自己的真实工具链验证，不能用 React 测试代替 SwiftUI/Compose，也不能用 Web bundle 证明 Electron/Capacitor host 安全。共同 corpus 至少覆盖：

- 同一 Domain/API/Error schema 生成 TypeScript、Swift、Kotlin 等价模型和请求；
- 同一 Screen Contract 的 loading、empty、ready、offline、permission denied、error 与语义事件；
- Web/Electron 显式共享 React Desktop renderer，Capacitor 使用 React Mobile renderer；
- mandatory renderer/capability 缺失、fallback、client 排除和支持等级；
- 未启用 Runtime 的源码、SDK、secret 和 platform adapter 不进入 artifact；
- Design Token 来源、循环/缺失、平台 overlay、capability fallback 和 accessibility 设置；
- 各 Renderer 自身的视觉基线与交互；跨 Renderer 只比较品牌语义、状态覆盖和动作可达性。

Electron 还验证 context isolation、sandbox、IPC sender/input；Capacitor 验证 plugin allowlist 与 WebView/native bridge；SwiftUI/Compose 验证生命周期、导航、后台恢复和系统 accessibility。概念 Contract 见 RFC-0015/0016，机器协议和规范化 transcript 见 RFC-0017。

## 12. 运行安全 fixtures

生产候选还要在与目标部署等价的身份和外部服务策略下验证：

- 审计事件覆盖登录、session、权限与管理员操作、secret 管理和 migration，禁止记录的 credential/session/Authorization 字段不存在；
- 未授权角色不能查询或导出审计数据，允许角色能在目标时间内按 correlationId、actor 和 target 完成取证查询，完整性控制能检测篡改；
- 日志 sink 中断超过有界缓冲时，安全敏感操作失败关闭，普通流量的告警与降级符合部署冻结策略；
- 每个生产 workload 只能读取自身环境声明的 SecretRef，跨环境或跨 workload 读取失败并留审计；
- secret 缺失、撤销或版本不允许时 readiness 失败；新旧版本切换、旧值撤销和泄漏轮换 runbook 的演练验证所有依赖恢复。

策略数值由产品按数据分类和部署环境冻结；fixture 必须记录策略版本与证据，不能以框架默认值代替。

## 13. 证据记录

多产物发布还必须验证 merge result、untrusted PR、签名隔离、并发 promotion、外部 API 幂等、artifact retention 与 release lifecycle；完整矩阵见[多产物 CI/CD](ci-cd.md)。

每次 spike、里程碑或 release gate 记录：

```text
commit / source snapshot
RFC baseline hash
tool and runtime versions
OS and relevant external services
commands
passed / failed / skipped counts
artifact or fixture paths
known limitations
```

没有运行的检查写作 `not run`，环境不满足写作 `blocked` 或 `provisional`。禁止把“代码已编写”记作“行为已验证”。

## 14. Phase 1 门禁

- S1～S7：进入 Phase 1B 前全部正式通过；
- Phase 1A：Graph/Registry/Runtime 在最小 Web 与 Server fixtures 中闭环；
- Phase 1B：Reference SaaS 黄金路径、AI context、adapter 替换，以及 RFC-0014 的 10 项 Identity/session/tenant/security fixtures 全部通过；这些检查统一由未来的 `blankspace verify phase-1b` 汇总，不能在安全 fixtures 失败时标记阶段完成；
- S8：进入 Phase 1C 前通过；
- Phase 1C：旧 Overlay、UI、bundle、升级中断与 restore fixtures 通过。

聚合命令最终应输出版本化 JSON，但当前尚未实现。实际进度以 [Phase 1 蓝图](phase-1-blueprint.md) 与 [风险实验索引](spikes/README.md) 为准。
