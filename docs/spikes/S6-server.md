# S6：Server Host、排空与关闭

## 状态

Pass。`A1-S6-03` 已在 Ubuntu 24.04、macOS 15 与 Windows 2025 上通过同一十场景 core corpus；Ubuntu/macOS 通过真实 `SIGTERM`/`SIGINT` 子进程验证，Windows 通过批准的 `unsupported-by-node` 分支。本状态只证明 Phase 1A host conformance，不代表生产 Runtime 或 Server adapter API 已实现。

## 要回答的问题

Fastify adapter 能否服从 Blankspace Runtime 的单一生命周期，在启动失败、信号、活动请求和拒绝停止的 owner 下给出有界、可诊断且可由 host 执行的关闭结果？

## 决策上下文

RFC-0013 已选择 Fastify 而非带第二套 DI/module lifecycle 的 NestJS。本实验只验证 host adapter 边界，不重新授权框架拥有 Service graph、signal 或 shutdown policy。Fastify 的 `close()` 会先标记 closing、拒绝新请求、排空连接并等待活动请求，之后运行 `onClose`；这些机制适合作为 adapter 原语，但整体 deadline、Runtime entries 和进程终止仍由 Blankspace host 拥有。参见 [Fastify 5.12 Server reference](https://fastify.dev/docs/v5.12.x/Reference/Server/) 与 [Hooks reference](https://fastify.dev/docs/v5.12.x/Reference/Hooks/)。

## 工具与版本决策

| 能力 | 冻结选择 | 选择理由 |
| --- | --- | --- |
| Runtime | Node.js `v24.20.0` | 与现有三平台 CI 一致；精确 patch，不接受浮动 `24` 作为 evidence identity |
| Package manager | pnpm `10.32.1` | 与仓库 `packageManager` 一致；未来安装必须 exact 且 `--ignore-scripts` |
| Server candidate | Fastify `5.12.3` | 当前稳定 v5；包含 `5.12.2` 安全修复；版本 identity 读取 lock/package metadata，不信任滞后一版的运行时 `VERSION` 常量 |
| HTTP client | Node `globalThis.fetch` | Node 21 起为 Stable；Node `v24.20.0` 实测内置 Undici `7.29.0`，无需额外 npm package |
| Schema/test | JSON Schema 2020-12、`node:test` | 与 S1～S5 corpus 一致，不引入新的 runner |

不使用 `fastify.inject()` 代替网络客户端，因为它绕过真实 listen、socket、keep-alive 和关闭排空。也不直接安装 `undici`：S6 只需要标准 HTTP/1.1 loopback 请求，Node 官方说明 `fetch` 基于内置 Undici，并可通过 `process.versions.undici` 获取版本。[Node fetch reference](https://nodejs.org/download/release/v24.20.0/docs/api/globals.html#fetch)

候选依赖树、许可证、脚本、安全历史、替代方案和复审条件见 [S6 候选依赖审查](./s6-server/dependency-review.md)。该记录只允许后续 spike 评估，不构成生产依赖基线或发布批准。

## Runner 环境与平台边界

| Corpus | Runner | 要求 |
| --- | --- | --- |
| core host | `ubuntu-24.04`、`macos-15`、`windows-2025` | 运行相同 10 场景、两次枚举顺序、相同 canonical matrix hash |
| real signal | `ubuntu-24.04`、`macos-15` | 子进程真实接收 `SIGTERM` 与 `SIGINT`；父进程通过 IPC 等待状态屏障 |
| Windows signal | `windows-2025` | 只运行相同 signal-controller 逻辑，不宣称真实 POSIX signal evidence |

Node 明确说明 Windows 不支持 POSIX signal 等价语义，`SIGTERM` 可监听但不受支持，`process.kill()` 会直接终止目标进程。因此 Windows 不能用强杀结果冒充 graceful signal handler 通过；这是批准的平台差异，不进入共同 core hash。[Node process signal reference](https://nodejs.org/download/release/v24.20.0/docs/api/process.html#signal-events)

## 固定配置与时间预算

Server 只绑定 `127.0.0.1` 和端口 `0`；实际端口是环境证据，不进入 canonical 内容。Fastify options 显式冻结，避免默认值漂移：

```json
{
  "logger": false,
  "trustProxy": false,
  "return503OnClosing": true,
  "forceCloseConnections": "idle",
  "bodyLimit": 1048576,
  "requestTimeout": 5000,
  "handlerTimeout": 5000,
  "keepAliveTimeout": 1000
}
```

| Budget | 毫秒 | 适用范围 |
| --- | ---: | --- |
| `startupDeadlineMs` | 5000 | route register、Fastify ready/listen 和 Runtime ready 前置阶段 |
| `shutdownDeadlineMs` | 1000 | 从第一个 stop/signal 到 clean terminal 或 timeout report |
| `clientRequestDeadlineMs` | 2000 | 每个 loopback `fetch`，防止测试客户端悬挂 |
| `harnessDeadlineMs` | 15000 | 父进程对单场景子进程的最后保险；触发视为 runner failure |

deadline fixture 使用显式 Promise/IPC barrier，不用依赖不稳定的固定 sleep。canonical transcript 记录配置 deadline，不记录实测耗时。

## Fixture 协议

- `GET /health/live`：host 进程存活时返回 `200`；不代表 Runtime ready。
- `GET /health/ready`：仅 Runtime `ready` 返回 `200`，其他状态返回 `503`。
- `GET /fixtures/slow`：登记 `request:slow-1` 后等待父进程 release；用于证明旧请求先于 entry stop 完成。
- `GET /fixtures/fail`：抛出带固定 `FIXTURE_HANDLER_FAILURE` code 的错误，返回 `500` 并产生稳定 diagnostic，Runtime 保持 ready。
- route failure：同一 owner 重复注册 `GET /fixtures/conflict`，在 listen 前归一化 `FST_ERR_DUPLICATED_ROUTE`。
- listen failure：父进程先用 Node `net.Server` 占用一个 loopback 端口，再要求 Fastify 使用同一端口，归一化 `EADDRINUSE`。
- background fixture：`entry:B/background:fixture` 可选择 cooperative release 或永不完成；资源 owner 必须可枚举。
- closing rejection：测试专用 `preClose` barrier 确认 server 已进入 closing 后发送新请求，必须得到 `503` 且业务 handler 不运行。

Fastify adapter 是最后启动、最先停止的 host entry。关闭顺序固定为：Runtime 进入 `stopping` 并撤销 readiness → 拒绝新 Event → 调用一次 `fastify.close()` 停止接收并排空 HTTP → 排空已开始 Event → 按 S5 反序停止 entries/background work → clean terminal。任何一步都共享同一个 `shutdownDeadlineMs`，不为框架 hooks 创建第二个生命周期。

## 稳定 diagnostic 结构

S6 runner 的 diagnostic 固定字段为：

```ts
interface S6Diagnostic {
  code: 'E_SERVER_ROUTE_REGISTER' | 'E_SERVER_LISTEN' |
    'E_SERVER_HANDLER_FAILED' | 'E_SERVER_CLOSE_FAILED' |
    'E_SERVER_START_ABORTED' | 'E_SERVER_SHUTDOWN_TIMEOUT';
  severity: 'error';
  phase: 'register' | 'start' | 'ready' | 'stopping' | 'stop' | 'terminate';
  ownerId: string;
  operation: 'route-register' | 'listen' | 'request' | 'server-close' |
    'runtime-stop' | 'host-terminate';
  message: string;
  causeCode?: string;
  trigger?: 'api' | 'SIGTERM' | 'SIGINT';
  deadlineMs?: number;
  activeRequestCount?: number;
  pendingOwners?: string[];
}
```

`pendingOwners` 按 ID 排序；端口、PID、时间戳、elapsed、绝对路径、stack 和第三方原始 message 禁止进入 diagnostic。`causeCode` 只保留 allowlist 中的 `EADDRINUSE`、`FST_ERR_DUPLICATED_ROUTE`、`FIXTURE_HANDLER_FAILURE` 与 `FIXTURE_CLOSE_FAILURE`。启动错误保持 primary；关闭错误追加而不覆盖 primary。

## Frozen core matrix

| ID | 固定输入 | 预期结果 |
| --- | --- | --- |
| `normal-start-stop` | health/ready 请求后 API stop | listen 成功后 ready 一次；server close 一次；exit `0` |
| `listen-address-in-use` | loopback 端口由 reservation server 占用 | 不 ready；primary `E_SERVER_LISTEN`/`EADDRINUSE`；释放 reservation |
| `route-registration-failure` | 重复 route fixture | listen count `0`；primary `E_SERVER_ROUTE_REGISTER`/`FST_ERR_DUPLICATED_ROUTE` |
| `signal-shared-stop` | ready 后两个 signal-controller 请求 | 共享一次 shutdown promise；close/entry stop 各最多一次；clean exit `0` |
| `slow-request-drain` | slow 已进入后 stop；closing barrier 后再请求；再 release slow | 新请求 `503` 且 handler 未运行；旧请求完成后才反序 stop；exit `0` |
| `request-drain-timeout` | slow 永不 release | `E_SERVER_SHUTDOWN_TIMEOUT`；active `1`；pending `request:slow-1`；exit `1` |
| `background-stop-timeout` | 无活动请求；background owner 不停止 | server 已关闭；timeout pending `entry:B/background:fixture`；exit `1` |
| `repeated-concurrent-stop` | 两次连续加两次并发 API stop | terminal object/promise 共享；server close 和每个资源 release 最多一次 |
| `stop-before-ready` | listen 已完成、ready callback barrier 前 stop | ready count `0`；`E_SERVER_START_ABORTED`；关闭已监听 server；exit `0` |
| `handler-failure` | ready 后请求 fail route | HTTP `500` 和 `E_SERVER_HANDLER_FAILED`；Runtime 仍 ready；随后 clean stop |

另用 `onClose` fixture 抛出 `FIXTURE_CLOSE_FAILURE` 覆盖 `E_SERVER_CLOSE_FAILED` 的归一化单元测试；它不增加 core scenario 数量，避免把第三方 hook cleanup 当作独立 Runtime lifecycle。

## Signal 与 host termination 协议

POSIX 子进程在 route 注册前安装一个共享 `SIGTERM`/`SIGINT` listener。父进程只在收到 `ready` IPC 后发送 signal；重复 signal 等待 `stopping` IPC 后再发送，断言 stop invocation 仍为一。clean shutdown 发送 terminal IPC 后自然以 `0` 退出。

deadline 到达时，Runtime 生成 `E_SERVER_SHUTDOWN_TIMEOUT`，保留未完成 owner 和资源余额，不宣称 server/entry 已停止。子进程先通过 IPC 发送 timeout report，发送 callback 完成后由 host 执行 `process.exit(1)`；父进程断言非零退出。只有这一进程边界允许强制终止，Runtime library 本身不得调用 `process.exit()`。父进程 `harnessDeadlineMs` 到达仍无报告时执行 hard kill，并把场景记为 runner failure，而不是合格的 shutdown timeout。

## Canonical evidence

core matrix 每次以正序和反序执行，共两轮。matrix hash 只覆盖场景 ID、状态、ready/close/stop counts、归一化 diagnostics、逻辑 trace、active request/resource ledger 和 exit classification。`environment`、实际端口、signal transport 与 wall-clock evidence 位于 hash 外。

真实 signal transcript 单独记录 POSIX runner、signal 和 exit classification；Windows 记录 `unsupported-by-node`，不与 POSIX hash 强行对齐。任何新平台差异必须先修改本矩阵，不得在 runner 中临时放宽断言。

### 本地执行结果

2026-09-07 在 macOS 27.0 arm64、Node `v24.20.0`、pnpm `10.32.1`、Fastify `5.12.3` 与内置 Undici `7.29.0` 上：十个 core 场景以正序和反序各执行一次，canonical matrix hash 均为 `cf82465d0667b1a58f46bbfa9c2aa65a3247cff53ac11e3d3fcf63590cdd78eb`。`SIGTERM` 与 `SIGINT` 均由真实子进程各接收两次，进入同一 shutdown promise，Fastify close 和 A/B entry stop 各执行一次。listen 与 route 注册失败子进程均以非零状态退出，其中 listen 失败先按反序回滚已启动 entries。

真实请求证明 closing 后的新请求返回 `503`、已接纳 slow request 在 entry stop 前完成。request/background timeout 子进程先通过 IPC 上报排序后的 `request:slow-1` 或 `entry:B/background:fixture`，再以 `1` 退出；父进程 harness deadline 未被用作合格证据。完整本地基线见 [`spikes/s6-server/transcripts/macos-arm64.json`](../../spikes/s6-server/transcripts/macos-arm64.json)，测试与 schema 位于同目录。

### 跨平台执行结果

GitHub Actions run `34084714281` 在 candidate commit `147ed7ae3648fe2fae3a38c871833e48ad8defd7` 上通过 Ubuntu 24.04、macOS 15 与 Windows 2025 的 frozen-lock 安装和 `pnpm test:s6`。三个 runner 均通过 checked-in baseline assertion，匹配 canonical matrix hash `cf82465d0667b1a58f46bbfa9c2aa65a3247cff53ac11e3d3fcf63590cdd78eb`；timeout 场景均先上报 owner 再非零退出。

Ubuntu 与 macOS 执行真实、重复的 `SIGTERM` 和 `SIGINT`，每种 signal 都共享一个 shutdown，server close 与 entry stop 各一次；Windows 明确断言 `unsupported-by-node` 且不发送伪 POSIX signal。同一提交的 S2 run `34084714246`、S3 run `34084714297`、S4 run `34084714309` 与 S5 run `34084714274` 全部通过。

## 通过条件与失败选择

所有支持平台的 core corpus 两轮必须得到相同 hash；Ubuntu/macOS 还必须通过真实 `SIGTERM`/`SIGINT`。成功和可清理失败的资源余额为零；timeout 场景必须列出未完成 owner、非零退出且不报告 clean。S2～S5 corpus 必须保持绿色。

若 Fastify 无法在 `forceCloseConnections: "idle"` 下拒绝新请求并排空活动请求，或其 hook lifecycle 迫使框架接管 Runtime entries，再用 RFC 重开 Server host 选项。不得改用 `forceCloseConnections: true` 破坏活动请求来制造“快速通过”，也不得扩大 deadline 掩盖无界 owner。

## 实施交接

`A1-S6-02` 与 `A1-S6-03` 已完成本地实现和三平台 portability gate。Fastify 适合作为后续 Server host adapter 原语，但 spike 不会直接提升为 production Runtime package。`A1-S7-01` 已冻结 Database 工具链与 migration fault contract，当前 `A1-S7-02` 实现本地数据库 runner；S6 workflow 继续作为 regression gate。
