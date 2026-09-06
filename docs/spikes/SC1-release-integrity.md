# SC1：发布完整性与撤销

## 状态

Draft matrix，尚未执行；属于 Phase 1C 发布门禁，不改变 S1～S8 的编号。

## 目标

验证受保护 source revision、依赖审查、artifact provenance/签名和撤销快照能形成一条可离线审计的发布证据链。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| 受保护分支、必需 CI 与 owner review | 允许进入发布 job |
| 未评审、评审后改写或 fork revision | 拒绝发布 |
| frozen lock 与审查记录一致 | 生成 dependency evidence |
| 未批准 install script/过期审查 | 拒绝发布 |
| 生成 SBOM、compatibility manifest 与 artifact 文件清单 | 三者绑定同一 source revision 和 artifact digest |
| artifact 对应 source revision | provenance/签名验证通过 |
| 重放、过期身份或错误 revision | 验证失败 |
| 安全回归或 conformance suite 失败 | 拒绝发布并保留证据 |
| fork PR 或非发布 job 请求凭据 | 凭据不可用且审计可查 |
| 当前撤销快照命中 lock | upgrade、doctor、CI 均失败 |
| 离线未过期可信快照 | 按政策允许并记录 snapshot hash |
| 离线过期或签名错误快照 | 发布失败 |

## 尚待冻结

发布 registry、身份与签名方案、source approval schema、撤销 schema、SBOM/compatibility manifest 工具、有效期、runner、fixtures、命令和责任人姓名。根许可证选择是并列发布门禁，由仓库所有者单独完成，不因 SC1 通过而自动解除。

多平台输入采用 [`release-plan-v1`](../schemas/proposed/release/README.md) 作为设计期起点。SC1 执行时必须增加 OCI index、Electron 签名/公证、iOS archive/export、Android AAB/upload key、promotion 不重建与 fork PR 无凭据的真实 runner evidence；仅通过 schema fixture 不能把本实验标为 Pass。
