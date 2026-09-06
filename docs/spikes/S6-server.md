# S6：Server Host、排空与关闭

## 状态

Draft matrix，尚未执行；Fastify、HTTP client 与 runner 版本待锁定。

## 要回答的问题

Fastify adapter 能否服从 Blankspace Runtime 的单一生命周期，在启动失败、信号和活动请求下给出有界且可诊断的关闭结果？

## 实验设置

固定一个健康端点、一个可控慢请求和一个后台任务。Runtime 拥有 start/ready/stop，Fastify adapter 只负责 listen、停止接收、请求排空与 server close。每次运行记录端口、状态转换、活动请求数、deadline 和退出原因。

## 矩阵

| 场景 | 预期结果 |
| --- | --- |
| 正常启动 | listen 成功后才 ready |
| 端口占用 | 不 ready，释放已获取资源 |
| route 注册失败 | 不开始监听 |
| SIGTERM/SIGINT | 只触发一次共享关闭过程 |
| ready 后慢请求 | 停止接收新请求，deadline 内排空旧请求 |
| 排空超时 | 报告剩余请求并非零退出 |
| 后台任务拒绝停止 | 标记 owner 与超时，不报告干净关闭 |
| 连续/并发 stop | adapter close 最多一次 |
| readiness 期间关闭 | 不再转为 ready |
| handler 异常 | 请求失败可观测，不绕过 Runtime 状态机 |

## 通过条件与失败选择

所有路径都有有界终态、稳定 diagnostic 和资源账本；进程信号不建立第二套 lifecycle。若 Fastify 无法满足矩阵，用 RFC 重开 host adapter 选择，不把生命周期所有权交给框架容器。

## 尚待冻结

Node/Fastify/client 精确版本、OS signal runner、deadline、fixtures、命令和 CI 证据。
