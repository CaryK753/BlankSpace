# N1：原生 Storage/Sync 可行性

## 状态

Draft matrix，尚未执行；不属于 Phase 1 的 S1～S8 门禁。N1 必须在 Phase 4 Sync Protocol 正式实现前通过。

## 要回答的问题

RFC-0018/0019 的 document、transaction、operation、checkpoint 和 quarantine 语义，能否在 Web/Desktop 之外至少一个原生客户端稳定实现，而不依赖 JavaScript 运行时特性或泄漏平台数据库对象？

## 候选路线

1. Swift/Kotlin 各自实现相同 schemas 与 transcript；
2. 共享 Rust core，通过 Swift/Kotlin FFI，并为 Web 提供 WASM 或独立 TypeScript 实现；
3. 混合路线：平台数据库/密钥由原生层拥有，共享 core 只处理 canonical codec、operation 与 convergence。

N1 不预先选择 Rust。选择依据是事务语义、崩溃恢复、跨语言 canonical bytes、调试性、包体/内存和升级，而不是代码复用率。

## 矩阵

| 场景 | 必需结果 |
| --- | --- |
| IndexedDB、SQLite、一个原生数据库执行相同 transcript | operation/result/checkpoint 语义等价 |
| 本地写入与 outbox 之间注入崩溃 | 两者同时可见或同时不可见 |
| app background/kill 后恢复 | 无内存游标依赖，pending work 可继续 |
| canonical JSON/binary hash | TypeScript 与 Swift/Kotlin/Rust 输出逐字节一致 |
| Keychain/Keystore 锁定或权限撤销 | 明确 blocked，不退回明文 |
| 数据库 migration 中断 | 保持最后可信版本或进入 recovery |
| 大 batch 与低内存 | 按协商上限分块，不 OOM 或静默丢弃 |
| schema/protocol 不兼容 | read-only recovery 或明确拒绝 |

## 通过条件

至少一个 SwiftUI 或 Compose probe 与 Web/Desktop corpus 一致；方案记录 ABI、线程、内存所有权、错误映射、版本和 artifact 签名边界。若共享 core 增加的 FFI/调试风险超过语义收益，选择平台实现加共享 schema/transcript，不强求共享二进制。

## 尚待冻结

首个原生平台、数据库、语言/编译器、Rust/WASM 候选、设备/模拟器、corpus revision、性能阈值、命令和责任人。
