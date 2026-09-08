# S8 UI 候选与浏览器预安装审查

## 状态与有效期

2026-09-08 完成文档级预安装审查，只批准后续 `A1-S8-02` 在审查仍有效时用 exact versions 实现 conformance runner。审查于 2026-12-07，或任一版本、integrity、browser revision、解析树、license、script、advisory、provenance 变化时失效，以先到者为准。

本次没有修改仓库 package/lock、下载 browser binary、运行浏览器或生成截图。本记录不是 `security/dependencies.json` 生产基线，不解除 SBOM、签名、source approval、发布或人工 accessibility review 门禁。

## 1. 决策驱动

- 公共 Route/Navigation/Shell Contract 保持 JSON 可序列化，React/router/primitives 只存在于 UI adapter。
- 优先成熟的 headless/accessibility primitives，不再造 focus、keyboard、overlay 与国际化底层。
- exact package、browser revision、font 与 CI identity 进入 transcript；不允许 floating tag、远程 font 或运行时下载。
- install/build scripts 默认禁用；browser binary 只由独立、可审计步骤下载，普通 `pnpm install` 不隐式取网。

## 2. 采用候选

| Package | 用途 / license | Integrity / unpacked size | 结论 |
| --- | --- | --- | --- |
| `react@19.2.8` | runtime / MIT | `sha512-PWaYA1L/q9u2u7xYQi+Y3L3Yfnie7XyLeaJICV1MGD6LprsBxcAqGjYyr0eY3p+QdsA+x/Irkt4Qif8D63+Sbw==` / 171,598 B | npm provenance；无 runtime dependency |
| `react-dom@19.2.8` | DOM adapter / MIT | `sha512-rVprimfGBG3DR+Tq0IQG2DT5PxKth1WIGDmj5yPmlzr4YBe7uyE+Du4oVqTDXZSHGGGXRtTJEGSSePyQCMBglQ==` / 7,319,407 B | npm provenance；`scheduler ^0.27.0`；peer React exact minor |
| `react-router@8.3.1` | Data Mode router / MIT | `sha512-TEOpiO2g0TJHEOJeRVv4amUFun9v1npCKszvcquNvzETUtJ8udV86ah5eFoHT7g26bsBvT6EiIhqulR8eDF++A==` / 2,800,441 B | Node `>=22.22.0`；npm provenance；只允许 public API |
| `react-aria-components@1.21.1` | accessible primitives / Apache-2.0 | `sha512-J88WflYY0z+EhLX0ce+GjFlQ3ag3ubIgfUTjpKSrBQBu92Xtl4Ub9o118HItUddtbk1Ido0jzyPy94/klZy1hg==` / 6,586,272 B | 7 direct dependencies；registry metadata 未返回 attestation，保留 provenance blocker |
| `@playwright/test@1.63.0` | browser runner / Apache-2.0 | `sha512-oxMK4vllB9RK5NQ2l1pq1IfOf2AvnEuj/vYGDj0H2nMtmtZpKtCwt/l00GEO6xjGfpBNAvjovvYdCm50dRQkpQ==` / 28,544 B | Node `>=20`；npm provenance；dependency exact `playwright@1.63.0` |
| `@axe-core/playwright@4.13.0` | a11y bridge / MPL-2.0 | `sha512-6YLx+kxXu5GJceG4ozFg+33a2EMTdjYwWGloJ3sb9Kta5pp+ZNS53uxGVog5JetIY8s++P5UrtX+cri+u0VAVg==` / 47,180 B | npm provenance；发布 manifest 含高风险 `prepare`，安装必须禁 scripts |
| `axe-core@4.13.0` | a11y engine / MPL-2.0 | `sha512-UzGt8zg7Ny8djbYMhxl2zuEevVa7r2gJjYY5Lwr1xM7+XU2nd6CkIWFTVcCIbAP63vSz71NaVyyuSk9lHKcy0A==` / 3,113,323 B | npm provenance；不使用全局 rule disable |
| `@types/react@19.2.18` | React types / MIT | `sha512-AnzbBERsrLKtk2XSfTbYRLjQPdy116Sty4q+T+Bp3IC4l6jNBvreVPAHmpq9qhXQM7CXZPjLVmGMw9sy+hxQ3w==` / 408,503 B | 依赖 `csstype ^3.2.2`，lock 必须固定 |
| `@types/react-dom@19.2.7` | DOM types / MIT | `sha512-I8bPpDLcHBv1qiIiXDCy71Rt8eQDKJP0sMSWJphDdAcdqiJ1sGpZamavoEIRZmYzjia9LuEb2HlYdDpmoENpvQ==` / 33,574 B | peer `@types/react ^19.2.0` |
| `@fontsource-variable/inter@5.3.0` | deterministic fixture font / OFL-1.1 | `sha512-OupL48va4JNofb97w6NYeF9S7W/kHNKM0Er8Dem5nqi4jeOLrVJDoE8tZEpnMJmtkvNbB1EIPPwHcdkF6b1oUA==` / 1,909,049 B | npm provenance；只打包 S8 需要的字体资产 |

源码仓库分别为 [React](https://github.com/facebook/react)、[React Router](https://github.com/remix-run/react-router)、[React Spectrum/Aria](https://github.com/adobe/react-spectrum)、[Playwright](https://github.com/microsoft/playwright)、[axe-core npm](https://github.com/dequelabs/axe-core-npm)、[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) 和 [Fontsource](https://github.com/fontsource/font-files)。上述 package 均有近期稳定发布与公开维护仓库；时间点活跃不替代后续升级审查。

## 3. 解析树、scripts 与 advisory

使用 npm `10.9.8` 在一次性临时目录执行 exact `package-lock-only --ignore-scripts --omit=optional` 解析，共 27 个 dependency nodes。license 集合：MIT 12、Apache-2.0 11、MPL-2.0 2、OFL-1.1 1、0BSD 1；lock metadata 没有 `hasInstallScript` 节点。`npm audit --package-lock-only --omit=optional --json` 报告 0 low/moderate/high/critical，这是 2026-09-08 的 registry advisory 快照，不证明没有未知漏洞。

`@axe-core/playwright` 发布 manifest 的 `prepare` 会运行 `npx playwright install && npm run build`。尽管 registry tarball/lock 没把它标成 consumer install hook，未来仍必须执行 `pnpm add --save-exact --ignore-scripts`，对账 lock 的 `requiresBuild`/script allowlist，并确认安装期间没有 browser/network side effect。禁止为了它全局允许 scripts。

React Aria 的解析面明显大于 Base UI/Radix 单 primitive，但它把 keyboard、touch、focus、internationalization 和 accessible state 作为统一 primitive 能力，减少 Shell 自建交互机制。只有实际 bundle trace 和 corpus 通过后才保留；tree 中任何未审查新 package、optional peer、native binary 或 install hook 都停止实施并复审。

## 4. Browser artifact identity

`playwright-core@1.63.0` registry tarball 的 `browsers.json` 固定：

```text
chromium / chromium-headless-shell  revision 1243  version 153.0.8010.12
firefox                             revision 1543  version 155.0
webkit                              revision 2359  version 26.6
ffmpeg                              revision 1011
```

Playwright package integrity 固定 browser registry 输入，但 browser CDN artifacts 是额外供应链对象。`A1-S8-02` 下载前必须记录实际 URL、archive SHA-256、executable identity、cache location、下载日志和 Playwright host requirement；缓存恢复后重新校验。不得运行 `npx -y`、使用浏览器 stable channel 或从未知 mirror 自动降级。

官方 Playwright Docker image 当前不作为 frozen S8 runner：版本 tag 仍是可变引用且本次没有取得/验证 exact multi-arch digest、SBOM 和 provenance。先使用 GitHub `ubuntu-24.04` runner + Playwright-managed revisions，并把 runner `ImageVersion` 写入证据；若视觉噪声证明 label 不足，再单独审查并固定 image digest，不能直接加 floating container tag。

## 5. 运行与数据安全

- S8 fixture server 只监听 `127.0.0.1` 随机端口；browser context 默认阻断外网，只允许本地静态资产/API fixture。
- 不加载远程 font、analytics、extension、用户 profile、credential、cookie 或生产数据；trace/screenshot 使用合成数据。
- browser cache、trace、actual/diff screenshot 是 CI artifact，不进入 canonical transcript；设置有限 retention，失败日志不含绝对 home/path。
- Playwright browser 以非 root、sandboxed 默认配置运行；不为通过测试增加 `--no-sandbox`、任意 certificate ignore 或全局 web-security disable。
- 只测试仓库可信 fixture，不把 Playwright image/browser 变成通用不可信网页抓取环境。

## 6. 替代方案

| 方案 | 优点 | 代价与结论 |
| --- | --- | --- |
| `@base-ui/react@1.8.0` | headless、MIT、npm provenance | 作为 React Aria 无法保持边界/稳定性时的第一退路；不并装比较 |
| Radix per-primitive packages | 成熟、细粒度 | package/peer 图碎片化，Shell 需要自行拼更多交互语义；本轮不选 |
| React Router Framework Mode | route module、loader/action 集成完整 | file/build convention 侵入 Blankspace Compiler ownership；拒绝 |
| TanStack Router | 强类型 route/search | 增加不同 codegen/route type model，当前没有证据优于既定 React Router；保留失败后 RFC 重开 |
| Tailwind / CSS-in-JS runtime | 开发便利或动态主题 | 增加构建/运行依赖且不是 S8 语义验证必要条件；拒绝本轮 |
| 系统字体 / 远程字体 | 无 package 或资产维护 | 跨 runner 不确定或引入运行时网络；拒绝 canonical baseline |
| 只跑 Chromium | 矩阵更快 | 无法证明 WebKit/Firefox 键盘、focus 与 route 行为；拒绝 |
| 跨浏览器共享 screenshot | 表面覆盖更广 | renderer/font 差异造成无意义 diff；只保留 Chromium canonical pixels |

## 7. 回滚与复审

Spike 回滚应删除 future exact dev dependencies、S8 runner/fixtures/baselines 和 browser cache；不触碰用户数据、品牌原始资源或公共 Contract。删除 baseline 不等于视觉变化已获批准。

以下任一情况触发复审：exact version/integrity/revision 变化、React Router/Aria major、license/script/advisory/provenance 变化、pnpm tree 增加节点、browser CDN hash 漂移、需要 remote font/browser channel、Ubuntu image drift 导致不可解释 visual diff、公共 contract 暴露 library types，或候选无法满足双 Shell/a11y corpus。

## 8. 可复现查询

```bash
npm view <exact-package> version license engines dependencies peerDependencies scripts dist repository --json
npm install --prefix <temporary-directory> --package-lock-only --ignore-scripts --omit=optional --save-exact <exact-packages>
npm audit --prefix <temporary-directory> --package-lock-only --omit=optional --json
npm view playwright-core@1.63.0 dist.tarball
```

读取 `playwright-core` tarball 中的 `package/browsers.json` 只用于 metadata 审查，不下载 browser binary。首次真实安装与下载属于 `A1-S8-02`，必须产出新的 lock/browser evidence。
