# Service 调用与 Event 生命周期文档

日期：2026-09-05

## TODO

- [x] 识别跨 Kit transaction context 与数据所有权冲突
- [x] 明确 Service 调用上下文边界
- [x] 明确 Event 在 Runtime 各状态的行为
- [x] 同步开发者文档、S5 矩阵和 RFC 基线
- [x] 校验文档一致性

## 读者测试修正

- 删除 Kit 文档中绕过 Registry Draft 的旧 `setup()` 实例注册示例，统一为 `register + provideFactory`。
- 明确 ready 是 Runtime 的单一状态转换，不是 entry hook。

## RFC 基线变更说明

RFC-0002 从 `30626b0705e3fec1d3038ee98fc510aa1e8e00135c4bb45bd445a1494ea42804` 更新为 `55beeabb43a5c873926c92b2d1c1266259f9971b6467b2c07cd61c68fad3520c`。

原因：删除公共 transaction context，补充 Event 可调度状态、嵌套深度、因果字段和关闭排空语义。相关 Runtime 与 S5 fixtures 尚未实现，RFC 保持 Proposed。

## 非目标

- 不设计分布式事务、通用 request scope 容器或 durable Event transport。
- 不实现 Runtime。
