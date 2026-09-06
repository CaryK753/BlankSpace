# README 与品牌资源阶段性整理

日期：2026-09-06

## 目标

采用用户指定的 Logo 与 README 封面，重写仓库首页，使产品定位、当前实现、验证证据、架构和下一工作项能够被开发者快速理解，同时继续明确 Production No-Go。

## TODO

- [x] 核对当前机器状态、README 与品牌资源
- [x] 将用户指定图片复制到仓库品牌资源目录
- [x] 用封面、阶段状态和精简导航重写 README
- [x] 补充色彩、字体、图形语言和资源使用门禁
- [x] 验证图片引用、文档门禁与工程回归
- [x] 提交并同步远端仓库

## 验证证据

- 两张仓库图片与用户指定源文件逐字节一致。
- `fnm exec --using=24 pnpm build`：通过。
- `fnm exec --using=24 pnpm typecheck`：通过。
- `fnm exec --using=24 pnpm test`：通过（Vitest 147；S1 8；S2 4；S3 7；S4 4；S5 8）。
- `fnm exec --using=24 pnpm verify:docs`：通过（127 Markdown、20 JSONC、22 proposed schemas、10 work items）。

## 视觉边界

- Logo 使用 `docs/assets/brand/blankspace-logo.jpeg` 原图，不重绘或添加变体。
- README 封面使用 `docs/assets/brand/blankspace-readme-cover.jpeg` 原图，不拉伸、不裁剪。
- 当前只建立品牌基线，不宣称已经形成完整 Design System，也不修改 Phase 1A 的代码路线。
