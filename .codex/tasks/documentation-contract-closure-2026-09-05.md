# 文档公共契约收口

日期：2026-09-05

## TODO

- [x] 补齐 provider 选择与 optional feature 的 V1 配置语法和 schema corpus
- [x] 统一 upgrade、build、migration 与发布验证 CLI
- [x] 定义可在 Reference SaaS 之前运行的性能 benchmark harness
- [x] 为供应链 No-Go 增加分阶段解锁路线和源码授权证据
- [x] 补齐 S3、S4、S6、S7、S8 风险实验文档；复核确认此前报告的 S5 残留实际来自连续命令输出中的 CR1 段落，S5 无需删除
- [x] 运行机器校验和无上下文读者测试，并修正复读发现的升级真源、migration 分支、预算循环和 SC1 覆盖问题

## 完成标准

- 配置与 CLI 的权威文档、schema、示例及里程碑不存在冲突；
- 性能与供应链门禁都有可执行的前置交付物、负责人和证据路径；
- S1～S8 每项至少具有可冻结的实验矩阵，状态不夸大执行证据；
- `npm run verify:docs`、S1 schema corpus 和相关 TypeScript 检查通过；
- 陌生产品开发者与框架贡献者复读不再发现中高严重度歧义。

## 完成结果

- V1 配置增加可机器校验的 `serviceProviders` 与 `enabledFeatures`；
- CLI 统一 plan 真源、verify/restore、复合操作结果和 migration 恢复组合；
- Phase 1 性能预算具有独立 harness、无循环冻结时点、确定 percentile/取整/CI 校准算法；
- 供应链增加 Phase 1A、SC1 和许可证三条解锁路线；
- S3、S4、S6、S7、S8 与 SC1 均有 Draft matrix，状态仍明确为未执行；
- 两类无上下文读者复核最终未留下中高严重度问题。

## 长期维护性续审

- [x] 建立集中式未决策与门禁台账
- [x] 将安全、供应链、性能与 spike 的未决项接入台账
- [x] 复核状态词、未来时态和文档导航
- [x] 重跑机器校验与无上下文维护者测试，并拆分 S3～S7/S8 及四类客户端门禁、补全 SC1 证据范围
