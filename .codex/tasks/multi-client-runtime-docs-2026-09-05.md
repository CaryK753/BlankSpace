# 多客户端 Runtime 文档

日期：2026-09-05

## 目标

将 Web/Desktop 共享、Hybrid Mobile、SwiftUI、Jetpack Compose、跨端 Screen Contract 和 Design Token 平台解析正式纳入 Blankspace 架构，同时保持 Phase 1 边界不被未来多端工作阻塞。

## TODO

- [x] 定义 Client Target、UI Family、Client Runtime Kit 和支持等级
- [x] 定义 Web/Electron、Capacitor、SwiftUI、Compose 官方路线
- [x] 定义 Screen、Route、API Client、Capability 的跨端契约
- [x] 定义跨平台 Design Token、Recipe 和平台 Renderer
- [x] 同步 Product Module、Kit、Graph、升级、测试和路线图
- [x] 更新 RFC 索引与 SHA-256 基线
- [x] 运行文档、schema 和 JSONC 检查
- [x] 执行无上下文读者测试并修正中高问题（首次任务受账户 usage limit 终止；重试后产品、Kit 作者和机器契约三类读者均完成。已修正能力排除绕过、Phase 1 Screen 边界、Graph V2 选择、身份版本、artifact selector、coverage key、信任语义、主题目录碰撞和 request transcript；尚未冻结的 schema 被显式列为 RFC-0017 硬门禁，不再冒充可实现契约）

## 完成标准

- 开发者可以明确选择 Hybrid 或 Native Mobile，且一个客户端只绑定一个主 UI Runtime；
- 文档不暗示 React 页面能直接成为 SwiftUI/Compose 页面；
- Phase 1 仍只交付 web/server，未来 Runtime 不被写成当前能力；
- Graph 能解释每个客户端、renderer、capability、fallback 与支持证据。

## 本地审计修正

- 统一沿用 `remote-saas`，删除与其语义重叠的 `web-saas` 名称；
- 明确 `verified` 只证明 compatibility conformance，不代表安全可信；生产默认只允许 official，非 official 需要显式 allowlist 和独立审查；
- 增加 npm、SwiftPM、Maven 跨生态 distribution manifest、contract hash 与 lock 规则；
- 明确 `public.ts` 仅是 Phase 1 TypeScript 出口，Swift/Kotlin 使用生成 Contract module 与各自工具链公开边界；
- 补充 CR1 Client Runtime 与 DS1 Design System Draft matrices；
- 修正 S1 schema corpus 汇总从 11/11 到当前 14/14。
- 新增 RFC-0017，明确每 client ProductGraphV2、跨生态选择、Tool Protocol、UI/capability coverage、证据信任与原子升级边界；
- 最初新增 3 份 Proposed schema；后续冻结任务已扩展为 14 份，Runtime/UI/Graph/Theme/Upgrade 等结构仍需通过各自 corpus 与 spike 才能迁入正式 contracts；
- 修复生成路径按 client 隔离、协议路径逃逸约束、失败结果不得携带 outputs，以及第三方 evidence 不得自授 `verified`。
