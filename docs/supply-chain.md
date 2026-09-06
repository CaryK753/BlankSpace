# 软件供应链政策

## 1. 当前状态

当前依赖只用于架构 spikes，尚未形成可发布的受审查依赖基线、SBOM、构建 provenance 或签名产物。因此 Blankspace 当前供应链状态是发布 **No-Go**。

未关闭项目统一登记在[决策与门禁台账](decision-backlog.md)的 DEC-005～DEC-007、DEC-010～DEC-011 与 DEC-012E/C/I/A。

本文定义 Phase 1 官方 Framework、Kits、adapters 和 reference products 的最低政策。面向第三方 Kit 或 External Plugin 的发布者身份、额外签名和运行沙箱仍需后续 RFC。

## 2. 保护目标

- 源码、RFC、schema、lockfile 和发布配置不被未授权修改；
- 构建只使用声明、审查和固定的依赖；
- 发布物能追溯到 source revision、构建环境和依赖图；
- registry、CI、maintainer 或依赖失陷时可以停止发布并撤销版本；
- 下游产品能离线读取兼容清单、SBOM 和完整性信息。

Lockfile 证明解析结果固定，不证明 package 作者、源码或构建环境可信。完整性 hash 证明下载内容未变化，不证明内容安全。

## 3. 受支持来源

Phase 1 只支持：

- Blankspace 仓库构建并由发布流程产生的 `@blankspace/*` packages；
- npm registry 中经过依赖审查记录批准的直接和传递依赖；
- 明确固定 digest、经过审查的 CI action、容器镜像和工具链。

Git URL、未固定分支、任意 tarball、本地绝对路径和运行时远程下载不能进入 release lock。Workspace package 在发布前必须验证最终 package 内容和 exports，不能假定本地 symlink 与 registry artifact 相同。

## 4. 依赖审查记录

首次引入或提升 major 版本时记录：

```text
package / version or allowed range
用途与 owner
直接/传递/runtime/dev 分类
registry integrity 与源码仓库
license
maintainer/activity/security history
install/build scripts
网络、文件和凭据访问
已知漏洞与接受理由
替代方案
reviewer / date / expiry
```

审查记录目标位置为机器可读 `security/dependencies.json`，并发布配套 schema。该文件和自动校验尚未实现；DEC-005 完成前不能建立生产发布基线。

该门禁由 Phase 1A 的 Supply Chain Track 接走：Security owner 维护 schema 和审查记录，Build/Release owner 实现 frozen-lock、install-script 与依赖过期校验。交付物固定为 `security/dependencies.schema.json`、`security/dependencies.json`、正反 fixtures 和可由 `blankspace doctor --json`、CI 共同消费的诊断结果；该轨道通过后才能把依赖集合称为受审查基线。

依赖只因实际能力加入。开发 convenience、短代码生成或可由标准库完成的功能不足以自动接受新的 runtime dependency。

## 5. Install scripts 与代码生成

package lifecycle/install scripts 默认禁止。确实需要时逐 package、逐版本审查脚本源码、输入输出、网络访问和平台行为，并在隔离环境执行。允许记录必须精确到 package identity 和内容 hash；不能全局打开 scripts。

代码生成器在固定工具版本、只读输入和声明输出目录中运行。生成结果可重建并与 schema/fixture 对账；生成器不得读取生产 secret、用户 home 配置或未声明网络资源。

## 6. CI 与构建隔离

- CI action 固定不可变 commit SHA，容器固定 digest；
- 默认 token 只读，发布 job 使用单独环境和最小权限；
- pull request 构建不能获得发布凭据或生产 secret；
- 构建从干净 checkout 和 frozen lock 开始，禁止运行时安装缺失依赖；
- cache key 包含 lock、toolchain 和 target，恢复 cache 后仍验证内容；
- release job 不执行来自不可信 fork 的任意脚本；
- 日志和 artifact 不包含 token、签名密钥或 secret 值。

构建环境和 registry 访问失败应停止发布，不自动切换未知 mirror 或重新解析版本。

Docker、Electron、Capacitor、SwiftUI/iOS 与 Compose/Android 的 job 拆分、runner、签名隔离和 promotion 规则见[多产物 CI/CD](ci-cd.md)。所有 target 必须绑定同一 source revision 与输入 hash；环境晋级只复用已有 digest，不能借 promotion 重新构建。

## 7. 发布物与 provenance

每次 release 生成并关联：

- source revision 和 RFC baseline；
- package manager lockfile 与 `blankspace.lock` hash；
- Node/pnpm/构建工具和 runner identity；
- package tarball digest、文件清单和 exports；
- CycloneDX 或 SPDX SBOM；
- compatibility manifest、schemas、codemods 和 migration descriptors；
- 构建 provenance 与发布 job identity；
- conformance、安全、升级和 reference product 验证结果。

Phase 1 是否采用 registry provenance、Sigstore 或其他额外签名由实现 spike 决定。未决定签名方案不影响先固定上述证据，但阻止宣称具备端到端可信构建。

签名选择纳入 Phase 1C 的 SC1 Release Integrity spike，由 Build/Release owner 在实际发布 registry 上比较原生 registry provenance 与 Sigstore/等效方案。矩阵至少覆盖可信发布、fork PR、重放、过期身份、错误 source revision 和撤销；结果写入 `docs/spikes/SC1-release-integrity.md`。SC1 未通过时只允许内部测试 artifact，不允许公开 release。

## 8. 漏洞与撤销

维护者负责：

1. 接收私密漏洞报告；
2. 判断受影响 packages、versions、Kits 和 products；
3. 暂停受影响发布并标记不可选版本；
4. 发布修复、缓解和升级说明；
5. 更新 compatibility manifest 与依赖审查记录；
6. 在不再受支持时明确撤销原因和替代版本。

仅从 registry 删除版本不能可靠保护已有 lockfile。DEC-006 要求 resolver 读取签名或完整性保护的撤销清单，并在 `upgrade --check`、`doctor` 和 CI 中报告；离线构建使用随 release 发布的最后可信快照及有效期策略。

撤销清单属于 Phase 1C release gate，不再留作无阶段的“未来”事项。Security owner 定义 schema、签名覆盖、单调版本、过期和紧急撤销规则；Resolver owner 实现在线刷新、离线最后可信快照和过期失败策略。验收至少包含已撤销 lock、旧快照、签名错误、离线未过期、离线已过期五类 fixtures，并由 SC1 记录证据。

## 9. Kit 与 adapter 信任

Manifest、schema 和 conformance tests 证明兼容性，不证明实现无恶意行为。Phase 1 的构建时 Kit 与产品运行在同一进程和权限下，因此官方支持只覆盖审查名单中的 package/version。

第三方 Kit 正式支持前必须补充 RFC，定义发布者身份、签名、权限声明、网络/文件/secret 访问、撤销、事故响应和隔离策略。External Plugin 还需要单独的运行时沙箱与用户授权模型。

未来 Client Runtime 和跨平台 renderer 还会引入 npm、Swift Package、Maven、Xcode、Gradle/JDK 与平台 SDK。RFC-0017 的 distribution manifest 记录每个 artifact 的 role、ecosystem、selector、coordinate、source、version、content hash、contract hash 与 provenance；`blankspace.lock` 只固定每个 client 实际解析的结果。SwiftPM/Maven artifact 不能因为与 npm package 同名同版本就继承其审查结论，每个产物及 generator 分别审查。第三方自述不能产生 effective `verified`，证据必须来自产品信任策略认可且未撤销的 verifier。

`verified` 只证明声明版本通过 compatibility conformance，不表示安全可信。生产默认只允许 official Runtime；产品显式 allowlist 非 official Runtime 时，仍需完成本政策的依赖、脚本、权限、漏洞、来源和撤销审查。

## 10. 发布门禁

以下任一项缺失即阻止 release：

- frozen lock 与 `blankspace.lock` 不一致；
- 未审查或审查已过期的 runtime/build dependency；
- 未批准的 install script；
- action、镜像或工具使用可变 tag；
- SBOM、artifact digest、provenance 或 compatibility manifest 缺失；
- 已知撤销版本仍被选择；
- release 验证或安全回归失败；
- 发布凭据暴露给非发布 job。

源码授权也是门禁证据，而不只检查 artifact 来源。默认政策要求受保护发布分支、必需 CI、至少一名非提交者评审、Contract/RFC/schema/发布配置的 owner review，以及 release job 对精确 source revision 的绑定。平台尚未建立 `CODEOWNERS` 时，`security/source-approvals.json` 必须记录受保护路径、reviewer identity、review result、revision 和平台审计引用；缺少任一等效控制保持 No-Go。SC1 验证未评审 revision、评审后被改写 revision 和不受信 fork 均不能发布。

## 11. 分阶段解锁路线

| 阶段 | Owner | 交付物 | 解锁结果 |
| --- | --- | --- | --- |
| Phase 1A Supply Chain Track | Security + Build/Release | dependency schema/记录、lock 与 install-script 校验、fixtures | 建立可审查依赖基线 |
| Phase 1C SC1 | Security + Build/Release + Resolver | source approval evidence、provenance/签名决策、撤销清单与离线策略、公开 registry fixtures | 允许满足全部门禁的公开 release |
| Phase 1C License | Repository owner + Legal reviewer | 根许可证文本、依赖兼容复核和分发策略记录 | 解除许可证这一项独立发布阻断 |
| 第三方 Kit RFC | Security + Kit owner | publisher、权限、隔离、事故响应与撤销策略 | 允许逐 package 评估第三方 Kit |
| External Plugin RFC | Security + Runtime owner | 用户授权、沙箱、故障隔离和动态撤销 | 允许评估运行时安装 |

每条轨道的证据路径必须进入 release report；只有文档或人工口头批准不解锁门禁。未指定人员时，角色 owner 由仓库维护者在开始相应阶段前指派并写入任务记录。

## 12. 许可证

依赖审查必须记录并验证许可证与预期分发方式兼容。Blankspace 根许可证尚未选择；仓库所有者添加明确许可证前，不能假定源码允许公开复制、修改或分发，也不能发布对外 package。

## 13. 参考资料

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Software Supply Chain Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html)
- [OWASP CI/CD Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html)

这些资料用于校准政策。具体发布平台启用哪些证明机制，需要由实现和威胁模型验证。
