# A1-S2-04 Tool adapters 与跨平台 S2 证据

日期：2026-09-06

## 目标

用真实 TypeScript、Node、Vite 与 Vitest resolver 对账 Compiler 的 `ResolutionRecordV1`，生成不携带 checkout、pnpm store 或平台路径的 canonical transcript，并执行 S2 要求的 checkout、store 与 OS matrix。

## TODO

- [x] 阅读 A1-S2-04、S2 Resolver Matrix、测试策略和现有 resolver
- [x] 探测本机工具版本、Vite 解析来源与跨平台 runner 可用性
- [x] 冻结 adapter trace 与 transcript 格式
- [x] 实现 TypeScript、Node、Vite、Vitest adapters 和逐边对账
- [x] 增加两个 checkout、两个 pnpm store 的 conformance runner
- [x] 生成并验证 macOS canonical transcript
- [x] 在 Linux 与 Windows runner 执行同一 corpus
- [x] 添加固定 action SHA 的 Linux/macOS/Windows GitHub Actions matrix
- [x] 将 action 升级到 Node 24 runtime 并固定审核后的 commit SHA
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新当前 work item evidence、S2 Spike 与 project status

## 边界

- adapters 只观测工具原生 resolver，不加载 fixture 产品代码，不进入 S3 bundle trace。
- Vite 通过已声明的 `vitest/node#createViteServer` 公共入口加载与 Vitest 配对、由 lockfile 固定的 peer，禁止裸 `import 'vite'` 命中 checkout 外的祖先目录。
- canonical transcript 只保存工具版本、mode、condition 和逻辑解析结果；绝对路径、盘符、反斜杠、`node_modules` 与 pnpm store realpath 仅作为规范化输入，不能进入输出。
- 未实际运行的平台明确记录为未运行，不能由路径字符串变换或本机模拟充当证据。

## 当前状态

已完成。提交 `aab99489b492fb78bd0bc14b6f5fae69921fc9d0` 的 GitHub Actions run [34016987463](https://github.com/CaryK753/BlankSpace/actions/runs/34016987463) 在 `ubuntu-24.04`、`macos-15` 和 `windows-2025` 上全部通过；三平台均执行同一五 mode corpus、两个 checkout、两个隔离 pnpm store，并与 records hash `71652e6c253cd52cfcd0dde6a97314ab1e389548396f6269d81fcb51bda0a969` 对账。

## 已确认环境

- macOS 27.0（26A5425a），arm64；
- Node.js v24.20.0；
- pnpm 10.32.1；
- TypeScript 5.9.3；
- Vitest 4.1.11，配套 Vite 8.2.2；
- GitHub-hosted `ubuntu-24.04`、`macos-15`、`windows-2025` runners。

## CI action 审查

- `actions/checkout` 升级到 v5.1.0，固定 commit `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`；用途仅为只读 checkout，`persist-credentials: false`，上游为 GitHub `actions/checkout`，Node 24 runtime。
- `actions/setup-node` 升级到 v5.0.0，固定 commit `a0853c24544627f65ddf259abe73b1d18a591444`；用途仅为安装 Node.js 24.20.0，上游为 GitHub `actions/setup-node`，显式关闭自动 package-manager cache。
- 两个 action 均只运行于 `contents: read` workflow，无发布凭据、install scripts、artifact 写入或额外网络目标；reviewer `wwj`，审查日期 2026-09-06，下次 major 升级时复核。

## 当前验证证据

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：109 个 Vitest、8 个 S1 与 4 个 S2 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。
- GitHub Actions `S2 / ubuntu-24.04`：通过，[job 101442388874](https://github.com/CaryK753/BlankSpace/actions/runs/34016987463/job/101442388874)；
- GitHub Actions `S2 / macos-15`：通过，[job 101442388836](https://github.com/CaryK753/BlankSpace/actions/runs/34016987463/job/101442388836)；
- GitHub Actions `S2 / windows-2025`：通过，[job 101442388773](https://github.com/CaryK753/BlankSpace/actions/runs/34016987463/job/101442388773)。

未跳过检查。`A1-S2-04` 可以标为 `done`，S2 可以推进为 Pass；下一工作项只冻结 S3 trace/schema/fixture，不提前实现 Registry、Runtime 或业务 Kit。
