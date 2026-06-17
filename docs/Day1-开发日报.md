# Day 1 · 开发日报：架构打通

本日完成「架构 + 通信」的地基：搭好 monorepo、跑通微信登录鉴权、立起一条带鉴权的 WebSocket 链路、并把前后端共用的类型与消息协议沉淀到 `@avalon/shared`。本文合并自架构、登录鉴权、数据模型与协议、WebSocket 四部分。

---

## 一、架构与技术栈

### 总体架构

```
微信小程序(Taro/React)  ──HTTP(登录/资料)──▶  Express  ──▶ userStore
        │                                       │
        └──────WebSocket(房间/对局)──────▶  ws Server ──▶ roomStore
                                                            (内存 Map，Redis 留口子)
        ▲                                       │
        └─────共用类型/协议 @avalon/shared───────┘
```

- **HTTP**：低频、一次性的请求（登录换 token、读写用户资料）走 REST。
- **WebSocket**：房间内实时同步（玩家列表、准备、配置、开始、对局）走长连接，按房间广播。
- **shared**：前后端共用同一份类型与消息协议，杜绝「两边对不上」。

### Monorepo（npm workspaces）

整个仓库是一个 npm workspaces 单仓，根 `package.json`：

```json
{ "name": "avalon-project", "private": true, "workspaces": ["client", "server", "shared"] }
```

`shared` 是本地「伪包」`@avalon/shared`（`main: index.ts`，原始 TS）。根目录 `npm install` 后，npm 在 `node_modules/@avalon/shared` 建软链指向 `shared/`，前后端都能 `import { ... } from '@avalon/shared'`，免去 `../../../shared` 相对路径地狱。

**消费原始 TS 的两端差异：**
- 后端用 `tsx`，原始 `.ts` 直接跑，零配置。
- 前端是 Taro + **Vite**（不是 Webpack）。因 `shared` 在 `client/` 外且软链进来，需在 `client/config/index.ts` 注入 Vite 配置：`server.fs.allow`（放行项目根之外）+ `optimizeDeps.exclude: ['@avalon/shared']`（当源码处理，不预打包），通过 `compiler: { type: 'vite', vitePlugins: [...] }` 注入。

### 选型理由

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | Taro 4.2 + React 18（Vite） | 用 React 语法写小程序 |
| 后端 | Node + Express 5 + ws | 与前端同语言；ws 做实时房间 |
| 共享 | TypeScript + npm workspaces | 类型/协议单一数据源 |
| 鉴权 | 自实现 HS256 JWT（node:crypto） | 零依赖 |
| 房间存储 | 内存 Map（Redis 留口子） | MVP 够用；封装后将来换 Redis 零改动 |

**为什么房间状态先用内存 Map 而不是 Redis**：对局状态一局即弃、不需持久化；10 天单服务器 MVP 内存 `Map<roomId, Room>` 更简单。把存储封装在 `store/roomStore.ts` 后面（async `getRoom/saveRoom/deleteRoom/roomExists`），将来换 Redis 只改这一个文件。Redis 真正值钱的是「重启不丢对局」和「多实例 Pub/Sub」，10 天内大概率碰不到。

**关于域名**：上线要 https/wss 备案域名；开发阶段在开发者工具勾「不校验合法域名」即可用 `localhost`。

---

## 二、登录鉴权与用户资料

### 登录流程（wx.login → code 换 openid → JWT）

目的：安全拿到玩家唯一身份 `openid`，全程不让 `appsecret` 离开服务器。

```
客户端                          后端                       微信服务器
  │ 1. Taro.login() 拿临时 code  │                            │
  │ 2. POST /api/login {code} ─▶ │                            │
  │                              │ 3. code+appid+secret ───▶  │
  │                              │ ◀── 4. openid+session_key  │
  │                              │ 5. 用 openid 签发 JWT       │
  │ ◀────────── 6. { token } ─── │                            │
  │ 7. 之后每个请求带 token ───▶ │  authGuard 验 token → openid │
```

`appsecret` 只在第 3 步用到、永远只在后端；客户端拿到的是后端自签的 JWT，与微信 `session_key` 无关。

### 后端实现

- **`server/config.ts`**：从 `.env` 读取；`MOCK_LOGIN=true` 跳过微信用伪 openid（本地多人联调）。`.env` 不进 git。关键变量：`MOCK_LOGIN` / `WX_APPID` / `WX_SECRET` / `JWT_SECRET` / `TOKEN_TTL`。
- **`server/http/login.ts`**：`POST /api/login` body `{ code }` → `{ token, openid }`。mock 返回 `mock_<code>`，正式模式请求微信 `jscode2session`。
- **`server/utils/token.ts`**：零依赖 HS256 JWT。`signToken(openid)` 签发；`verifyToken` 重算签名 + `timingSafeEqual` 防时序攻击 + 校验过期。token 的 header/payload 是 base64 公开可读，**别塞密码**；防伪靠签名。
- **`server/middleware/auth.ts`**：`authGuard` 读 `Authorization: Bearer`，验证后把 `openid` 挂到 `req.openid`。WebSocket 握手复用同一个 `verifyToken`。

### 用户资料与注册检测

登录只解决「你是谁（openid）」，昵称/头像单独填，即「注册检测」。

- **`server/http/profile.ts`**：`GET /api/profile` 返回 `{ profile | null }`（null = 没注册过）；`POST /api/profile` 存昵称（必填，限长 20）+ 头像。openid 由 `authGuard` 解析，客户端不传。
- **存储 `server/store/userStore.ts`**：内存 Map，Redis 留口子。
- **客户端流程**：App 启动 `ensureLogin()`（有 token 直接用，没有就 `Taro.login()` 换并存 Storage）；进入需身份的页面前 `GET /api/profile`，`null` 则跳注册页填名称/头像。
- 相关：`client/src/utils/auth.ts`（`login`/`ensureLogin`/`whoAmI`）、`request.ts`（自动带 token、401 自动清）、`profile.ts`。

> ⚠️ `chooseAvatar` 返回**临时本地路径**，单机能显示，跨设备需上传换永久 URL（建议 Day 10 补 `/api/upload`）。

---

## 三、数据模型与消息协议（@avalon/shared）

`shared/` 分三个文件：`types.ts`（领域模型）、`protocol.ts`（消息协议）、`roles.ts`（角色表）。

### 安全原则：公开 / 私密拆分

服务端持有完整态但绝不整体下发。类型拆三层，让编译器守住身份不外泄：

| 层 | 类型 | 含私密? | 用途 |
|---|---|---|---|
| 完整态 | `Player` / `Room` / `GameState` | ✅ `role`/`team`/`votes` | 只存服务端 |
| 公开视图 | `PublicPlayer` / `PublicRoom` / `PublicGameState` | ❌ | 广播用 |
| 私密视图 | `RoleInfo` | 仅本人身份 | `ROLE_INFO` 单独发 |

广播前一律走投影函数 `toPublicRoom(room)`，强制剥掉 `role`/`team`/`votes`。

### 核心类型

```ts
interface GameConfig { playerCount: number; useLancelot: boolean; useLadyOfLake: boolean }

interface Player {            // 完整态
  openid: string; nickname: string; avatarUrl: string
  seat: number; isHost: boolean; isReady: boolean; connected: boolean
  role?: Role; team?: Team    // 私密，绝不广播
}

interface RoleInfo {          // 私密视图（每人单独算）
  role: Role; team: Team
  knownEvil?: string[]        // 梅林看到的坏人（莫德雷德除外）
  merlinCandidates?: string[] // 派西维尔看到的梅林+莫甘娜
  fellowEvil?: string[]       // 坏人互认（奥伯伦除外）
}
```

`GameState` 含 `votes`（只存服务端，揭晓前不公开）、`ladyOfLakeHolder` + `ladyHistory`（仙女令牌与已持有者历史）。

### 消息协议：统一信封

`interface Message<T> { type: ClientEvent | ServerEvent; payload: T }`，用字符串字面量联合而非 enum（零运行时）。

**ClientEvent**：`CREATE_ROOM`/`JOIN_ROOM`/`LEAVE_ROOM`/`UPDATE_CONFIG`/`TOGGLE_READY`/`START_GAME`（Day 2）、`PROPOSE_TEAM`/`VOTE`/`QUEST_ACTION`/`LADY_INSPECT`/`ASSASSINATE`（Day 4–8）、`PING`。

**ServerEvent**：`WELCOME`/`PONG`、`ROOM_UPDATE`（公开房间，广播）、`GAME_STARTED`、`ROLE_INFO`（私密单发）、`PHASE_CHANGE`/`VOTE_RESULT`/`QUEST_RESULT`/`GAME_OVER`、`ERROR`。

辅助：`makeMessage(type, payload)`；前端 `sendMessage(type, payload)`、后端 `send(socket, makeMessage(...))`。

### 角色与人数表（roles.ts）

「人数 → 角色构成」单一数据源，建房页实时展示和 Day 4 发牌共用。

| 人数 | 好 | 坏 |  | 人数 | 好 | 坏 |
|---|---|---|---|---|---|---|
| 5 | 3 | 2 |  | 8 | 5 | 3 |
| 6 | 4 | 2 |  | 9 | 6 | 3 |
| 7 | 4 | 3 |  | 10 | 6 | 4 |

- `buildRoleList(count, config?)`：生成角色池。基础局 = 梅林+派西维尔+忠臣 / 莫甘娜+刺客+填充；开兰斯洛特时一忠臣换好兰、一填充坏人换坏兰（人数不变）。
- `canUseLancelot(count)`：需有可替换填充坏人（7 人及以上）。
- `ROLE_META`（中文名/阵营/技能）、`TEAM_SIZE`、`groupRolesByTeam`。湖中仙女不改角色构成。

---

## 四、WebSocket 与实时通信

房间实时同步全走 WebSocket，与 Express 复用同一 HTTP 端口（`:3000`）。

### 启动与握手鉴权

`server/index.ts` 用一个 `http.Server` 同时承载 Express 和 ws：`createServer(app)` → `setupWebSocket(server)` → `server.listen()`。

客户端连接时 token 放 URL query：`ws://localhost:3000?token=<jwt>`。服务端 `connection` 时 `verifyToken`，验不过 `close(4001)`；验过把 `openid`/`roomId` 挂在连接对象上（`GameSocket`）。

> 当前身份直接挂 ws 对象，按房间广播时遍历 `wss.clients` 过滤 `roomId`。等 Day 5 私密下发身份、Day 9 断线重连/顶号时再引入 `Map<openid, ws>`。

### 按房间广播与安全红线

```ts
function broadcastRoom(wss, room) {
  // 必须 toPublicRoom 剥掉私密字段，绝不直接 JSON.stringify(room)
  broadcast(wss, room.roomId, makeMessage(ServerEvent.ROOM_UPDATE, { room: toPublicRoom(room) }))
}
```

🚨 任何房间广播都先 `toPublicRoom()`，否则抓一下 WebSocket 报文就能看到所有人身份。身份只通过 `ROLE_INFO` 按人单独发。**凡涉及身份与胜负的判定全在服务端，客户端不可信。**

### 房间业务（Day 2 已实现）

| 事件 | 处理 | 房主校验 |
|---|---|---|
| `CREATE_ROOM` | 生成房间码、建 Room、房主默认已准备 | — |
| `JOIN_ROOM` | 校验存在/未开始/未满，已在房则标记重连 | — |
| `LEAVE_ROOM` | 移除玩家，空房删除，房主退出自动转移 | — |
| `UPDATE_CONFIG` | 改人数/扩展，`normalizeConfig` 夹合法区间 | ✅ |
| `TOGGLE_READY` | 切准备（房主视为始终准备） | — |
| `START_GAME` | 校验人数刚好且全员准备（发牌在 Day 4） | ✅ |

掉线（`close`）：玩家 `connected=false` 保留座位等重连；房主迁移完整处理留 Day 9。

### 客户端封装 `client/src/utils/socket.ts`

`connectSocket()` / `ensureSocket()`（URL 带 token）、`sendMessage(type, payload)`、`onMessage(fn)`（订阅，返回取消函数）、`onClose`（留了 Day 9 自动重连口子）。

**两个坑**：① ws 无自动重连，要监听 `onClose` 手动重连；② 本地用 `ws://localhost` 需勾「不校验合法域名」，真机要 `wss://` + 备案域名。

---

## 当日产出文件一览

- **shared/**：`types.ts`（公开/私密拆分 + 投影函数）、`protocol.ts`（事件 + 信封）、`roles.ts`、`index.ts`、`package.json`
- **server/**：`config.ts`、`http/login.ts`、`utils/token.ts`、`middleware/auth.ts`、`index.ts`（http+ws 同端口）、`ws/index.ts`
- **client/**：`utils/auth.ts`、`utils/request.ts`、`utils/socket.ts`、`config/index.ts`（Vite 接 shared）
- **根**：`package.json`（workspaces）

测试见 `server/test/`（房间码 / 角色表 / store / ws 端到端，20 用例全绿）；运行与排错见 [README](./README.md)。
