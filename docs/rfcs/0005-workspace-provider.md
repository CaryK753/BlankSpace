# RFC-0005：Workspace Provider 与 Server Scope

## 状态

Proposed

## 背景

Blankspace 既要支持传统 remote-only SaaS，也要支持 AFFiNE 类 Local 和 Local-replica Workspace。把 Workspace 固定在 Foundation，或把“是否云端”建模为一个布尔值，都无法表达多 Server、独立认证和不同存储栈。

## 决策

### 1. Workspace 身份

```ts
interface WorkspaceRef {
  sourceId: string;
  workspaceId: string;
}
```

`sourceId` 是 provider 的稳定命名空间。所有缓存、路由、最近访问和本地存储都必须使用完整 Ref；裸 `workspaceId` 只允许在已经固定 provider 的内部调用中使用。

### 2. Provider Contract

```ts
interface WorkspaceProviderV1 {
  source: WorkspaceSource;
  list(principal: WorkspacePrincipal): Promise<WorkspaceSummary[]>;
  create(principal: WorkspacePrincipal, input: CreateWorkspaceInput): Promise<WorkspaceRef>;
  open(principal: WorkspacePrincipal, ref: WorkspaceRef): Promise<WorkspaceHandle>;
  archive(principal: WorkspacePrincipal, ref: WorkspaceRef): Promise<void>;
}
```

Provider 管理身份命名空间、列表、创建、打开和归档，并提供 storage/data capabilities。它不规定文档模型、编辑器或产品导航。

Provider 分类是 capability 组合，不是继承树：

| 类型 | 权威数据 | 本地状态 | 远端 |
| --- | --- | --- | --- |
| Local | 本地 | 完整 | 无 |
| Remote-only | Server | 无或可丢缓存 | 一个 Server |
| Local-replica | 本地写入耐久；数据域协议负责最终裁决 | 完整副本 | 一个 Server |

一个 Workspace 在任一时刻只属于一个 provider。多目标或多主复制不属于本 RFC。

`sourceId` 标识一个 provider instance：Local 使用设备持久 ID；Server Provider 必须绑定已验证的 `serverId`，不能由 endpoint 文本临时派生。一个 Server 的 `workspaceId` 在该 Server 内全局唯一。远端调用使用认证边界构造的 `WorkspacePrincipal { serverId, accountId, authenticationContextId }`；其中 context ID 只用于关联已验证认证结果和审计，不是客户端 session credential。实际认证材料由 server-scoped session store 持有。Local 使用明确的 local principal，Provider 不读取全局当前账号。

Server Provider 在任何操作前必须同时验证：`principal.serverId` 等于 provider 的已验证 serverId、`ref.sourceId` 等于 provider sourceId、authentication context 来自该 Server 的认证边界且绑定同一 accountId。字段只是路由与审计提示，不构成凭证；从客户端 body 反序列化的同形对象不能建立 principal。Local principal 是不可用于远端调用的判别联合类型。Phase 1 Web session 的建立、轮换和 ActorRef 规则见 RFC-0014。

### 3. Server Scope

```ts
interface ServerDescriptor {
  serverId: string;
  endpoint: string;
  protocolRange: string;
  features: string[];
}
```

每台 Server 拥有独立 endpoint、feature discovery、协议版本、认证会话和 Workspace Provider。Account identity 由 `{serverId, accountId}` 定位；官方托管与自托管使用相同 Contract。

添加 Server 时必须验证 URL、TLS 策略、server identity 和协议兼容性。Endpoint 改变不能静默创建新 identity，也不能把不同 Server 合并为同一作用域。

### 4. 状态与失败

Workspace Handle 至少暴露 `opening | ready | offline | degraded | locked | error | closed` 及 provider capabilities。Remote-only 不允许 `offline` 可写状态，archive 只有 Server 确认后成功；Local-replica 可以在 `offline` 继续本地提交。Provider 必须区分“本地可继续工作”和“必须连接远端”的失败；UI 不应把同步失败等同于 Workspace 打开失败。

删除默认使用 archive。永久删除由 provider 专用、可审计操作完成，不属于通用 `delete()`。

## 验收场景

1. 两台 Server 返回同一 workspaceId 时仍正确隔离路由、缓存和 session；
2. Local Workspace 不需要 Account 或网络即可创建、重启和打开；
3. Remote-only 断网时明确不可用，不伪装 local-first；
4. Local-replica 断网时打开本地副本并显示同步状态；
5. Server A 退出登录不清除 Server B 或 Local Workspace；
6. protocol 不兼容、TLS 错误和 server identity 改变给出不同 diagnostics。
7. Local、Remote-only 和 Local-replica 通过同一 conformance suite 验证身份、archive 与离线 capability 差异。
8. 伪造或错配 serverId、accountId、authenticationContextId、sourceId 的 open/archive 均在访问数据前失败。

## 取舍

选择 provider + scoped server，而不是全局 Workspace 表或任意 remote bindings。代价是 Ref 更长、迁移必须创建新 Ref；收益是身份、认证、存储和同步责任清楚。

## 非目标

- 多主同步；
- 跨 Server 联邦身份；
- Foundation 强制所有产品使用 Workspace；
- 用 Provider 抽象所有普通业务资源。
