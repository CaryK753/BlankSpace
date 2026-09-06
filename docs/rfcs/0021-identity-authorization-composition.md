# RFC-0021：身份、产品主体与可替换授权引擎

## 状态

Proposed

## 背景

SaaS 的主体不总是“用户属于组织并拥有一个角色”。产品可能包含个人账户、团队、Workspace、外部客户、服务账号、代理、共享链接、层级资源或临时授权。Blankspace 若冻结统一 `User/Organization/Role` 表，会迫使产品绕过框架；若完全不提供边界，又无法保证跨租户隔离和 AI 生成代码安全。

## 决策

### 1. 分离 Authentication、Principal Model 与 Authorization

- Identity Kit 只负责认证账号、credential、session、验证/恢复以及稳定 `AccountRef`；
- Product Overlay 定义自己的主体、租户、组织、团队、成员和资源关系；
- Authorization Kit 连接成熟策略引擎，执行产品定义的 permission schema；
- Workspace Kit 只管理产品确实采用的 Workspace，不被定义成所有 SaaS 的唯一租户模型；
- Foundation 只传递经服务端认证建立的 `ActorRef`，不定义 `User`、`Organization` 或固定角色枚举。

产品必须显式声明自己的隔离根，例如 `tenant | organization | workspace | account`。没有隔离根的多租户数据域不能进入生产 Graph。

### 2. 开源优先的候选组合

候选不是依赖冻结：

| 目标 | official-reference 候选 | 用法 |
| --- | --- | --- |
| TypeScript authentication | Better Auth | account/session/email/API-key 等 adapter；Organization 插件只作为可选 starter |
| 集中式关系授权 | OpenFGA 或 SpiceDB | 产品定义 object types、relations、permissions；部署独立授权服务 |
| 嵌入式策略判定 | Casbin | Phase 1 official-reference 候选；策略与业务数据使用同一受控数据库边界 |
| 自定义 | 产品 adapter | 实现最小 Authorization Contract 并通过 fixtures |

截至 2026-09-06，Better Auth 仓库声明 MIT；SpiceDB 和 OpenFGA/Casbin 相关项目声明 Apache-2.0。正式选为官方 adapter 前仍须锁定确切 artifact、license hash、依赖树和安全维护策略，不能把“核心开源”误写成所有托管服务均免费。

### 3. 最小 Authorization Contract

```ts
interface AuthorizationService {
  check(input: {
    actor: ActorRef;
    permission: string;
    resource: ResourceRef;
    context?: Record<string, JsonValue>;
    consistency?: ConsistencyToken;
  }): Promise<Decision>;

  checkMany(input: BatchCheckInput): Promise<BatchDecision>;
}
```

`ActorRef` 由认证边界建立，客户端同形 JSON 不能成为可信 actor。`ResourceRef` 是 `{ type, id, isolationRoot }` 的版本化引用，不要求产品共享资源表。`Decision` 必须包含 allow/deny、policy revision、可审计 reason code 和用于防止 stale allow 的一致性 token；超时、schema 不兼容和 provider 不可用默认 deny，公开读取例外必须由产品显式策略声明。

关系写入与 schema 管理不能被遗漏。最小 Contract 另定义版本化 `writeRelations(intent)`、`applySchema(migration)`、`getRevision()` 和 `reconcile(scope)` 管理面；list objects/users 与 explain 等高级查询可以留在 adapter/产品 API。所有 mutation 需要 actor/system provenance、idempotency key、precondition revision 和审计。

### 4. Enforcement 与数据隔离

HTTP route 只负责建立 actor 和校验输入；真正授权必须在拥有数据的 Service 执行。每个数据域同时声明：

- isolation root 与 tenant-scoped key；
- permission operation；
- scoped repository/RLS 或等价不可绕过机制；
- cache/object/blob/search/job key 的完整 scope；
- 管理/迁移角色的绕过权限和审计。

Authorization engine 不能替代数据层隔离。列表和搜索必须先产生“当前 actor 可见集合”或在查询内施加 scope，禁止先读取跨租户数据再在应用内过滤。

### 5. 关系与业务数据一致性

Phase 1 的 reference path 使用 embedded、同库或等价 scoped-DAL adapter，使业务记录与授权关系能在同一 owner transaction 提交；它至少用两个不同产品 policy schema 证明没有固定角色模型。OpenFGA/SpiceDB 等外部关系服务不属于 Phase 1 退出条件。

启用 `external-relations` capability 时，产品业务库与授权服务不能假装共享事务。数据 owner 在本地事务内写业务记录和 authorization intent；RFC-0023 dispatcher 通过 `writeRelations` 幂等应用并保存 provider revision。新授权只有关系写入确认后生效；撤权和高风险变更在未确认时失败关闭。读请求可以携带要求“不早于某 revision”的 consistency token。

删除、成员变更、资源移动和 schema 升级必须有 replay、reconcile 和孤儿关系扫描。长期不同步进入安全告警，不能静默采用旧 allow。

### 6. 产品模板而非统一模型

Blankspace 可以提供可复制 starter：

- personal SaaS：`account -> resource`；
- team SaaS：`organization -> team -> resource`；
- workspace SaaS：`workspace -> member -> document`；
- B2B2C：`provider organization -> customer organization -> resource`。

模板属于 Product Overlay，可修改、替换和删除。Compiler 只检查 schema、引用和 fixtures，不把模板表升级为 Foundation Contract。

## 验收条件

1. 两个采用不同租户/主体模型的产品共用 Identity 和 Authorization Kit；
2. 产品不安装 Organization 模板也能使用 Identity；
3. route、Service、DAL 必须有跨租户负面 fixture；cache、search、job 仅在产品启用时成为 required，未启用时记录 `not-applicable`；
4. 授权 provider 延迟、不可用、stale revision 和撤权竞争默认不产生越权；
5. policy schema 和关系数据均可导出、版本化、reconcile 和迁移；
6. AI context 包含 isolation root、permission、敏感字段与 invariant tests。

## 非目标

- 统一所有产品的 User/Organization/Role 表；
- 自研 Zanzibar 或通用策略语言；
- 只靠 route middleware 或授权引擎替代数据隔离；
- 宣称某个开源引擎的托管服务或全部插件永久免费。
