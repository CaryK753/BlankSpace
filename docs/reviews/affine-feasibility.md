# AFFiNE 级产品可行性独立审查

日期：2026-09-06。方法：一个不继承项目讨论背景的独立读者只阅读 Blankspace 仓库文档、RFC 与文档引用的 schemas；未读取实现、任务文件，也未联网。本页保存其结论并把建议映射为正式门禁，不把读者判断当作实现证据。

## 结论

| 问题 | 结论 | 置信度 |
| --- | --- | --- |
| 现在能否用 Blankspace 复刻 AFFiNE 级产品 | 不能；当前是架构设计与 Phase 1A spike，不是可用框架 | 很高，约 98% |
| 架构是否允许最终达到类似能力上限 | 理论可行；Foundation/Kits/Product Overlay/Client Runtime/Design System 的责任方向合理 | 中高，约 65% |
| 完成既有阶段是否自动证明可行 | 否；必须真实穿过 Editor、同步、跨端本地引擎和规模性能四个关口 | 高 |

“复刻”指能力上限接近，而非复制 AFFiNE 源码或像素：Workspace、块编辑器/白板、local-first、离线、同步协作、多 Server、Web/Desktop/Mobile、身份权限、升级与深度 UI 定制。

## 支持可行性的设计

- Foundation 只负责确定性装配、生命周期和边界，不吸收 Workspace/Editor/同步领域模型；
- 数据域分别选择 remote、local、replicated，提交点和权威语义不被万能 Store 掩盖；
- WorkspaceRef 和每 Server 独立 session/provider 能避免多 Server 身份与缓存串线；
- Product Overlay、公共 Contract、Graph、两份 lock 和 Compatibility Manifest 为上游更新隔离业务代码；
- Client Runtime 与 UI Family 分离，Web/Electron 可共享 React Desktop，而移动端可选 Capacitor、SwiftUI 或 Compose；
- Design System 共享语义 token/recipe，不要求不同平台共享组件树或像素。

这些是架构依据，不是交付声明。当前状态仍以[风险实验索引](../spikes/README.md)为准。

## 四个必须证明的关口

### Editor

Phase 2 的 Block 文档需要最小 transaction、schema extension、selection/undo、blob/index 和持久化边界。它可以先是 reference product 的 experimental adapter，但必须服从 [RFC-0018](../rfcs/0018-editor-engine-boundary.md)与 integration-first 的 [RFC-0020](../rfcs/0020-integration-first-kits.md)；Phase 5 才把 Tiptap 类富文本与 BlockSuite 类 Page/Edgeless 等不同用例共同验证的薄边界晋级为稳定 Editor Kit。Blankspace 不自研编辑器引擎。

### Sync

Local-first 不等于可靠同步。Phase 4 前必须冻结 operation、batch、ack/checkpoint、版本协商、删除、拒绝/quarantine 和附件引用的 wire schema；见 [RFC-0019](../rfcs/0019-sync-protocol-v1.md)。

### 跨端本地引擎

不能只在 TypeScript/Web 世界验证数据契约。Web IndexedDB、Desktop SQLite 和至少一个 SwiftUI 或 Compose probe 必须执行相同 storage/sync transcript；N1 spike 在 Phase 4 正式实现前决定纯平台实现、共享 Rust core 或混合路线。

### 规模性能

完成简化 Edgeless 画布前不能宣称 AFFiNE 级规模。性能证据至少覆盖大文档输入延迟、内存、局部加载、索引规模、同步吞吐和附件恢复；指标归属 RFC-0012，数值由真实 prototype 冻结。

## 最小关键路径

1. Phase 1A 证明 Graph/Registry/lifecycle/裁剪；
2. Phase 1B 证明 remote SaaS 的 Identity、Workspace、权限和租户隔离；
3. 按 RFC-0018/0020 集成 experimental Editor adapter，不实现编辑器引擎；
4. 在 IndexedDB 与 SQLite 跑通相同 Local Workspace + Block 文档；
5. 冻结 RFC-0019 schema 与 Y1 matrix，但暂不承诺正式 Sync 实现；
6. 用一个 SwiftUI 或 Compose probe 执行 N1 storage/sync transcript，决定平台实现、共享 core 或混合路线；
7. 按已验证路线实现 Sync Protocol V1，并跑通 Local → Cloud → 第二客户端及故障恢复；
8. 加入简化大画布并冻结规模预算；
9. 对上一 minor 的自定义 Shell、Editor adapter 和 replicated data 执行完整升级恢复；
10. 让无背景 AI 只根据生成上下文修改 Overlay，并通过相同门禁。

## 上游兼容与 AI

两者目前都是设计优势而非实证。只有上一版本 Overlay/Shell/Editor/replicated fixture 真正通过 `check → plan → apply → verify/restore`，才能宣称容易跟随上游；只有无背景 AI 在零部分写入、稳定 diagnostics 和 affected tests 约束下完成真实变更，才能宣称 AI 编程效率得到验证。
