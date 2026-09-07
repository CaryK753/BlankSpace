# A1-S6-02 Server host runner

## 状态

- Work item: `A1-S6-02`
- Status: complete
- Date: 2026-09-07

## TODO

- [x] 以禁用安装脚本的方式精确安装 `fastify@5.12.3`，复核 lockfile 与已审查依赖集合。
- [x] 实现真实 loopback Server host、稳定 diagnostics 与共享有界 stop。
- [x] 实现冻结的十场景 core corpus、正反序双轮和 canonical hash。
- [x] 实现本地 POSIX `SIGTERM` / `SIGINT` 子进程 corpus 与 timeout 非零退出证据。
- [x] 增加 transcript schemas、基线和定向测试。
- [x] 运行 build、typecheck、S2-S6 tests 和 docs verification。
- [x] 更新 S6 Spike、work-item evidence 与 project status，开放 `A1-S6-03`。
- [x] 提交、同步远端并核对 GitHub Actions。

## 边界

- 不实现 production Runtime/API、业务路由、Identity、Database、TLS、WebSocket 或 SSE。
- 不新增 HTTP client；网络请求使用 Node 24 内置 `fetch`。
- 不在本项作 Linux/macOS/Windows portability 结论。

## 本地证据

- 环境：macOS 27.0 arm64、Node v24.20.0、pnpm 10.32.1、Fastify 5.12.3、Undici 7.29.0。
- Core：十场景正反序一致，matrix hash `cf82465d0667b1a58f46bbfa9c2aa65a3247cff53ac11e3d3fcf63590cdd78eb`；listen 失败先反序回滚 entries，再由子进程非零退出。
- Signal：真实 `SIGTERM` 与 `SIGINT` 各触发两次，共享一次 shutdown；server close 与 A/B entry stop 各一次。
- Timeout：request/background 子进程先 IPC 上报 pending owners，再以状态 1 退出；未触发父进程 hard-kill deadline。
- 验证：build、typecheck、147 个 Vitest 测试、S1～S6 corpus 与 docs verification 全部通过。
