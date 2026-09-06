# Proposed Release Contracts

这里保存多产物 CI/CD 的设计期 schema 与 fixtures，不是已发布的 `@blankspace/contracts` API。

- `release-plan-v1.schema.json`：声明 source、jobs、artifacts、信任级别、promotion 行为和 evidence 要求；
- `release-lifecycle-v1.schema.json`：声明多 target 发布状态、晋级轨迹、artifact identity 与外部 receipt；
- `release-candidate-v1.schema.json`：统一不可变 artifact、真实 evidence 引用、版本、兼容性和发布策略；
- `fixtures/valid-multi-target.json`：Server/Web/Electron/Mobile 的最小合法构建图；
- `fixtures/invalid-promotion-rebuild.json`：promotion 重新构建；
- `fixtures/invalid-untrusted-secret.json`：不可信 job 访问 secret；
- `fixtures/invalid-job-cycle.json`：job 依赖成环。
- `fixtures/lifecycle-valid-mobile.json`：移动商店提交、批准和可用状态；
- `fixtures/lifecycle-invalid-rebuild.json`：晋级过程中 artifact digest 改变。
- `fixtures/lifecycle-invalid-discontinuous.json`：审计历史不连续；
- `fixtures/candidate-valid.json`：带真实 digest/evidence 引用的最小候选；
- `fixtures/candidate-invalid-evidence-subject.json`：evidence 指向无关 artifact。

运行 `pnpm verify:docs` 同时执行 JSON Schema 与跨字段语义验证。
