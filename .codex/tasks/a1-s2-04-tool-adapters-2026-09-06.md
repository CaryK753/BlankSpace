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
- [ ] 在 Linux 与 Windows runner 执行同一 corpus
- [x] 添加固定 action SHA 的 Linux/macOS/Windows GitHub Actions matrix
- [x] 运行 build、typecheck、test、verify:docs
- [x] 更新当前 work item evidence、S2 Spike 与 project status

## 边界

- adapters 只观测工具原生 resolver，不加载 fixture 产品代码，不进入 S3 bundle trace。
- Vite 通过已声明的 `vitest/node#createViteServer` 公共入口加载与 Vitest 配对、由 lockfile 固定的 peer，禁止裸 `import 'vite'` 命中 checkout 外的祖先目录。
- canonical transcript 只保存工具版本、mode、condition 和逻辑解析结果；绝对路径、盘符、反斜杠、`node_modules` 与 pnpm store realpath 仅作为规范化输入，不能进入输出。
- 未实际运行的平台明确记录为未运行，不能由路径字符串变换或本机模拟充当证据。

## 当前状态

进行中。本机 macOS 的五种 mode 已在两个 checkout、两个 pnpm store 上通过逐边对账，并固化 canonical transcript。Docker daemon 后续已启动，但当前任务执行策略阻止 `docker pull`/`docker run` 且不允许申请额外授权；尚无可调用的 Linux/Windows runner。

三平台 GitHub Actions workflow 已写入 `.github/workflows/s2-conformance.yml`。本地 Git 已基于远端 `main` 初始化，但同一任务策略继续阻止 `git add`、commit 和 push，因此 workflow 尚未进入远端执行。

## 已确认环境

- macOS 27.0（26A5425a），arm64；
- Node.js v24.20.0；
- pnpm 10.32.1；
- TypeScript 5.9.3；
- Vitest 4.1.11，配套 Vite 8.2.2；
- Docker Desktop 4.88.1 / Engine 29.7.2，Linux arm64 daemon 可响应只读探测，但容器 pull/run 被当前任务执行策略拦截。

## 当前验证证据

- `fnm exec --using=24 pnpm build`：通过；
- `fnm exec --using=24 pnpm typecheck`：通过；
- `fnm exec --using=24 pnpm test`：109 个 Vitest、8 个 S1 与 4 个 S2 用例通过；
- `fnm exec --using=24 pnpm verify:docs`：通过。

未运行：Linux 与 Windows transcript。A1-S2-04 不能标为 `done`。
