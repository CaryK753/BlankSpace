# S1：JSONC 配置与 Canonicalization

## 状态

Provisional pass

执行日期：2026-09-04。

## 目标

验证三层 JSONC 配置能够拒绝非数据表达式和重复 key，按 JSON Schema 校验，并在不同绝对目录生成一致 canonical bytes 与 SHA-256。

## 冻结输入

- `blankspace.config.jsonc`；
- `product/manifest.jsonc`；
- `product/modules/*/module.jsonc`；
- JSON Schema 2020-12；
- JSONC 仅增加行/块注释和尾逗号；
- canonical object keys 按 Unicode code unit 排序，arrays 保序，`-0` 规范为 `0`。

## 接受与拒绝 Corpus

接受：comments、trailing commas、quoted keys、finite JSON numbers、对象/数组/字符串/布尔/null。

拒绝：duplicate keys、unquoted keys、`undefined`、`Infinity`、function/call/member expressions、trailing content、schema 外字段、`../`、反斜杠与冗余 `./` 路径、未知 target 和空 Module entries。

## 执行

```bash
node --test spikes/s1-config/*.test.mjs
python3 spikes/s1-config/validate_schemas.py
```

结果：

- Node 内置测试：8/8 通过；
- JSON Schema corpus：14/14 通过；新增反斜杠、冗余 `.` 与目录逃逸失败用例；
- 跨两个随机绝对目录 hash 一致；
- spike JSONC parser 单文件 178 行，未引入运行时依赖；
- 同一行为已经移植到 `packages/compiler/src/config/jsonc.ts`；`npm run typecheck` 已在当前 Node.js 22 环境通过，Compiler 子项目显式使用 Node 类型环境。

## 限制

- 当前环境是 Node.js 22.22.3，RFC 目标是 Node.js 24 LTS；
- Ajv 严格编译和 TypeScript typecheck 已通过；`npm test` 仍因当前环境没有可执行的 `vitest` binary 而失败，不能算 Vitest 已验证；
- Python `jsonschema` 仅用于 spike 验证，不进入 Blankspace 产品依赖；
- 尚未验证 Windows path/casing 与不同 pnpm store；这些属于 S2/pnpm 路径 spike；
- 已定义 JSON value TypeScript types，但尚未生成 schema 对应 types/validators。

因此本次只能记为 provisional pass。Node 24 环境必须使用最终 validator 重跑同一 corpus，且输出错误路径需要进入 diagnostics fixture，之后 S1 才能正式通过。
