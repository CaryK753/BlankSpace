# AFFiNE 架构研究与 Blankspace 启示

## 1. 研究定位

AFFiNE 是 Blankspace 的架构和技术栈参考，也是能力上限基准。Blankspace 的长期目标不是构建“简化版 AFFiNE”，而是提供足够完整的框架能力，使 AFFiNE 级产品最终能够作为 Product Overlay 被实现。

AFFiNE 不是 Blankspace 的源码模板。Blankspace 不复制其内部 API，也不假定当前实现中的每个设计都适合通用 SaaS。

资料核对日期：2026-09-03。核对提交：AFFiNE `2365c365574829b0cc72219e85fc412c498d2b00`；BlockSuite `5cb5cb68471ca692f3c162258f0087cb22fcb82d`。

## 2. 稳定产品事实

AFFiNE 将自己描述为 privacy-focused、local-first、open-source 的 Notion 与 Miro 替代方案，融合文档、画布和表格，并支持本地数据、实时协作与跨平台客户端。[AFFiNE README](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/README.md)

BlockSuite 源于 AFFiNE，提供协作文档状态、富文本、可编辑 blocks 和预制编辑器，并以 Yjs 作为协作文档状态基础。[BlockSuite README](https://github.com/toeverything/blocksuite/blob/5cb5cb68471ca692f3c162258f0087cb22fcb82d/README.md)

AFFiNE 提供持续更新的官方自托管路径。[自托管文档](https://docs.affine.pro/self-host-affine) 该页面无法由上述源码提交完整复现；涉及部署决策时必须重新核对具体版本。

## 3. Workspace 身份不是单独 ID

AFFiNE 客户端中的 Workspace 元数据为：

```ts
type WorkspaceMetadata = {
  id: string;
  flavour: string;
  initialized?: boolean;
};
```

客户端使用 `${flavour}:${id}` 作为缓存和对象池 key。[Workspace metadata](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/workspace/metadata.ts)

`flavour` 表示由哪个 Workspace provider 管理：

```text
local              → 本地 Workspace Provider
affine-cloud       → 官方 Server Provider
<custom-server-id> → 自托管 Server Provider
```

因此两个 Server 即使返回相同 `workspaceId`，客户端仍能通过 flavour 区分。Workspace URL 有时只包含 ID，客户端会使用 flavour 查询参数、Server URL 或最近使用的 flavour 消歧。[移动端 Workspace 解析](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/mobile/pages/workspace/index.tsx)

## 4. Server 拥有独立作用域

AFFiNE 客户端维护 Server 列表。添加自托管服务器时，客户端根据 `baseUrl` 获取配置并生成本地 `server.id`。[ServersService](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/cloud/services/servers.ts)

每个 Server 创建独立 `ServerScope`，其中包含自己的 Auth、GraphQL、Fetch、配置、features 和 Account Session。[Server entity](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/cloud/entities/server.ts)

更准确的关系是：

```text
Client
├── Local Workspace Provider
├── Server A Scope
│   ├── Account Session A
│   └── Workspace Provider A
└── Server B Scope
    ├── Account Session B
    └── Workspace Provider B
```

这不是一个全局 Account 下挂多台 Server 的固定树。

## 5. Local Workspace 与 Cloud Workspace

### 5.1 Local Workspace

Local Provider 的 flavour 固定为 `local`，使用 SQLite 或 IndexedDB 等本地存储，不配置 Cloud remote。[Local provider](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/workspace-engine/impls/local.ts)

Local Workspace：

- 不要求 Server Account；
- 本地数据即主数据；
- 没有远端同步源；
- 是完整 Workspace，不是临时缓存。

### 5.2 Cloud Workspace

每个 Server 都创建一个 Cloud Workspace Provider，其 flavour 就是 `server.id`。Cloud Workspace 创建时先调用服务器创建并获得 Workspace ID，同时在客户端创建本地 doc/blob 存储。[Cloud provider](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/workspace-engine/impls/cloud.ts)

Cloud Workspace 引擎同时配置：

```text
Local
├── doc
├── blob
├── sync metadata
├── awareness
└── indexer

Remote: cloud:<server-id>
├── CloudDocStorage
├── CloudBlobStorage
├── CloudAwarenessStorage
└── optional CloudIndexerStorage
```

因此 Cloud Workspace 不是普通 server-first API 数据。它从创建时属于一台 Server，但客户端仍拥有本地副本和同步能力。

## 6. Local → Cloud 是迁移

AFFiNE 的 Enable Cloud 不是给原 Local Workspace 添加远端 binding，而是：

```text
在目标 Server 创建新 Cloud Workspace
→ 复制 root YDoc
→ 复制所有 subdocs
→ 转换 Workspace database
→ 复制 blobs
→ 删除原 Local Workspace
→ 打开新 Cloud Workspace
```

源码通过目标 flavour 创建新 Workspace，复制数据后删除旧 Local Workspace。[Workspace transform](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/modules/workspace/services/transform.ts)

多 Server 选择界面把选定的 `server.id` 作为目标 flavour。[Enable Cloud dialog](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/packages/frontend/core/src/desktop/dialogs/enable-cloud/index.tsx)

当前模型中，一个 Cloud Workspace 属于一个 Server Provider。它不是一个 Workspace 同时维护多台 Server binding 的多主复制模型。

## 7. 转化为 Blankspace 的设计

AFFiNE 的 `flavour` 概念在 Blankspace 中暂称 `sourceId`，语义更直接：

```ts
type WorkspaceRef = {
  sourceId: string;
  workspaceId: string;
};
```

Blankspace 分离：

```text
Server Registry
├── endpoint
├── protocol and features
└── server-scoped Account Session

Workspace Provider
├── list / create / open / delete
├── workspace identity namespace
└── storage engine configuration
```

Server 通常贡献 Workspace Provider，但 Foundation 不把两者硬编码成同一个概念。

Provider 可以实现：

- Local：仅本地存储；
- Remote-only：传统 SaaS 服务端权威数据；
- Local-replica：本地副本加单一 Server 同步源。

Local → Cloud 被定义为可验证、可恢复的迁移流程，而不是布尔开关或追加 binding。

## 8. 值得借鉴但不直接照搬

- **Workspace provider**：借鉴 provider 管理身份、列表和 storage stack 的边界，不复制 `flavour` 命名。
- **Server scope**：借鉴每台 Server 独立配置、认证和 Account Session。
- **本地副本**：Cloud Workspace 可以拥有完整本地存储，不把 local-first 降级为缓存。
- **BlockSuite 分层**：内容框架与具体产品 UI 可以分离，但 Blankspace Phase 1 不自研通用编辑器。
- **多端代码共享**：共享领域和数据能力，不强求所有平台复用完全相同 UI。
- **工程规模**：AFFiNE 是长期演进结果，Blankspace 必须用纵向切片逐步验证。

## 9. 许可证边界

AFFiNE 仓库包含 MIT 许可证文件，但复用代码时必须检查目标目录、文件和依赖，不能只从首页推断整个仓库的许可边界。[AFFiNE LICENSE-MIT](https://github.com/toeverything/AFFiNE/blob/2365c365574829b0cc72219e85fc412c498d2b00/LICENSE-MIT)

BlockSuite 声明 MPL-2.0。[BlockSuite LICENSE](https://github.com/toeverything/blocksuite/blob/5cb5cb68471ca692f3c162258f0087cb22fcb82d/LICENSE)

当前 Blankspace 只借鉴公开架构思想，没有复制 AFFiNE 或 BlockSuite 代码。未来引入任何实现前必须重新审查许可证。

## 10. 后续源码研究

- nbstore 的本地 doc、sync metadata 和 remote storage 如何协调；
- AFFiNE 新旧同步协议的版本协商；
- Cloud Workspace 在首次打开、离线重启和重新登录时的状态机；
- Local → Cloud 迁移失败时的实际恢复行为；
- Workspace 数据库与 Yjs 文档的 schema migration；
- Server feature discovery 与旧客户端降级；
- BlockSuite 与 AFFiNE 产品层的公共边界。
