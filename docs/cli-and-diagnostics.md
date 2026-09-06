# CLI 与诊断契约

本文定义 Blankspace CLI 的目标公共表面和统一诊断行为。除仓库 `package.json` 已存在的验证脚本外，`blankspace` 命令当前尚未实现。Diagnostic Envelope 的机器草案见 [`diagnostic-envelope-v1.schema.json`](schemas/proposed/diagnostic-envelope-v1.schema.json)。

## 1. 命令状态

| 命令组 | 目标阶段 | 当前状态 |
| --- | --- | --- |
| `create`、`dev`、`check`、`inspect graph/service`、`test <suite>` | Phase 1A/1B | Unavailable |
| `module create`、`kit add` | Phase 1B | Unavailable |
| `test --affected/--all`、`build --all-targets`、`migrations verify`、`explain error`、`doctor`、`fix` | Phase 1B/1C | Unavailable |
| `upgrade --check/--plan/--apply/--verify/--restore` | Phase 1C | Unavailable |
| `inspect clients`、原生 client build | 后续 Runtime milestones | Unavailable |
| `pnpm verify:docs`、`pnpm test:s1`、`pnpm typecheck` | 当前仓库验证 | Available |

Unavailable 命令不得生成半成品、伪造成功或静默降级到另一 preset。

## 2. 公共命令

```text
blankspace create <directory> --preset <id> [--json]
blankspace dev [--target <id>]
blankspace check [--json]
blankspace module create <id> [--json] [--dry-run]
blankspace kit add <id> [--adapter <id>] [--json] [--dry-run]
blankspace inspect graph [--client <id>] [--json]
blankspace inspect service <contract> [--json]
blankspace inspect clients [--json]
blankspace explain error <code> [--json]
blankspace test <suite> [--json]
blankspace test --affected [--since <revision>] [--json]
blankspace test --all [--json]
blankspace build --all-targets [--json]
blankspace migrations verify [--json]
blankspace doctor [--json]
blankspace fix --from <diagnostics.json> [--code <code>...] (--dry-run | --apply) [--json]
blankspace upgrade <version> --check [--json]
blankspace upgrade <version> --plan <path> [--json]
blankspace upgrade --apply <path> [--json]
blankspace upgrade --verify <path> [--restore-on-failure] [--json]
blankspace upgrade --restore <path> [--json]
```

同一操作的人类输出与 JSON 输出必须表达相同结论。`--json` 禁止进度动画和非 JSON stdout；日志写 stderr。支持 `--dry-run` 的写命令不得修改文件、lock、数据库或外部系统；只读命令不提供多余的 `--dry-run`。

`<path>` 是 plan 文件。`--check` 求解目标版本但不创建 plan；`--plan` 将已冻结输入和变更写入指定路径；`--apply`、`--verify` 和 `--restore` 都从 plan 读取源/目标版本及恢复点，因此不再接受位置参数 `<version>`。`--apply` 进入 `applied-unverified`，`--verify` 成功才完成新 lock 标记；`--restore` 只恢复代码、配置和两份 lock，不回滚数据库 migration。`--restore-on-failure` 只允许与 `--verify` 同用：验证失败后立即执行相同 plan 的代码级 restore，并在 JSON 结果中分别保留 verify 与 restore 状态。

`test <suite>` 运行框架维护者发布的具名 conformance suite，例如 `runtime-lifecycle` 或 `compiler-fixtures`；未知 suite 返回 CLI 使用错误。`test --affected` 面向产品增量反馈，`test --all` 面向发布全量验证，三者不能组合。

## 3. 退出码

| 退出码 | 类别 |
| --- | --- |
| `0` | 成功，且请求的验证全部通过 |
| `1` | 已完成执行，但存在配置、契约或测试失败 |
| `2` | CLI 使用错误或不支持的参数 |
| `3` | 当前能力 Unavailable 或目标工具链缺失 |
| `4` | 安全、信任或 release policy 拒绝 |
| `5` | 外部系统或基础设施失败 |
| `130` | 用户中断 |

具体 diagnostic code 比退出码更稳定；退出码只供 shell 做粗粒度分支。多个失败使用最严重类别作为进程退出码，完整列表仍全部输出。

## 4. Diagnostic Envelope

```json
{
  "schemaVersion": "1",
  "command": "blankspace check",
  "context": {
    "projectRoot": ".",
    "graphHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "lockHash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "status": "failed",
  "diagnostics": [
    {
      "code": "BS1024",
      "severity": "error",
      "category": "boundary",
      "message": "documents imports an internal billing module",
      "location": {
        "file": "product/modules/documents/service.ts",
        "line": 8,
        "column": 1
      },
      "related": [],
      "help": "Import BillingService from the Kit public entry.",
      "fix": {
        "kind": "replace-import",
        "safe": true
      }
    }
  ],
  "artifacts": []
}
```

必需规则：

- `code` 在同一 schema major 内保持语义稳定；
- `message` 面向人类，不能作为自动化解析接口；
- 文件路径使用 workspace-relative `/` 路径，不输出秘密或用户主目录；
- `fix.safe=true` 只允许确定、局部、可回滚且不改变产品策略的修改；
- 需要选择 provider、执行 migration、修改生产 secret 或接受非官方 Runtime 时不得标为 safe；
- warning 不得掩盖实际构建失败，error 不得通过全局 ignore 降级。

`blankspace fix --from` 是唯一通用自动修复入口。这里的 project 指 CLI 当前仓库根，不是 Workspace Kit 的业务实体；`projectRoot` 固定为 `.`，所有路径相对该根。Graph/lock 尚未生成的早期诊断将对应 hash 写为 `null`，但仍可在重新执行原 command 后由当前 CLI 独立计算 safe fix。

Diagnostic 文件只是候选输入，不是可信代码或授权。CLI 必须忽略其中无法由当前版本重新计算的 patch：先在当前项目重跑原 command，要求 diagnostic code、location、相关 content hashes 和当前 CLI 生成的 fix 一致，再形成 change set。仅复制或伪造 Graph/lock hash 不能获得写权限。

默认批处理所有可重现且 `safe=true` 的 fixes，跳过 `safe=false` 和没有 fix 的 diagnostics，并在结果中列出 skipped reasons；`--code` 将候选限制为指定 code。两个 safe fixes 修改同一区域、任一前置 hash 失效或任一 change 越过产品拥有区域时，整个选中批次失败，不应用子集。

`--dry-run` 输出含目标文件、前置 content hash 和 patch hash 的 change set。`--apply` 把完整批次写入隔离 staging，在 staging 上重跑原 command 和受影响检查；全部通过后原子提交到工作区并输出 receipt。失败时丢弃 staging、保持工作区不变并保留新 diagnostics。

包含多个子操作的命令使用 envelope 的 `operations[]` 结构化记录每一步；顶层 `status` 是整体结论。例如 `upgrade --verify --restore-on-failure` 至少写入 `verify` 和 `restore` 两项，未执行的恢复为 `skipped`，执行过的恢复保留自身状态和 artifact hashes。自动化不得从 message 文本推断子操作结果。

## 5. Diagnostic code 分区

| 范围 | 所有者 |
| --- | --- |
| `BS1xxx` | 配置、路径、schema 与源码边界 |
| `BS2xxx` | Kit、Service、provider 与 dependency resolution |
| `BS3xxx` | Product Graph、Registry、bundle 与生成物 |
| `BS4xxx` | Runtime、client、renderer、capability 与 toolchain |
| `BS5xxx` | 数据库、migration、Workspace 与 sync |
| `BS6xxx` | 安全、供应链、证据与 release policy |
| `BS7xxx` | upgrade、codemod 与兼容性 |

新增 code 必须进入版本化 registry，并带一个失败 fixture。删除或复用旧 code 属于 breaking change。

## 6. 写操作协议

生成器、自动修复和升级命令遵循统一顺序：

```text
解析并验证输入
→ 计算 change set
→ dry-run/展示 diff
→ 写入 staging
→ 验证 staging
→ 原子提交允许修改的文件
→ 输出 receipts 与后续人工步骤
```

失败发生在提交前时恢复所有 staging 变化。数据 migration 一旦开始则进入 RFC-0010 recovery，不承诺通过文件回滚恢复数据。CLI 不自动发送消息、发布包、部署生产环境或使用签名凭据。

## 7. AI 调用要求

AI 对支持 dry-run 的写命令应优先使用 `--json --dry-run` 获取结构化 change set；对 `check`、`inspect`、`test` 等只读命令只使用 `--json`。自动化必须保留 command、退出码、diagnostics、artifact hashes 和 receipts；不得解析彩色终端文本，也不得为了得到 exit 0 修改测试或开启全局 skip/ignore。

## 8. 稳定性

命令名、JSON envelope、diagnostic code 与退出码是公共兼容面。新增可选字段可以是 minor；重命名、删除、改变默认写入范围或把只读命令改成写操作必须提升 CLI/schema major，并进入 Compatibility Manifest 与升级报告。
