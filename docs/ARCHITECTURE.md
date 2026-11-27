# Avalon 当前架构

依据 2026-11-25 本地代码整理。本文描述已有实现；未来部署和存储选择另列，不代表已经实施。

## 模块与数据流

```text
微信小程序（Taro 4.2 / React 18）
  ├─ HTTP：登录、用户资料、身份查询
  └─ WebSocket：房间与游戏操作 / 公开更新 / 本人私密消息
             ↓
Node.js：同一个 http.Server 上的 Express 5 + ws
  ├─ http/ + middleware/auth.ts + utils/token.ts
  ├─ ws/index.ts：鉴权、消息分发、权限检查、广播
  ├─ game/engine.ts：发牌、视野、回合和胜负判定
  └─ store/：进程内 Map

shared/：客户端与服务端共用类型、事件、角色表、任务规则及公开投影
```

仓库使用 npm workspaces：`client`、`server`、`shared`。`@avalon/shared` 直接提供 TypeScript 源码；客户端 Vite 配置允许消费该工作区源码。没有额外服务层或数据库服务在运行时被这些模块调用。

## 身份与通信

1. 客户端调用 `Taro.login()` 获取 code，POST `/api/login`。
2. 服务端向微信交换 openid，并使用 Node crypto 签发 HS256 JWT；mock 模式跳过微信，仅供开发。
3. HTTP 请求通过 Bearer token 鉴权；Socket URL 携带 token，服务端在连接时验证。
4. 消息使用 `{ type, payload }` 信封；`shared/protocol.ts` 定义事件及载荷。
5. 服务端处理合法操作、更新 Room，再发出公开视图或私密结果。

当前校验存在审计中记录的不足；TypeScript 类型不是网络输入的运行时校验。

## 状态与安全边界

- `Room`、`Player`、`GameState` 保存完整状态。角色、阵营、未公开投票、任务牌与兰斯洛特牌堆仅由服务端持有。
- `toPublicRoom` / `toPublicPlayer` / `toPublicGameState` 显式投影公开字段，广播不直接序列化完整 Room。
- `ROLE_INFO` 按玩家计算并定向下发；`LADY_RESULT` 只发送给查验者；终局才通过 `GAME_OVER` 揭示身份。
- 游戏引擎直接修改传入的 Room，不访问网络；WebSocket 层负责持久化接口调用和消息发送。这里的引擎不是不可变纯函数。
- 每个 Socket 有顺序处理消息的 Promise 队列；没有房间级事务或跨进程协调。不要将它解释为多连接操作已具备原子性。

## 存储和运行限制

`roomStore.ts` 使用内存 Map，每次保存刷新两小时过期计时器；`userStore.ts` 也使用内存 Map，但没有过期或容量限制。重启会丢失两者，多个进程之间不共享状态。

历史计划提出 Redis，当前没有使用 Redis，未使用的 `ioredis` 直接依赖已移除。仅把 store 换成 Redis 不能自动解决多实例广播、并发更新和连接路由；当前不提前引入分布式架构。DynamoDB 是未来 AWS 阶段的候选，尚未决定替代或配合哪一种存储。

客户端通过构建时 `AVALON_API_ORIGIN` 配置连接，生产强制 HTTPS 并派生 WSS；自动重连和终局恢复尚不完整。后续改进先解决实际问题，不因已有 async store API 就新增通用 repository 或 adapter 层。

## 测试与部署状态

测试使用 Node 内建 `node:test` 与 tsx，包含规则单测、内存存储及本机 WebSocket 集成测试。当前没有客户端自动化测试套件；服务端测试通过不代表真机 UI、真实微信登录或并发压力已验收。

基础 CI 已配置并在 GitHub Actions 验证；当前没有 Docker 或 AWS 部署清单。部署计划见 [ROADMAP](ROADMAP.md)，风险与代码位置见 [审计报告](ponytail-audit.md)。旧目录讲解为历史材料，以当前代码和本文为准。

## UI responsibilities

`pages/room` handles room events and lobby state. `GameBoard` handles gameplay actions; `GameResults` displays the final result. `RoleVision` is shared by the initial role reveal and in-game identity panel, so both use the same private information. The unused `RoleConfig` component was removed; the existing creation page remains the configuration UI until the fixed-mode PRD work is implemented.
