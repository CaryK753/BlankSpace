# CR1：Client Runtime Contract 实验

状态：Draft matrix，尚未执行；不属于 Phase 1 的 S1～S8 门禁。

## 目标

验证 RFC-0015/0017 能否让 Electron React、Capacitor React Mobile、SwiftUI 与 Compose 使用同一组 Domain/API/Screen Contracts，同时保持各平台真实构建、依赖和安全边界。ProductGraphV2、Distribution、Runtime/Kit、Tool、coverage/capability、support 与 upgrade 的 Proposed schemas 已建立并通过结构校验；本实验负责用真实工具链证明语义互操作性，之后才能申请 Accepted。

## 固定输入

使用同一个最小 Documents 产品切片：登录后列出、创建、打开和归档一个资源，包含 loading、empty、ready、offline、permission denied 和 error。Contract corpus 固定 operation/route/screen IDs、输入输出、typed errors、capabilities 与 mandatory renderer。

## 候选矩阵

| 场景 | 必须证明 |
| --- | --- |
| Web + Electron | 显式共享 React Desktop renderer；Electron capability 不进入 Web |
| Capacitor iOS/Android | 使用 React Mobile renderer；plugin bridge 有 allowlist/schema |
| SwiftUI iOS | 生成 Swift contracts/client；原生导航与生命周期 |
| Compose Android | 生成 Kotlin contracts/client；原生导航与 lifecycle state |
| 混合产品 | iOS SwiftUI + Android Capacitor 可以共存 |
| artifact resolution | npm/SwiftPM/Maven 坐标与 contract hash 一致并进入 lock |
| coverage failure | 缺 renderer/capability/support evidence 时诊断唯一；非法排除存在反向依赖的能力会失败 |
| toolchain blocked | 缺 Xcode/Gradle 等只阻塞对应 client，不伪报全通过 |

## 共同断言

- TypeScript、Swift、Kotlin 对同一 API corpus 生成等价的规范化 request transcript 与错误类别；只对协议指定 canonical encoding 的字段比较 bytes；
- 各 renderer 消费相同 Screen state/event corpus，不共享组件树；
- 每个 client Graph 记录 platform、Runtime、UI Family、capability、coverage、artifact 和 evidence；
- 未启用 Runtime 的源码、SDK、plugin、native artifact 与 secret 不进入产物；
- Electron/Capacitor/Native 安全检查按 docs/security.md 执行；
- identical logical inputs 在相同 toolchain lock 下产生稳定 Graph 与生成摘要。

## 端到端 corpus

每条成功流程必须按相同顺序产出并互相校验：

1. `ProductClientsV2` 选择 Runtime 并声明根 capabilities；
2. Runtime 与各业务 Kit manifests 分别解析自己的 Distribution Manifest；
3. resolver 按 requirement 的 role、ecosystem、platform、Runtime 与 UI Family 选择唯一 artifacts；
4. generator 通过 Tool Protocol 生成语言模块和 Request Transcript；
5. Compiler 展开 feature contracts，验证 renderer、Shell、capability provider/probe 与 fallback；
6. Theme Compiler 生成 Theme IR，Theme Renderer 生成 client-scoped Theme Result；
7. conformance suite 生成 Support Evidence，release gate 结合 trust/revocation snapshots 生成 SupportEvaluationRecord；
8. Compiler 生成 client ProductGraphV2 与产品 Assembly Index；
9. Lock V2 同时锁定 Runtime、全部 Kits、distribution manifests、artifacts、生成物和 evidence；
10. Upgrade Planner 在 staging root 生成 Compatibility/Upgrade Plan，所有 client receipts 通过后原子提交。

每个阶段至少有一个定向失败 fixture：零/多 artifact、contract hash 漂移、缺 primary renderer、fallback 环、probe 缺失、Theme 越权覆盖、evidence 过期/撤销、Graph hash 漂移、lock 漏掉 Kit distribution、upgrade receipt 缺失。失败必须在执行下一个外部工具前终止，并产生稳定 diagnostic code。

端到端 fixture 使用同一组不可变 hashes，不允许各阶段重新发明 identity。Node-only 模拟只能验证协议连线；`swift build`/Xcode 与 Gradle 构建输出才是 Native Runtime 的最终 evidence。

## 成功条件

四种第一方路线通过各自 toolchain 的 contract、构建、最小交互、安全和 artifact trace；混合产品无需修改 Foundation；所有失败类别产生稳定 client-scoped diagnostic。

## 失败后的选择

- codegen 无法保持 wire 等价：收窄公共 schema 方言；
- UI Contract 泄漏 React/SwiftUI/Compose 类型：进一步收窄 Screen Contract；
- 跨生态 logical version 无法可靠绑定：renderer 使用独立版本并显式声明 contract range；
- 某 Runtime 安全边界无法验证：保持 experimental/unavailable，不降低 official 门槛。

## 尚待冻结

具体 Electron/Capacitor/Xcode/Swift/Gradle/JDK/Android plugin 版本、可执行 fixture 仓库、设备/模拟器矩阵、性能阈值和签名测试环境。未取得这些真实 evidence 前，本 spike 保持 Draft，Proposed schemas 不迁入正式 contracts。
