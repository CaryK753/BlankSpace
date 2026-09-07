# S5：启动失败与资源回收

## 状态

Pass。`A1-S5-01` 与 `A1-S5-02` 已冻结 lifecycle core、Event publish/dispatch 与活动 dispatch 排空；`A1-S5-03` 已用 Node.js v24.20.0 与 pnpm 10.32.1 在 Ubuntu 24.04、macOS 15、Windows 2025 对账同一 frozen corpus。S6 随后在三平台通过 shutdown deadline/host termination，并在 POSIX runner 通过真实 signal，关闭了 S5 的剩余 provisional 条件。

日期：2026-09-05。依据：RFC-0001、RFC-0002。

## 要回答的问题

串行生命周期能否在部分失败后明确释放所有已获取资源，同时保持主错误、清理错误和 Runtime 状态可解释？

## 实验设置

构造 A → B → C → D 四个入口，箭头表示后者需要前者。记录每个入口的 factory、start、stop 轨迹，以及 Runtime 的单一 ready 状态转换；资源账本记录 owner、资源 ID、获取与释放次数。Entry 不存在 `ready()` hook。

factory 只产生内存对象；start 获取可观测的测试连接、监听器和后台任务句柄。每种故障单独运行，资源 ID 固定，比较事件顺序与最终余额。测试只允许具有有界行为的协作式入口；进程挂死与 host 强制终止交给 S6。

runner 使用 Node.js v24.20.0、pnpm 10.32.1 与已锁定的 Ajv 8.18.0，fixture 位于 `spikes/s5-lifecycle/`，通过 `fnm exec --using=24 pnpm test:s5` 执行。生命周期与 Event transcript 分别为 `spikes/s5-lifecycle/transcripts/macos-arm64.json` 和 `spikes/s5-lifecycle/transcripts/macos-arm64-events.json`；两者的 canonical scenario bytes 在重复运行间一致。

## 故障矩阵

| 场景 | 预期轨迹与结果 |
| --- | --- |
| 正常启动和关闭 | A、B、C、D 顺序 factory/start；全部成功后 ready；D、C、B、A 顺序 stop |
| register 抛错或 Draft 与 Graph 不符 | 无业务 factory/start；Draft 丢弃；无外部资源 |
| C factory 抛错 | A/B 已启动；C 无外部资源；不执行 D factory；B/A 反序停止 |
| C 获取第一个资源前失败 | C 自身资源余额为零；B/A 停止；D 不实例化 |
| C 获取部分资源后失败 | C 先回收自己的资源再拒绝；随后 B/A 停止；Runtime 不调用 C.stop |
| C 启动失败且自身清理也失败 | 启动错误仍为主错误；记录 C 残余资源及清理错误；B/A 仍停止；不能宣称完整清理 |
| 正常关闭时 C.stop 抛错 | D 已停止；C 错误被记录；B/A 仍停止；整体关闭结果包含清理失败 |
| 连续调用两次 stop | 第二次不重复释放资源；返回一致的终态信息 |
| 两次并发 stop | 共享同一次关闭过程，不交错执行两套 stop 序列 |
| start 期间请求关闭 | 不启动后续入口；等待当前有界 start 完成，成功则纳入反序停止，失败则走自身回收路径；不得 ready |
| register/start 中 publish | 拒绝调度且无 handler 执行；返回生命周期 diagnostic |
| ready 后嵌套 publish | 按深度优先顺序执行；correlation/causation/depth 可追踪 |
| 嵌套 publish 达到深度 33 | 第 33 层拒绝；当前 handler 记失败；其他已排定 handlers 继续；无无限递归 |
| stop 开始后新 publish | 拒绝新 dispatch；不新增 handler 工作 |
| stop 前已有活动 dispatch | 在 deadline 内先排空，然后反序 stop；期间不得 ready 或接受新 publish |
| 清理超过 deadline | 标记未完成与超时；不报告干净关闭；host 终止由 S6 接续验证 |

## 通过条件

所有成功和可完整清理的失败场景，最终资源余额为零、每个资源最多释放一次、轨迹符合矩阵。故意注入不可回收资源的场景必须明确报告失败和 owner，不能靠忽略错误达标。

主启动错误不被 stop 错误覆盖；错误记录顺序固定；所有失败场景不发出 ready。每个 fixture 同时校验轨迹、状态和资源账本。不得通过更改预期轨迹掩盖实现违反 RFC。

## 失败后的选择

先检查是否把资源获取放进 factory，或让失败 start 依赖 Runtime.stop。若遵守契约的多个入口仍重复实现复杂且易错的回收，再提交 RFC 评估可选资源清理 helper；实验前不增加第二套生命周期或 DI 容器。

## A1-S5-01 证据

- A→B→C→D 逐个 factory/start，全部成功后只进入一次 ready，关闭严格按 D→C→B→A；
- C factory、资源获取前 start、部分启动、自身清理失败与正常 stop 失败均有独立 fixture；
- 主启动错误不会被清理错误覆盖，故意残留的资源会保留 owner、release attempt 和余额；
- 连续与并发 stop 共用一个 shutdown promise 和终态对象，每个资源最多释放一次；
- C 的有界 start 期间请求 stop 后不进入 D/ready，待 C 完成后按 C→B→A 回收；
- corpus 连续执行两次的 canonical scenario bytes 相同，matrix hash 记录在本地 transcript；
- 完整本地工程门禁见 `.codex/tasks/a1-s5-01-lifecycle-core-2026-09-06.md`。

## A1-S5-02 证据

- register、factory、start 与 stopping 阶段发布均返回 `E_EVENT_PUBLISH_LIFECYCLE`，handler 执行次数为零；
- ready 后 handler 按稳定 ID 串行执行，中间 handler 失败记录 `E_EVENT_HANDLER_FAILED`，外层 `publish()` 仍完成；
- 嵌套发布严格 depth-first，根/子/叶事件保持同一 correlationId，并用父 eventInstanceId 形成 causation 链；
- dispatchDepth 最大为 32，第 33 层返回 `E_EVENT_DISPATCH_DEPTH`，当前 handler 记失败后其余已排定 handler 继续；
- stop 进入 stopping 后拒绝新发布，等待已开始的 handler 完成，再按 B→A 反序停止；
- 原九个 lifecycle 场景与 transcript 保持不变；Event matrix 连续运行两次得到 hash `452c665615c33df5fdaf81c45f13a87ce80fce536981784a2e89521c3dcc30b4`；
- 完整本地工程门禁见 `.codex/tasks/a1-s5-02-event-dispatch-2026-09-06.md`。

## A1-S5-03 证据

- GitHub Actions run `34043351874` 在 Ubuntu 24.04、macOS 15 与 Windows 2025 全部通过 9 个 lifecycle 和 5 个 Event 场景；
- 三个平台均通过 checked-in baseline assertion，匹配 lifecycle matrix hash `60634d7b…7151` 与 Event matrix hash `452c6656…0b4`；
- 同一提交的 S2 run `34043351886`、S3 run `34043351842` 保持绿色；
- S4 run `34043351840` 的 Windows 首次尝试在 Corepack 下载阶段失败，未进入项目代码；对同一提交重跑后，三平台全部通过；
- 完整证据见 `.codex/tasks/a1-s5-03-cross-platform-conformance-2026-09-06.md`。

## 后续边界

S5 与 S6 corpus 继续作为跨平台 regression gate。Pass 证明冻结的 lifecycle/Event/host 行为，不等于生产 Runtime package、持久 Event transport、Database 资源或业务 Service 已完成。
