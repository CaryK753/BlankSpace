# 项目文档收官

日期：2026-09-05

## 目标

让产品开发者、框架贡献者和运维人员仅依靠仓库文档，就能理解 Blankspace 的边界、当前状态、实施路线、安全模型、运行责任、升级方式和未交付能力。

## TODO

- [x] 盘点全部文档、schemas、RFC 和状态文件
- [x] 修复 SecretRef、target、阶段命名等跨文档漂移
- [x] 编写威胁模型与安全边界
- [x] 编写部署和运行责任文档
- [x] 建立完整的文档阅读路径与覆盖矩阵
- [x] 更新 RFC 基线并运行机器一致性检查
- [x] 执行产品开发者、框架贡献者、运维读者测试
- [x] 修正读者测试发现的所有中高严重度问题

## 完成标准

- 不存在相互冲突的当前状态、配置语法、target 或公共边界；
- 所有本地链接有效，代码围栏成对，JSON 和 RFC baseline 可验证；
- 目标接口、未来提案和当前可执行能力能被陌生读者正确区分；
- 尚未实现的内容保留为明确门禁，不伪装成完成。

## 完成结果

- 建立产品开发者、框架贡献者、部署安全负责人和决策者四条阅读路径及覆盖矩阵；
- 补齐安全、供应链、部署运维、身份与 Session、migration 恢复、日志审计和 Secret 运维契约；
- 冻结 preset 与产品 Kit 配置的整体替换语义、Phase 1B 身份安全门禁和全部编号 RFC 基线规则；
- 产品开发者、框架贡献者、运维安全负责人最终复核均未发现剩余中高严重度问题；
- 机器校验现已扩展到 17 份 RFC、全部 JSON、配置/CLI/多客户端参考文档、Proposed schemas、本地链接与代码围栏；S1 schema corpus 14/14、JSONC 行为 8/8 和 TypeScript typecheck 通过。
- 将一次性文档校验固化为 `npm run verify:docs`，后续修改可以重复验证 JSON、Markdown、JSONC 示例和 RFC 基线。

文档收官不等于框架已交付。Node.js 24、Vitest 可执行依赖、S2～S8、Phase 1 实现、安全环境 fixtures、供应链自动化和许可证选择仍由现有路线门禁明确阻止发布；它们是后续实现工作，不是被隐去的文档完成项。

## 续审结果（2026-09-05）

- 新增集中式配置参考，逐字段区分 V1 当前 schema、未来 Compiler 和 Proposed 多客户端输入；
- 新增 CLI/Diagnostic 公共契约，冻结命令状态、退出码、JSON envelope、code 分区、自动修复选择、staging、复验、原子提交和 receipt；
- 新增 Proposed Diagnostic Envelope schema，并将文档验证扩展到整个 `docs/schemas/proposed/`；
- 修正 S1 状态：当前 Node.js 22 下 TypeScript/Ajv 已验证，Node.js 24 与 Vitest evidence 仍缺失；
- 明确 `pnpm create blankspace` 与 `blankspace create` 的关系，以及 S8 属于 Phase 1C 而非当前 1A；
- 三轮无上下文产品开发者复读提出的 7 个中高问题已全部修正，最终复核未发现剩余中高严重度文档歧义；
- 最新机器门禁覆盖 65 Markdown、20 JSONC、16 Proposed Schema、17 RFC baseline、9 proposed client fixtures、S1 8/8、schema corpus 14/14 和 TypeScript typecheck。
