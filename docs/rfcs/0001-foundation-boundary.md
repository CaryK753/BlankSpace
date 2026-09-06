# RFC-0001：Foundation 最小边界与生命周期

## 状态

Proposed

## 背景

Blankspace 需要为不同 SaaS 产品提供一致的装配、运行和诊断能力，但 Foundation 一旦包含 Identity、Workspace、数据库或 UI 领域模型，就会迫使所有产品接受同一种产品结构。

## 决策

### 1. Foundation 只包含五类职责

| 职责 | 内容 |
| --- | --- |
| Contracts | Kit、Service、Event、Module、Runtime 的公开类型与稳定 ID |
| Compiler | 读取产品配置，解析依赖，校验边界，生成 Product Graph |
| Runtime | 按 Graph 注册 Service、启动入口、发布进程内 Event、停止应用 |
| Diagnostics | 稳定错误码、人类文本和 JSON 结果 |
| Tooling | CLI、测试 runtime、生成器和 inspect 接口 |

Identity、Workspace、Organization、Database、Files、Editor、Billing、local-first、Sync 和具体 UI 组件均不进入 Foundation。

### 2. 候选 package 边界

```text
@blankspace/contracts     无运行时副作用的公共类型和 schema
@blankspace/runtime       最小应用 runtime
@blankspace/compiler      配置解析、Graph 与静态校验
@blankspace/testing       测试 runtime 和 fixtures
@blankspace/cli           稳定命令入口
```

这是责任边界，不是必须永远保持五个发布包。原型可以合并物理 package，但禁止形成反向依赖：`contracts` 不依赖其他 Foundation 包，`runtime` 不依赖 compiler 或 CLI。

Phase 1 只要求两个 runtime targets：`web` 与 `server`。`shared` 是可被目标引用的代码类别，不是独立运行目标；Desktop/Mobile 后续由 RFC-0015 的 Client Target、Client Runtime 与 UI Family 模型加入，不把 `desktop`/`mobile` 一个枚举值同时当作平台和技术栈。

### 3. 编译期与运行期分离

```text
Product config + installed manifests + Product Modules
                    │
                    ▼
                 Compiler
                    │
          Product Graph + Executable Registry
                    │
                    ▼
                  Runtime
```

Runtime 不扫描文件系统、不解析 package 版本、不决定可选 Kit，也不猜初始化顺序。Compiler 不连接数据库、不调用供应商 API、不启动业务 Service。

### 4. 生命周期

Phase 1 只定义：

```text
register → start → ready → stop
```

- `register`：按 entry ID 稳定排序，先对所有目标 entry 在临时 Registry Draft 中同步声明 provider factory 和 handler factory，不实例化业务对象、不执行 I/O；全部成功且与 Graph 匹配后一次提交；
- `start`：按依赖顺序建立连接或启动资源；
- `ready`：所有必需入口已成功启动后发布应用就绪状态；
- `stop`：按成功启动的反向顺序释放资源，必须可重复调用。

Phase 1 使用稳定拓扑序串行实例化并执行 `start`。任一入口失败即视为整个应用启动失败，不保留无关分支；Runtime 对全部已成功启动入口按严格反序调用 `stop`。原始启动错误是主错误，清理错误作为附加 diagnostics 返回。`register` 失败时 Draft 直接丢弃，因为尚未实例化业务对象，也没有入口进入 started 状态。

RegistrationContext 只暴露 `provideFactory()` 与 `subscribeFactory()` 等声明式方法，不暴露网络、文件、secret 或已实例化 Service。Entry module 顶层和 register 的无副作用规则由 lint、受限测试 runtime 与 code review 共同执行；无法完全静态证明的第三方 entry 在未来第三方 Kit 信任 RFC 前不进入稳定支持范围。

资源所有权遵循以下规则：

- factory 只构造内存对象，不打开连接、不安装监听器、不启动定时器或后台任务；需要关闭的资源推迟到 `start` 获取；
- `start` 成功返回前，资源仍归该入口的启动过程所有；如果部分初始化失败，入口必须先释放已获取资源，再拒绝启动 Promise；
- `start` 成功返回后，该入口加入 Runtime 的 started 列表，由 Runtime 在正常关闭或后续入口失败时调用 `stop`；
- Runtime 不对失败或尚未尝试启动的入口调用 `stop`。因此失败入口不能依赖 Runtime 补救自己的部分初始化；
- `stop` 释放本入口拥有的全部资源；某项清理失败仍应尝试其他清理，返回附加 diagnostics。Runtime 同样继续停止其余已启动入口。

第三个入口初始化失败时，第三个入口先完成自身回收，再由 Runtime 停止第二、第一入口。factory 抛错时，由于尚未获得外部资源，可以丢弃该内存对象；此前已启动的入口仍需停止。实现按拓扑逐个执行 factory → start，不预先实例化整张图。

上述是协作式清理契约，不保证任意挂死代码都能被中断。关闭 deadline 到达后，Runtime 记录未完成清理的入口并交由 host 的终止策略处理，不得把超时报告成资源已释放；超时与 host 终止行为由 S6 验证。

`ready` 是 Runtime 状态与 host adapter callback，不通过领域 Event 广播。只有所有必需入口成功启动后才能进入 ready。

Foundation 不定义 `request`、`workspace` 或租户作用域容器。请求用户、WorkspaceRef 和事务等上下文必须显式作为参数传递；真实重复模式出现后再考虑通用 context helper。

### 5. Runtime Adapter

Runtime Adapter 提供平台宿主能力，例如 Web server 接入、浏览器入口、桌面窗口或移动生命周期。它可以消费 Graph 和公开 Services，但不能修改产品依赖图或引入未声明 Kit。

每个构建目标必须只有一个 host adapter，可以组合多个明确声明的 capability adapter。缺失目标 capability 在编译期失败。

### 6. Diagnostics

所有 Foundation 错误包含：

```ts
interface Diagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: { file: string; line?: number; column?: number };
  related?: Array<{ message: string; file?: string }>;
  suggestedFix?: { kind: string; safe: boolean };
}
```

错误码一经稳定发布，在同一 major 内不得改变含义。文本可改善，自动化只依赖 code 和结构字段。

## 验收场景

1. 一个不安装 Workspace、Database 或 UI Kit 的命令行产品可以启动；
2. remote-only 参考 SaaS 只通过 Kits 获得 Identity、Workspace 和 Database；
3. Runtime 在无源码扫描和无网络解析情况下仅凭 Graph 启动；
4. 第三个入口启动失败时，前两个入口按反序清理且 stop 可重入；
5. web target 不包含 server entry 或 server secret；
6. diagnostics 的文本变化不破坏 JSON 消费者。

## 备选方案与取舍

| 方案 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- |
| 全栈 opinionated core | 首次功能多 | 产品耦合且难裁剪 | 拒绝 |
| 微内核加运行时插件 | 动态灵活 | 安全、版本和故障模型过早复杂 | 拒绝 |
| 编译期组合 + 极小 Runtime | 可检查、可裁剪、升级面较小 | Compiler 责任较重 | 采用 |

接受的代价是 Kit 不能在生产运行中随意安装。若未来出现真实最终用户插件需求，应使用独立 External Plugin 信任模型。

## 重审触发条件

- 多数 Runtime Adapter 重复实现同一种作用域管理；
- 编译期组合无法满足真实部署的动态能力发现；
- 五类职责无法保持单向依赖。
