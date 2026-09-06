# S6 Server 候选依赖审查

## 状态与有效期

2026-09-07 完成候选审查，仅批准 `A1-S6-02` 将 `fastify@5.12.3` 作为 exact spike dev dependency 进行 conformance。审查于 2026-12-06 或候选版本、解析树、安全公告发生变化时失效，以先到者为准。

这不是 `security/dependencies.json` 的生产基线，也不解除 DEC-005、根许可证、SBOM、provenance、签名或公开发布门禁。最终生产采用仍需 Security 与 Build/Release owner 按供应链政策复审。

## 决策驱动

- host 必须服从 Blankspace `register → start → ready → stop`，不能成为第二个 Service locator。
- 必须使用真实 loopback HTTP 验证 listen、503 closing、活动请求排空和 socket close。
- 版本、来源、完整性、脚本、许可证、维护与漏洞证据必须在 package 变更前冻结。
- fixture client 不应仅为 convenience 引入新的 runtime dependency。

## 选择

### Fastify `5.12.3`

| 字段 | 证据快照 |
| --- | --- |
| npm | `fastify@5.12.3`，latest stable；2026-09-04 发布 |
| registry integrity | `sha512-reZ8wce5VNCcufIt9AVtzZa3L4u1j8esikn7OEgHWLVpRpL5R7Y2+Xzj70OUkv5zDfzUAxXZT6cu4Rt0zr3EKA==`；下载 tarball 的 SHA-512 hex 与之匹配 |
| source | `https://github.com/fastify/fastify`；npm `gitHead` `1c991c40f9615e8d33f8004c8f8cbe35d4be7f4f` |
| license | Fastify 为 MIT；解析树只出现 MIT、BSD-3-Clause、ISC |
| tree | 15 个直接依赖；49 个解析 package；0 optional、0 peer |
| install scripts | 49 个解析 package 的 lock metadata 均为 `hasInstallScript: false` |
| audit | npm `11.19.0` 对临时 exact package-lock 执行 `npm audit --package-lock-only --ignore-scripts`：0 low/moderate/high/critical |
| maintenance | 非 archived；六名 npm maintainers；OpenJS Foundation At Large project；v5 支持 Node 20+ |

[npm package page](https://www.npmjs.com/package/fastify) 显示 `5.12.3` 为 stable latest；[Fastify v5 migration guide](https://fastify.dev/docs/v5.3.x/Guides/Migration-Guide-V5/) 记录 v5 的 Node 20+ 基线。S6 仍需用真实 corpus 证明 Node 24.20.0，而不是从最低版本支持推导兼容。

Fastify仓库在审查日保持活跃。其公开安全历史并不为空：2026-09-04 发布的四个 high advisories 和此前 advisories 均列出修复版本，最近一批要求 `>=5.12.2`；`5.12.3` 不在已公布受影响范围内。[Fastify advisories](https://github.com/fastify/fastify/security/advisories) 和 [GHSA-hwr6-493r-vm6h](https://github.com/fastify/fastify/security/advisories/GHSA-hwr6-493r-vm6h) 提供代表性证据。零 audit finding 只表示该时间点 registry advisory 结果，不等于不存在未知漏洞。

`5.12.3` 的 npm `gitHead` 可在源码仓库定位，但审查时没有对应 `v5.12.3` Git tag/release。与 `v5.12.2` 的源码比较只有版本字段修正：`package.json` 变为 `5.12.3`，内部 `VERSION` 从错误的 `5.12.1` 修为 `5.12.2`；下载的 `5.12.3` tarball 也仍报告运行时 `VERSION = '5.12.2'`。因此候选可进入 spike，但版本 evidence 必须读取 resolved package/lock，不能依赖 `fastify.version`；安装时还必须核对上述 integrity、`gitHead` 和 lock diff。缺少 tag 与 runtime identity 漂移是保留风险，阻止把本记录升级成发布批准。[source comparison](https://github.com/fastify/fastify/compare/942a2be8704244db778f8db9a0bb4951b8825156...1c991c40f9615e8d33f8004c8f8cbe35d4be7f4f)

### HTTP client：Node `fetch`

Node.js `v24.20.0` 是 MIT 许可的既有工具链，不增加 npm tree、install script 或新的 package publisher。该版本本地 `process.versions.undici` 为 `7.29.0`；`fetch` 已是 Stable，fixture 只允许访问 runner 自己的 `127.0.0.1` 随机端口，并为每个请求设置 `clientRequestDeadlineMs`。

内置 client 的升级和安全修复跟随 Node patch，不独立漂移。它不进入 npm audit，因此每次 Node patch 变更必须重新记录 `process.versions.undici` 并重跑 S6；不得把本次 Fastify audit 当作 Node/Undici 安全结论。[Node v24.20.0 release](https://github.com/nodejs/node/releases/tag/v24.20.0) 与 [Node fetch reference](https://nodejs.org/download/release/v24.20.0/docs/api/globals.html#fetch) 是版本和 API 依据。

## 直接依赖与能力面

审查日的 15 个直接依赖范围为：

```text
@fastify/ajv-compiler ^4.0.5
@fastify/error ^4.0.0
@fastify/fast-json-stringify-compiler ^5.0.0
@fastify/proxy-addr ^5.0.0
abstract-logging ^2.0.1
avvio ^9.0.0
fast-json-stringify ^7.0.0
find-my-way ^9.6.0
light-my-request ^6.0.0
pino ^9.14.0 || ^10.1.0
process-warning ^5.1.0
rfdc ^1.3.1
secure-json-parse ^4.0.0
semver ^7.6.0
toad-cache ^3.7.0
```

Fastify需要监听本地 TCP、读取不可信 HTTP 输入并写响应；默认不执行外部网络请求或读取 credential。S6 设置 `logger: false`，避免 Pino timestamp/worker/file transport 进入 canonical evidence。任何未来 logger transport、TLS key、proxy trust、upload 或 plugin 都需要独立能力与供应链审查，不能继承本记录。

Fastify发布包声明 test、build 和 `prepublishOnly` 等维护脚本，但消费安装路径没有 `preinstall`、`install` 或 `postinstall`；全部解析 package 的 lock metadata 也未标记 install script。后续必须用 `--ignore-scripts` 安装，并检查 lockfile 没有新增 `requiresBuild`/install-script package。

## 解析树快照

使用 npm `11.19.0` 在临时目录执行 exact、package-lock-only、ignore-scripts 解析；临时 `package-lock.json` SHA-256 为 `776e81098006488cc91fc12e5e12c4548c5d541a6a453bae3702542f31766fc3`。该 hash 是审查快照，不是仓库 lock authority；实际 pnpm lock 必须逐项比较。

```text
@fastify/ajv-compiler@4.0.6
@fastify/error@4.2.0
@fastify/fast-json-stringify-compiler@5.1.0
@fastify/forwarded@3.0.2
@fastify/merge-json-schemas@0.2.1
@fastify/proxy-addr@5.1.0
@pinojs/redact@0.4.0
abstract-logging@2.0.1
ajv-formats@3.0.1
ajv@8.20.0
atomic-sleep@1.0.0
avvio@9.3.0
cookie@1.1.1
dequal@2.0.3
fast-decode-uri-component@1.0.1
fast-deep-equal@3.1.3
fast-json-stringify@7.0.1
fast-querystring@1.1.2
fast-uri@3.1.7
fast-uri@4.1.4
fastify@5.12.3
fastq@1.20.3
find-my-way@9.9.0
ipaddr.js@2.5.0
json-schema-ref-resolver@3.0.0
json-schema-traverse@1.0.0
light-my-request@6.6.0
on-exit-leak-free@2.1.2
pino-abstract-transport@3.0.0
pino-std-serializers@7.1.0
pino@10.3.1
process-warning@4.0.1
process-warning@5.1.0
quick-format-unescaped@4.0.4
real-require@0.2.0
real-require@1.0.0
require-from-string@2.0.2
ret@0.5.0
reusify@1.1.0
rfdc@1.4.1
safe-regex2@5.1.1
safe-stable-stringify@2.5.0
secure-json-parse@4.1.0
semver@7.8.5
set-cookie-parser@2.7.2
sonic-boom@4.2.1
split2@4.2.0
thread-stream@4.2.0
toad-cache@3.7.4
```

## 考虑过的替代方案

| 方案 | 优点 | 代价与结论 |
| --- | --- | --- |
| Fastify `5.12.2` | 有 Git tag/release；包含最新安全修复 | 运行时版本报告 `5.12.1`，且不是 npm latest；拒绝。5.12.3 仍有 identity 漂移，但可用 lock/package metadata 明确规避 |
| Fastify `6.0.0-alpha.3` | 接近下一 major | alpha 且扩大兼容风险；拒绝 |
| NestJS | 模块、DI 与生态完整 | 与 Blankspace lifecycle/Service graph 重叠；沿用 RFC-0013 的拒绝结论 |
| `light-my-request`/`fastify.inject()` | 快、无 socket | 不能证明 listen、连接拒绝或排空；只可做 Fastify 自身单元辅助，不作 S6 client |
| 直接 `undici` dependency | 可控制 dispatcher/pool | S6 loopback 不需要额外 API；增加 publisher/tree；拒绝 |
| Node `http.request` | 零依赖且底层可控 | 样板和连接管理更复杂；保留为 fetch 无法稳定表达 closing fixture 时的重审选项 |

## 后果与复审

正面后果是 host 原语小、HTTP client 零新增依赖、真实网络语义可验证；负面后果是 Fastify tree 仍有 49 个 package，且公开安全历史和无 `v5.12.3` tag 增加持续复核成本。`light-my-request` 与 Pino 即使不直接用于 S6 也存在于解析树，仍计入审查面。

以下任一条件触发重新审查：npm latest/lock 解析变化、Fastify/任一传递依赖新 advisory、Node patch 或内置 Undici 变化、需要 TLS/WebSocket/SSE/logger transport、S6 无法通过活动请求排空、审查到期。复审前不得提升版本范围或自动接受新的 lock diff。

## 可复现命令

```bash
npm view fastify@5.12.3 name version license repository dependencies scripts maintainers time dist --json
npm install --prefix <temporary-directory> --package-lock-only --ignore-scripts --no-audit --no-fund --save-exact fastify@5.12.3
npm audit --prefix <temporary-directory> --package-lock-only --ignore-scripts --json
fnm exec --using=24 node --print "process.versions.undici"
```
