# A1-S6-01 Server host 工具链与故障契约

日期：2026-09-07

## 目标

在修改依赖或实现 Server adapter 前，冻结 S6 的工具版本、runner、deadline、场景输入、稳定 diagnostics 与候选依赖审查证据。

## TODO

- [x] 阅读 S6 work item、RFC-0001、RFC-0013、测试策略、安全模型与供应链政策
- [x] 核对 Fastify、Node fetch/Undici 的当前版本和官方生命周期/信号语义
- [x] 解析 Fastify 候选的直接与传递依赖并检查许可证、install scripts 和已知漏洞
- [x] 冻结 S6 工具、环境、deadline、fixtures、diagnostics 和失败选择
- [x] 记录架构决策的上下文、替代方案、后果和复审条件
- [x] 运行 test、verify:docs 及受影响文档检查
- [x] 更新 work-item DAG、项目状态与 Agent 启动入口
- [x] 提交并同步远端仓库

## 范围边界

- 本工作项只产生设计与审查证据，不安装 Fastify，不修改 lockfile，不监听端口，不发送真实请求，不执行 OS signal runner。
- `security/dependencies.json` 及其自动门禁仍由 DEC-005 负责；本次候选审查不等同于生产依赖基线或发布批准。
- S5 保持 Provisional pass；只有后续 S6 runner 真实执行并取得证据后才评估状态提升。
