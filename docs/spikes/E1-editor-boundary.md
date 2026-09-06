# E1：Editor Engine Boundary

## 状态

Draft matrix，尚未执行；Phase 2 Block 文档实现前必须冻结并通过。

## 依据与范围

依据 RFC-0018/0020，E1a 先用 in-memory/fault-injection harness 与一个真实 Tiptap 类结构化文档 adapter 冻结边界；E1b 在 Phase 2 的真实 Local Provider 上重跑事务、离线重启和恢复。BlockSuite 类 Page/Edgeless adapter（或等价的明显不同引擎）是 Phase 5 晋级稳定 Kit 的第二用例，不阻止 Phase 2。

## 冻结输入

- engine/adapter、storage 与 schema 工具精确版本；
- 两个用例的 extension/command manifests；
- fixture 路径、canonical hashes、故障注入点与命令；
- document/blob/outbox 原子性检查器；
- 上一 minor format/adapter fixture；
- 输入延迟、snapshot size 和内存的实验阈值。

## 通过条件

E1a 在 Phase 2 开工前通过 harness 场景；E1b 在 Phase 2 退出前通过真实 Local Provider 场景。产品不导入 adapter internal，但可以使用上游 public API；失败不留下部分 document/ref/outbox；adapter 没有镜像上游 commands/extensions。Phase 5 第二用例不需要建立平行生命周期或持久化 API。

## 失败选择

若真实 adapter 被边界迫使复制核心引擎 API，缩小公共 boundary；若事务无法覆盖 blob bytes，仍必须原子提交 blob ref/outbox，并由 Files Kit 提供可恢复上传；若第二用例完全不同，保持 experimental adapters，不晋级稳定 Editor Kit。
