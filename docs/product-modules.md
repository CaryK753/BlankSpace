# Product Module 规范

## 1. 定位

Product Module 是具体产品中的业务模块，以 `product/modules/<id>/` 目录为开发单位。它使用 Kits 提供的基础设施，实现最终用户能够感知的功能。

Product Module 不是独立 npm package，也不是运行时插件。大型模块未来可以提升为 package，但 Phase 1 只实现目录模块。

## 2. 与 Kit、Plugin 的区别

| 维度 | Optional Kit | Product Module | External Plugin |
| --- | --- | --- | --- |
| 目的 | 跨产品基础设施 | 当前产品业务 | 最终用户第三方扩展 |
| 形态 | 构建时 package | 产品目录 | 未来安装单元 |
| 所有者 | Blankspace 或兼容作者 | 产品团队 | 第三方 |
| 信任 | 构建依赖 | 产品内部可信代码 | 默认不可信 |
| 生命周期 | 随框架或独立版本 | 随产品版本 | 需要兼容、权限和沙箱 |
| Phase 1 | 最小集合 | 支持 | 不支持 |

## 3. Product Directory

```text
product/
├── manifest.jsonc
├── coordinators/
├── shared/
│   ├── domain/
│   ├── ui/
│   └── utils/
├── modules/
│   ├── documents/
│   │   ├── module.jsonc
│   │   ├── public.ts
│   │   ├── service.ts
│   │   ├── events.ts
│   │   ├── api.ts
│   │   ├── frontend/
│   │   ├── backend/
│   │   ├── data/
│   │   └── tests/
│   └── copilot/
├── frontend/
├── backend/
├── data/
├── theme/
├── assets/
└── locales/
```

Product Directory 必须纳入版本控制，代码所有权归产品。长期应位于产品自己的仓库；早期原型可以与 framework 同仓。

## 4. 模块描述符

最小模块只需要 ID 和贡献：

```jsonc
{
  "$schema": "@blankspace/contracts/schemas/module.schema.json",
  "schemaVersion": "1",
  "id": "about",
  "entries": { "web": "./frontend/index.ts" }
}
```

当前 V1 的复杂模块可以声明 Service 依赖和运行时入口：

```jsonc
{
  "$schema": "@blankspace/contracts/schemas/module.schema.json",
  "schemaVersion": "1",
  "id": "documents",
  "requires": ["blankspace.workspace@^1", "blankspace.editor@^1"],
  "optional": [{ "service": "blankspace.files@^1", "feature": "files" }],
  "entries": {
    "shared": "./shared/index.ts",
    "server": "./backend/index.ts",
    "web": "./frontend/index.ts"
  }
}
```

Service/Event/API/UI/migration 等 declarations 是 Product Compiler 的目标能力，但尚未进入正式 Module V1 schema；在对应 schema major 与 resolver 实现前不能把这些字段写入当前 descriptor。

上例 `declarations` 是 RFC-0022 后的目标 schema，当前 V1 schema 尚未实现并应继续拒绝这些字段。Phase 1A 必须先升级 schema：Service/Event/API/Job/UI/migration/policy 以静态文件引用和 content hash 进入 Product Graph；Runtime entry 只能绑定已声明 ID，Compiler 对少报和多报都失败。Compiler 不执行产品代码来发现依赖或贡献。

Phase 1 描述符只接受 `shared`、`web` 和 `server` entries。未来由 RFC-0015 增加 `react-desktop`、`react-mobile`、`swiftui`、`compose` 等 UI Family entries；当前 schema 必须拒绝这些未来字段。

开发者声明需要哪些 Service，不需要理解底层 Kit 初始化顺序。Product Compiler 负责确认这些 Service 由已启用 Kit 或其他合法模块提供。

## 5. 目录边界

Phase 1 TypeScript 模块的对外接口集中在 `public.ts`：

```ts
export type { Document, DocumentId } from './domain/types';
export { DocumentsService } from './service';
```

其他模块可以：

```ts
import { DocumentsService } from '#product/documents';
```

不得跨目录读取内部文件：

```ts
import { internalRepo } from '../documents/data/internal-repo';
```

Product Compiler 或 lint rule 应检查：

- Phase 1 TypeScript 跨模块导入只能经过 `public.ts`；
- 前端入口不能导入服务端代码；
- 客户端入口不能读取 server secret；
- 模块实际依赖与 `requires` 一致；
- 被裁剪模块没有残余 import；
- 不存在循环模块依赖。

未来 Swift/Kotlin UI Family 不导入 `public.ts`。跨语言公共事实放在 `contracts/` schema，由 Runtime generator 产生 TypeScript、Swift 和 Kotlin contract modules；平台 renderer 只依赖生成 Contract、Screen binding 和本平台公开 entry。Swift Package 与 Gradle module 的可见性由对应 Runtime verifier 检查。无论语言如何，跨 Product Module 依赖仍必须在 descriptor 中声明，禁止从另一个模块的 `react/`、`apple/`、`android/` 或 `server/` 目录 deep import。

## 6. 模块间交互

需要结果时调用公开 Service：

```ts
const documents = use(DocumentsService);
const document = await documents.get(documentId);
```

通知既成事实时发布 Event：

```ts
await events.publish('documents.created', {
  documentId,
  workspaceRef,
});
```

跨多个 Kits 或 Modules 的产品流程放在 Coordinator：

```ts
export class PublishDocumentCoordinator {
  constructor(
    private readonly documents: DocumentsService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService
  ) {}

  async publish(documentId: string) {
    const document = await this.documents.publish(documentId);
    const preview = await this.files.createPreview(document);
    await this.notifications.documentPublished({ document, preview });
    return document;
  }
}
```

不为普通模块调用引入 Command Bus、Query Bus 或 Workflow DSL。

## 7. 前端贡献

模块可以贡献：

```ts
defineFrontendModule({
  routes: [documentsRoute],
  navigation: [documentsNavigation],
  commands: [createDocumentCommand],
  settings: [documentsSettings],
  renderers: [documentRenderer],
  slots: {
    'workspace.sidebar.footer': DocumentsShortcut,
  },
});
```

优先使用语义贡献，例如 route、command、navigation 和 renderer。Visual Slot 只用于确实需要指定视觉位置的扩展。

每项贡献必须有稳定 ID、输入类型、冲突规则和排序规则，不依赖目录扫描顺序决定优先级。

## 8. 后端与 API

```ts
defineBackendModule({
  services: [DocumentsService],
  routes: [documentsApi],
  jobs: [IndexDocumentJob],
  eventHandlers: [onWorkspaceDeleted],
});
```

普通 SaaS API 与 local-first 同步协议保持分离：

```text
远端权威业务数据 → typed HTTP/RPC API
本地权威或 replicated 数据 → Local-first Store + Sync Protocol
```

Phase 1 不使用一个万能 Operation API 同时包装 HTTP、本地调用和 CRDT 更新。

## 9. 数据贡献

Product Module 可以拥有产品数据表、schema 和 migrations。规则与 Kit 数据所有权一致：

- migration ID 在产品内全局唯一并包含模块命名空间；
- 模块内 migration 使用显式顺序；
- 模块间顺序依据显式依赖；
- 其他模块不能直接修改本模块数据；
- 删除模块代码不自动删除生产数据；
- 数据清除必须通过显式 migration 或管理操作。

模块生命周期区分：

```text
disable       不启用功能，保留代码和数据
remove code   构建不再包含模块，保留数据
archive data  转换为只读或归档格式
purge data    显式且可审计地清除数据
```

## 10. 自动发现

Phase 1 只扫描一层：

```text
product/modules/*/module.jsonc
```

不递归把子目录自动解释成独立模块。大型领域可以在自己的模块目录中组织子领域。Compiler 先得到扫描候选集；`product/manifest.jsonc#modules` 缺省时启用全部候选，显式存在时作为 allowlist。列表中的缺失目录是错误，未列出的候选被排除，二者不做隐式合并。

流程：

```text
扫描 module.jsonc
→ 读取 Service 依赖和运行时入口
→ 校验目录边界
→ 合并贡献
→ 为目标运行时裁剪
→ 生成 Product Graph 与静态注册表
```

自动发现结果必须稳定、可检查。生成代码放入构建目录，不写回 Product Directory。

## 11. 第三方依赖

Phase 1 由产品根 `package.json` 统一管理第三方依赖，不要求每个模块维护独立 `package.json`。

当模块确实需要独立发布、跨产品复用、私有仓库或独立依赖时，可以在未来提升为 package：

```jsonc title="未来提案，Phase 1 schema 不接受 package specifier"
{
  "modules": [
    "./product/modules/documents",
    "@company/blankspace-copilot-module"
  ]
}
```

Phase 1 不实现外部 package module，上述语法当前会被 schema 拒绝；它只记录未来演进方向。

## 12. 测试

每个模块至少验证：

- 描述符与 Service 依赖；
- 目录和运行时导入边界；
- 公共 Service 的主要行为；
- 数据 migration（如果有）；
- 目标裁剪；
- 一个主要用户流程。

框架应提供轻量 `createModuleTestRuntime()`，注入测试 Services 与 Event transport，不要求启动完整产品。

## 13. 未来多客户端布局

选择多客户端 Runtime 后，模块可以按真实需求增长，而不是一次生成所有平台目录：

```text
product/modules/documents/
├── contracts/
├── shared/
├── react/
│   ├── shared/
│   ├── desktop/
│   └── mobile/
├── apple/
├── android/
├── server/
└── tests/
```

Domain/API/Error schema、Screen state/event 和 Route identity 是跨端事实；React、SwiftUI 与 Compose renderer 是平台实现。Web/Electron 可以显式指向同一 React Desktop entry；Capacitor 默认使用 React Mobile entry；原生客户端分别使用 SwiftUI/Compose。缺少 mandatory renderer 或 capability 时 Compiler 失败，不能隐式选择外观最接近的入口。完整规则见[客户端 Runtime](client-runtimes.md)。

## 14. AI 编程边界

每个模块的 `module.jsonc`、`public.ts` 和生成后的 Product Graph 共同构成机器可读上下文。AI 代理应优先读取这些入口，不递归猜测整个仓库。

框架必须通过 lint/compiler 强制：

- 只能经 `public.ts` 跨模块导入；
- 只能依赖声明过的 Services；
- 不修改 `.blankspace/generated/`；
- 不读取 Kit 或 Foundation internal；
- 修改后运行模块级与受影响测试。

模块生成器应支持结构化输出，让 AI 能准确得知创建、修改和验证了哪些文件。
