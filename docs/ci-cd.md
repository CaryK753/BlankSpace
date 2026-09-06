# 多产物 CI/CD 与客户端发布

## 1. 状态与目标

本文定义 Blankspace 的目标流水线，当前不是已上线能力。仓库尚无可发布的 Server、Electron 或移动 Runtime，因此现在创建真实 publish workflow 只会产生无法验证的自动化。第一步是冻结构建图、产物身份、信任边界和验收 fixture；Runtime 可构建后再由生成器输出具体 CI。

Blankspace 的发布单位不是一个模糊的“应用包”，而是一组来自同一 source revision 和 Product Graph 的不可变产物：

| target | 典型产物 | 构建环境 | 分发方式 |
| --- | --- | --- | --- |
| `web` | 静态 bundle、asset manifest | Linux | CDN/对象存储或 OCI image |
| `server` | Node server dist、migration bundle | Linux | OCI image |
| `electron` | macOS DMG/ZIP、Windows installer、Linux packages | 对应原生 OS | updater/GitHub Release/企业分发 |
| `capacitor-ios` | archive/IPA | macOS | TestFlight/App Store |
| `capacitor-android` | AAB、测试 APK | Linux | Play Console/企业分发 |
| `swiftui-ios` | archive/IPA | macOS | TestFlight/App Store |
| `compose-android` | AAB、测试 APK | Linux | Play Console/企业分发 |

产品只构建 Product Graph 选择的 targets。未选择的客户端、Kit renderer 和原生依赖不能因为统一 workflow 而进入产物。

## 2. 从 AFFiNE 吸收的结构

AFFiNE 的镜像 workflow 将 Web、Mobile、Admin、Server Native 和 Server 拆成独立 job，通过上传/下载 artifact 汇合，并对 Server image 做多架构构建。其桌面构建也明确区分 Web core、Rust native module 与 Electron packaging 的依赖顺序。

Blankspace 采用以下思想：

- 大产物拆分构建，失败边界和缓存边界清晰；
- 原生模块使用 platform/architecture matrix；
- 下游 packaging 消费已验证 artifact，不重复编译上游；
- reusable workflow 接收显式版本、channel、revision 和 target plan。

但不复制仓库专用 secret、产品模块或 action 版本。Blankspace 额外要求 action 固定 commit SHA、promotion 不重建、发布签名 job 与不可信 PR 隔离，以及每个产物单独保存 SBOM、provenance 和兼容清单。

## 3. 流水线 DAG

```text
source revision + lockfiles + Product Graph
                  │
                  ▼
        plan / policy / change impact
                  │
          ┌───────┴────────┐
          ▼                ▼
 quality + security     shared codegen
          └───────┬────────┘
                  ▼
  ┌───────────────┼──────────────────────┐
  ▼               ▼                      ▼
web/server    native matrices      mobile shared bundle
  │               │                      │
  ▼               ▼                      ▼
OCI images    Electron packages    iOS/Android packages
  └───────────────┬──────────────────────┘
                  ▼
 digest / SBOM / provenance / compatibility
                  ▼
       isolated signing + notarization
                  ▼
       immutable ReleaseCandidate
                  ▼
 candidate publish → staging verify → channel promotion
```

`plan` 从装配索引生成 target matrix、runner、依赖和所需 evidence。矩阵是构建事实来源；workflow 中不得维护一份可能漂移的客户端清单。

## 4. 触发器与权限

| 事件 | 允许动作 | 禁止动作 |
| --- | --- | --- |
| fork/普通 PR | lint、typecheck、unit、fixture、无凭据 package smoke | registry push、签名、公证、商店上传、生产 secret |
| protected branch | 完整构建与测试、生成候选 evidence | 自动 stable/production promotion |
| signed tag/release request | 构建不可变 candidate、隔离签名、发布候选 | 绕过门禁或从浮动分支取源码 |
| approved promotion | 晋级已有 digest、部署/商店 staged rollout | 重新 checkout、重新 build、改写 artifact |

默认 `permissions: read-all`；每个发布 job 单独声明最小权限。Registry、云平台和支持 OIDC 的服务使用短期身份。Apple/Windows/Android 等不可避免的签名材料只进入受保护 environment 的专用 job，不能传入通用 build job 或写入 artifact/log。

所有第三方 Actions 固定完整 commit SHA，容器和构建镜像固定 digest。缓存只优化速度，不是产物输入或完整性证据；恢复后仍校验 lockfile、toolchain、target 和内容 hash。

## 5. Build once，promote many

同一个 `ReleaseCandidate` 的 source revision、Product Graph hash、lock hash 和各 artifact digest 在 candidate、staging、beta、stable 之间保持不变。Promotion 只更新 channel pointer、deployment desired state 或商店 rollout metadata。

以下行为必须失败：

- promotion job 包含 checkout、compile、package 或 Docker build；
- image 只记录 tag 而没有 digest；
- 不同环境注入会改变前端静态 bundle 的构建期 secret；
- 签名后覆盖原文件却不记录签名前后 digest；
- 同一 logical version 对应两个不同 source revision。

环境差异使用运行时配置、受版本管理的 deployment config 或服务端 discovery。确实必须在构建期固定的公共值进入输入 hash，并产生不同 artifact identity。

## 6. Docker 与 Server/Web

Server image 使用多阶段 Dockerfile、非 root 用户、最小 runtime base、只复制 production dependencies 和已构建 dist。建议初始官方矩阵为 `linux/amd64` 与 `linux/arm64`；增加 `arm/v7` 必须由真实部署需求和依赖支持证明，不能仅因参考项目支持就默认承诺。

流水线分别生成 architecture manifest，再合并 OCI index；每个平台 digest 和 index digest 都进入 evidence。Server、Web 可为独立 image，也可由 deployment profile 把静态 Web bundle 交给 CDN。数据库 migration 是独立、可检查的 bundle/job，不能隐藏在每个实例启动时竞态执行。

最低验证包括：container structure、非 root、只读根文件系统兼容性、健康端点、启动/关闭、migration plan、漏洞策略、license、SBOM、签名和最小部署 smoke。

## 7. Electron Desktop

Electron 包装层消费同一已验证 Web bundle、desktop bridge manifest 和对应 architecture 的原生模块。matrix 至少区分：

- macOS arm64/x64：codesign、entitlements、hardened runtime、notarization、stapling；
- Windows x64（需求成立后增加 arm64）：Authenticode、installer/update metadata；
- Linux x64（需求成立后增加 arm64）：AppImage/deb/rpm 等明确支持集合。

Build、package、sign、publish 是四个阶段。无密钥 PR 仍应完成 unsigned package smoke；正式签名只消费 hash 已冻结的 unsigned artifact。Evidence 同时记录 unsigned content digest、signed distribution digest、证书/公证结果和 updater manifest digest。

自动更新 metadata 必须签名并绑定 channel、platform、architecture、version、minimum compatible server 和下载 digest。已经安装的桌面客户端无法像容器一样瞬间回滚，因此发布控制以暂停 rollout、撤销 metadata、恢复 last-known-good 下载和 forward fix 为主。

## 8. Mobile

Capacitor 与原生 SwiftUI/Compose 共用 API/domain schema、版本兼容和 ReleaseCandidate 语义，但不共用假想的统一二进制流水线。

### iOS

在固定 Xcode/macOS runner 上解析依赖、测试、archive、export，再由受保护 job 使用 provisioning/certificate 或受控的 App Store Connect 集成上传。记录 bundle ID、marketing version、build number、entitlements、privacy manifest、minimum OS、archive/export digest 和 TestFlight/App Store submission ID。

### Android

在固定 JDK/Gradle/Android SDK 环境构建测试 APK 与 release AAB；验证 manifest、permissions、SDK levels、mapping/native symbols。签名 job 与普通 build 隔离，并记录 application ID、version name/code、keystore identity、AAB digest 和 Play release ID。优先让 Play App Signing 保管最终分发密钥，CI 只持有受限 upload key。

商店审核不是 CI 成功的同义词。ReleaseCandidate 状态需要区分 `built`、`signed`、`submitted`、`approved`、`rolling-out`、`available` 和 `halted`。iOS/Android promotion 操作商店 channel/phased rollout，不重新生成 IPA/AAB。

## 9. 版本与兼容性

一次 logical release 可以包含多个平台 build number，但必须共享 release ID 和 source revision：

```text
logicalVersion: 1.4.0
sourceRevision: <immutable commit>
web/server: 1.4.0
desktop: 1.4.0
ios: marketing 1.4.0, build 140023
android: versionName 1.4.0, versionCode 140023
```

Compatibility manifest 声明 API/protocol/schema、最低/最高兼容服务端、最低客户端、安全截止日期和 migration rollback 范围。服务端 rollout 必须先证明仍兼容已发布且无法强制即时更新的客户端。

## 10. Evidence 与验收

每个 artifact 必须关联：输入 hash、source revision、builder identity、目标平台、文件清单、digest、SBOM、provenance、测试报告、兼容清单；可分发 artifact 还需要签名/公证/商店 evidence。ReleaseCandidate 汇总各 artifact，但不能用一个总报告掩盖单个平台失败。

机器提案位于 [`schemas/proposed/release`](schemas/proposed/release/README.md)。`ReleasePlan` 描述将要执行的构建图，`ReleaseCandidate` 是构建完成后的不可变发布输入，`ReleaseLifecycle` 记录各平台后续状态；三者不得互相代替。当前验证以下语义：

- job/artifact ID 唯一且依赖无环；
- artifact producer 存在，target 与 runner 相容；
- promotion job 不执行 rebuild；
- untrusted job 不可使用 secrets 或发布/sign action；
- 可分发产物声明所需 evidence；
- 所有产物绑定相同 source revision 与 input hash。
- candidate 保存 artifact URI/digest、unsigned/distributed identity、builder/toolchain 和可寻址 evidence；
- lifecycle history 连续、时间单调、终态不可继续且最终状态与 target 对账。

## 11. 失败、撤销与恢复

任一 mandatory target 失败会阻止整个 requested release；optional target 可以被显式排除，但 ReleaseCandidate 必须记录 exclusion 和产品能力影响。签名或 provenance 不通过不得降级成 unsigned stable 包。

容器可在数据兼容时回到旧 digest。Web 可停止新流量并恢复旧 assets。Desktop/mobile 已安装版本不能被“远程删除”：应停止 channel/store rollout、撤销下载 metadata、标记 denylist、服务端维持协议重叠，并发布修复版本。泄露签名凭据时进入独立事故流程，轮换/撤销密钥并重新评估已发布 artifact。

## 12. CI 拓扑与复用边界

未来 GitHub Actions 只做平台编排，业务逻辑放在可本地执行、带版本的仓库脚本或 CLI 中。建议结构：

```text
.github/workflows/
├── pr.yml                    # 快速反馈与无凭据 smoke
├── merge-queue.yml           # 合并结果全量验证
├── release-candidate.yml     # 受保护入口
├── promote.yml               # 只晋级既有 candidate
└── reusable/
    ├── quality.yml
    ├── build-oci.yml
    ├── build-desktop.yml
    ├── build-ios.yml
    └── build-android.yml
tools/release/
├── plan                      # 生成 target/job/evidence plan
├── build                     # 本地与 CI 共用
├── verify
├── attest
└── promote
```

Reusable workflow 固定“怎么执行某类 target”，release plan 决定“这次执行哪些 target”。禁止让 workflow expression 成为唯一业务规则，因为它难以本地复现、单元测试和迁移到其他 CI。

## 13. 变更影响与合并策略

Path filter 只能用于快速 PR 反馈，不是发布正确性的依据。`plan` 根据 Product Graph、package dependencies、生成物输入、Docker context、native modules 和发布配置计算影响：

| 变化 | 最小快速反馈 | 合并/发布反馈 |
| --- | --- | --- |
| Markdown | docs/schema/link checks | 同左，除非文档含可执行示例 |
| shared contract/schema | codegen、所有直接消费者 | 全 target conformance 与兼容测试 |
| Web renderer | Web unit/bundle/UI | Web、Electron、Capacitor 受影响矩阵 |
| Server/API/migration | Server integration | OCI、migration、旧客户端兼容 |
| Rust/native bridge | 对应 ABI/unit | 所有声明 architecture 的原生 package |
| CI/release/security config | workflow lint/policy | 全量 supply-chain dry run |

Protected branch 使用 merge queue 或等价机制验证“实际将被合并的 commit”，避免 PR head 通过后目标分支变化。Required checks 使用稳定逻辑名称；matrix job 通过聚合 gate 汇总，不能因 target 名变化意外解除 branch protection。

## 14. 测试金字塔与发布门禁

不同事件使用不同预算，但 release candidate 不使用 `test --affected` 代替全量验证：

| 层级 | PR | merge queue | candidate | promotion |
| --- | --- | --- | --- | --- |
| format/lint/type/schema/unit | 必须 | 必须 | 复用可信结果或重跑 | 校验证据 |
| compiler/runtime/adapter conformance | affected | 全量 | 全量 | 校验证据 |
| integration + real database | affected | 全量关键路径 | 全量 | staging synthetic |
| UI visual/a11y | affected | 基线矩阵 | 支持 target 全量 | 校验报告 |
| native package smoke | 无签名 | 支持 target | 正式 package | 安装/启动 synthetic |
| E2E | 核心 journey | 全量 reference products | production-like | 部署后 smoke |
| security/license/vulnerability | 快速策略 | 全量 | 阈值 + exception expiry | freshness check |
| performance | 变化检测 | 定期/关键路径 | release budget | rollout SLI |

Flaky test 不能通过无限 retry 变绿。允许的重试次数、原始尝试结果、flake owner 和隔离期限进入 evidence；被 quarantine 的 required journey 仍阻断 stable release。测试失败 artifact 即使 job 失败也要上传，但必须先完成敏感信息清理。

## 15. Preview、Staging 与 Production

Preview 按 PR 创建隔离 namespace、域名、数据库/schema、对象前缀和短期 secret；禁止复制生产个人数据。关闭 PR 或达到 TTL 后由带 allowlist 的回收任务清理，并对泄漏资源告警。Preview 失败不能影响共享 staging。

Staging 消费与 production 相同 artifact digest，运行 migration rehearsal、synthetic journeys、外部 provider sandbox 和 rollback rehearsal。Production 使用 environment approval、维护窗口、change record 与职责分离。审批绑定 candidate ID、digest 和 plan hash；输入变化会使旧审批失效。

环境 promotion 是状态变化而非文件复制。每次变化记录 actor、时间、来源/目标 channel、旧/新 pointer、policy result 和 correlation ID。

## 16. Release Train、版本与变更记录

Blankspace 区分三种版本：Framework/Kits 版本、Product logical version、平台 build number。它们可以不同，但 ReleaseCandidate 保存精确映射。发布策略支持：

- `nightly`：自动候选，短保留，不形成兼容承诺；
- `canary`：面向内部/测试者，可高频；
- `beta`：功能冻结后的外部验证；
- `stable`：满足支持、迁移、文档与回滚门禁；
- `hotfix`：从明确 stable revision 派生，仍走完整签名和证据链。

版本计算必须是确定性步骤，并在任何构建前完成。并发任务不得各自计算版本。移动 build number 单调递增且不可复用；失败/撤销不会回收号码。

Changelog 从经审查的 change metadata 生成，至少标记 feature、fix、security、breaking、migration、deprecation 与各 target 影响。自动生成文字需要 maintainer 审核，不能从任意 PR body 直接写入商店或生产公告。

## 17. 并发、取消与幂等

CI concurrency key 至少包含 workflow purpose、product、branch/channel；新 PR run 可以取消旧 run，但已经开始签名、商店提交或生产 rollout 的任务不能被普通新提交抢占。发布控制使用 candidate 级 lease：

- 同一 candidate/action 重放返回已有 receipt；
- 同一 channel 同时只有一个 active promotion；
- stale run 在写 registry/store/deployment 前重新验证 lease 与 desired state；
- 部分发布保存 checkpoint，重试从已验证阶段继续；
- 人工 rerun 不改变 source、版本或 input hash。

外部操作使用 idempotency key（candidate + target + channel + action）。无法幂等的商店/签名 API 在调用前后保存 request/receipt，并提供 reconciliation，而不是盲目重试。

## 18. Runner 与 Toolchain 治理

Hosted runner 标签（如 `*-latest`）不是可复现工具链声明。Release plan 记录 runner image identity 和以下锁定输入：Node/pnpm、Rust toolchain/targets、Docker Buildx/QEMU、Xcode/Swift、JDK/Gradle/Android SDK/NDK、Electron/packager 和系统 signing tools。

自托管 runner 按 job 一次性或执行后销毁；禁止在同一持久机器上混跑不可信 PR 与签名 job。网络 egress、workspace、Docker daemon、keychain/keystore 和 artifact cache 分区。Runner image 通过独立流程更新，先在 canary corpus 验证，再成为 release baseline。

工具链升级由显式 PR 完成并运行对应全矩阵；不能在发布时静默获取新版 SDK。Apple/Google 强制期限作为带 owner 的 maintenance event 提前跟踪。

## 19. Artifact、Evidence 与保留策略

CI 临时 artifact、发布 artifact 和审计 evidence 是三种不同生命周期：

| 类别 | 内容 | 保留原则 |
| --- | --- | --- |
| CI 临时 | 测试报告、unsigned intermediates | 短期、失败调试后过期 |
| 发布产物 | OCI、installer、IPA/AAB、update metadata | 按支持/回滚窗口保留，不随 workflow artifact 过期 |
| 发布证据 | digest、SBOM、provenance、审批、receipt、测试摘要 | 至少覆盖产品支持和安全响应周期 |

Retention 是产品/法规策略值，不在框架写死天数。删除发布产物前检查 active deployment、客户端 update channel、last-known-good、legal hold 和安全调查引用。Evidence store 应 append-only 或具备等价防篡改能力；CI 控制台不是唯一审计库。

Source maps、dSYM、ProGuard/R8 mapping、native symbols 属于受保护调试 artifact：上传错误监控服务时固定 release ID，访问和删除受审计，不能公开附在 release 页面。

## 20. Secret、签名与职责分离

Credential inventory 至少记录 owner、用途、环境、consumer job、权限、有效期、轮换、撤销和审计入口。发布平台令牌不得复用应用生产 secret。

关键角色分离：代码作者不能单独批准自己的 stable release；签名 job 不能修改源码；promotion controller 不能生成新 artifact；部署身份不能导出签名私钥。紧急 break-glass 有时限、双人或等价审批、即时告警和事后复核。

密钥轮换演练覆盖双签/信任过渡、旧 updater/旧客户端、商店账户恢复和泄露撤销。仅证明“新包能签名”不足以关闭密钥治理门禁。

## 21. 发布状态机

统一状态不假设所有平台同步到达：

```text
planned → building → verified → signed → candidate
                                      │
                  ┌───────────────────┼──────────────────┐
                  ▼                   ▼                  ▼
               staged             submitted          available
                  │                   │                  │
                  ▼                   ▼                  ▼
             rolling-out          approved          halted
                  │                   │
                  └──────────► available

任意非终态 → failed
candidate/staged/rolling-out/available → revoked（需原因与替代策略）
```

Web/Server 通常从 candidate 进入 staged/rolling-out；Desktop updater 可直接 staged/available；Mobile 需要 submitted/approved。聚合 release 状态由 mandatory targets 和 channel policy计算，不能因一个平台 available 就宣称全平台完成。

状态机 proposed contract 与正反 fixtures 位于 [`schemas/proposed/release`](schemas/proposed/release/README.md)。所有 transition 保存 from/to、actor、policy、external receipt 和 artifact digest；未知或倒退转换必须拒绝。

## 22. 流水线可观测性与 SLO

CI/CD 自身需要指标和告警：queue time、time-to-first-signal、build duration、cache hit、flake rate、runner failure、artifact upload、签名/公证/商店 latency、deployment lead time、change failure rate、rollback time 和 evidence freshness。

诊断使用稳定 failure category：`source`、`test`、`policy`、`toolchain`、`runner`、`registry`、`signing`、`store`、`deployment`、`verification`。Secret 或外部平台故障不能伪装成普通测试失败。关键发布控制面不可用时 fail closed，并显示恢复 owner 与 runbook。

## 23. 成本与容量

macOS runner、跨架构 native build、E2E 和镜像存储是主要成本。优化顺序是消除重复构建、精确 change impact、复用经过 digest 校验的中间产物、合理 shard，再考虑增加 runner。不得为节省成本删除 stable release 的必要 target/evidence。

流水线设置 queue、execution、artifact size 和并发预算；超过预算产生可见报告，而不是隐式跳过。定期任务清理过期 preview、cache 和 nightly，同时保护 stable、last-known-good、活跃事故和 legal hold。

## 24. 灾难与紧急发布

必须演练：registry 不可用、CI provider 不可用、签名服务失败、Apple/Google 延迟、update metadata 错误、runner image 被撤销、错误 migration 和签名凭据泄露。镜像/证据应有符合策略的冗余或导出能力，避免 CI vendor 成为唯一恢复来源。

Hotfix 不绕过 provenance、签名和兼容检查；允许缩短的是发布窗口和非关键人工步骤。紧急停止应能冻结 channel、停止 rollout、撤销 metadata、阻止新部署并保留现场证据。事后补审不能替代发布前的身份与 artifact 完整性验证。

## 25. 实施顺序

1. Runtime 产出本地可重复的 unsigned artifacts；
2. Release plan generator 和 proposed schema 晋级正式 contract；
3. PR quality workflow 与无密钥 package smoke；
4. OCI candidate push、SBOM/provenance 和 staging deploy；
5. 各客户端独立接入签名、公证、TestFlight/Play internal；
6. 完成 SC1 攻击矩阵、撤销演练和 promotion-only 验证；
7. 才启用 beta/stable 与 production 自动化。

具体门禁见 [供应链政策](supply-chain.md)、[Platform Operations](platform-operations.md)、[客户端 Runtime](client-runtimes.md)与 [SC1](spikes/SC1-release-integrity.md)。
