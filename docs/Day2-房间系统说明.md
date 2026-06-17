# Day 2 · 房间系统（Lobby）

完成你描述的流程：**创建房间 → 注册检测（填名称/头像）→ 选人数 + 兰斯洛特/湖中仙女开关（实时显示对应角色）→ 进房间，玩家列表实时同步**，含房主控制、准备状态、5–10 人校验。**加入房间用微信分享：房主点「邀请」转发给好友/群，对方点开分享卡片直接进房，无需输房间码。**

## 流程

```
房主：首页─创建─▶ 注册检测 ─未注册→ 注册页 ─▶ 配置页(人数+开关,实时角色) ─创建─▶ 房间页
                                                                          │点「邀请」转发
                                                                          ▼
好友/群：点开分享卡片 ─▶ 注册检测 ─未注册→ 注册页 ─▶ 直接进同一房间
```

- 注册检测走 `GET /api/profile`：填过资料直接进，没填过先去注册页。
- 加入靠微信转发：房间页用 `useShareAppMessage` 把分享卡片 `path` 设成 `/pages/room/index?mode=join&roomId=XXXX`，对方点开小程序就落在房间页并自动 `JOIN_ROOM`。房间号仍显示（点一下复制）作为兜底。

## 新增/改动文件

**shared/**（前后端共用，单一数据源）
- `roles.ts`（新）：角色中文名/阵营/技能、5–10 人好坏数量表、`buildRoleList()`。建房页实时展示和 Day 4 发牌共用同一份。
- `protocol.ts`：新增 `CREATE_ROOM`/`LEAVE_ROOM`/`UPDATE_CONFIG` 事件及 payload。
- `types.ts`：`GameConfig` 加 `playerCount`，`Player`/`PublicPlayer` 加 `avatarUrl`。

**server/**
- `lib/roomCode.ts`（新）：4 位房间码（去 0/O/1/I/L），唯一校验。
- `store/roomStore.ts`、`store/userStore.ts`（新）：async 内存 Map（按仓库选型，Redis 留口子，2 小时空闲回收）。
- `http/profile.ts`（新）：`GET/POST /api/profile`，已挂到 `index.ts`。
- `ws/index.ts`（重写）：create/join/leave/ready/config/start，房主权限**服务端校验**，统一全量广播 `toPublicRoom`，掉线置 `connected=false`。
- `test/`（新）：`roomCode`/`roles`/`roomStore`/`ws.e2e`，**20 个用例全绿**。

**client/**
- `components/RoleConfig/`（新）：人数 stepper + 两个开关 + 实时角色构成，可编辑/只读复用。
- `pages/register`、`pages/create`、`pages/room`（新），`pages/index`（只保留「创建房间」）。
- 房间页用 `useShareAppMessage` + `<Button open-type="share">` 实现转发加入，分享 `path` 带 `roomId`；对方点开自动 `JOIN_ROOM`，未注册先跳注册页。
- `utils/profile.ts`（新）、`utils/auth.ts`（加 `whoAmI`）、`utils/socket.ts`（加 `ensureSocket`）、`app.config.ts`（注册 4 个页面）。

## 关键规则

- **人数 5–10**：UI stepper 限定区间；服务端 `normalizeConfig` 再夹一次，开始游戏要求人数刚好等于配置值且全员准备。
- **兰斯洛特需 7 人**：低于 7 人开关禁用并提示；人数降到 7 以下自动关闭；服务端同样强制。
- **湖中仙女不改角色构成**：只存配置，玩法在 Day 8。
- **房主权限**：改配置 / 开始游戏只有 `openid === hostOpenid` 能做，前端按钮 + 服务端双重校验。房主退出自动转移给下一位。
- **隐私红线**：广播一律走 `toPublicRoom()`，绝不含 `role/team`（沿用 Day 1 设计）。

## 本地运行

1. 起后端：
   ```bash
   cd server
   npm run dev        # tsx watch，http://localhost:3000 同端口承载 ws
   ```
   多开模拟测试建议把 `server/.env` 的 `MOCK_LOGIN` 改成 `true`（跳过微信，用伪 openid，每个客户端各拿一个），联真机时再改回 `false`。

2. 编译前端并导入开发者工具：
   ```bash
   cd client
   npm run dev:weapp  # 输出到 client/dist，watch
   ```
   打开**微信开发者工具** → 导入 `client` 项目 → 详情 → 本地设置 → 勾选 **「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」**（否则 `http://localhost` / `ws://localhost` 会被拦）。

## 测试

```bash
cd server && npm test       # 20 个用例：房间码 / 角色表 / store / ws 端到端
cd server && npm run typecheck
```

ws 端到端用例覆盖：建房→加入双方收到 2 人广播、加入不存在房间报错、非房主改配置被拒、准备状态同步、人数不齐开始被拒、房主退出自动转移。

**前端联调（在开发者工具里点）**：
1. 用「多账号调试」或两个模拟器，各自登录 → 一个创建房间，点「邀请」用开发者工具的转发/复制 path 模拟分享，另一个用该 `path`（`/pages/room/index?mode=join&roomId=XXXX`）打开加入。真机直接转发分享卡片即可。
2. 验证：双方玩家列表实时互现；非房主点准备，房主侧实时变「已准备」；房主调人数/开关，对方实时刷新且角色构成跟着变；人齐且全准备后房主「开始游戏」按钮亮起。
3. 头像注意：`chooseAvatar` 返回的是临时路径，**单机能显示，跨设备需上传到服务器换永久 URL**（建议 Day 10 补，或提前做个 `/api/upload`）。

## 留给后续

- 头像永久化（上传接口）。
- 断线重连 / 房主迁移在掉线场景下的完整处理（Day 9）。
- `START_GAME` 现在只做校验并回一个占位事件，真正发牌在 Day 4。
