# 阿瓦隆小程序 · 开发文档

微信小程序版《阿瓦隆》发牌器：多人进同一房间、一键发牌、各自私密查看身份，含湖中仙女、兰斯洛特扩展。

## 文档索引

| 文档 | 内容 |
|---|---|
| [Day1-开发日报](./Day1-开发日报.md) | 架构与技术栈、登录鉴权、数据模型与协议、WebSocket（四合一） |
| [Day2-房间系统说明](./Day2-房间系统说明.md) | 建房/入房/准备/配置/开始，分享加入 |
| [十天开发计划](./十天开发计划.md) | 逐日排期与选型说明 |

## 进度

- ✅ **Day 1** 架构打通：登录鉴权、WebSocket 链路、`@avalon/shared` 共享类型包
- ✅ **Day 2** 房间系统：建房/入房/准备/配置/开始校验、分享加入、20 个测试全绿
- ⬜ **Day 3** 房主控制边界细化
- ⬜ **Day 4–6** 发牌、可见性规则、私密身份页
- ⬜ **Day 7–8** 对局流程、仙女、兰斯洛特
- ⬜ **Day 9–10** 断线重连、部署、提审

## 项目结构

```
Avalon/                      # npm workspaces 单仓
├── client/                  # 前端：Taro 4.2 + React 18（小程序，Vite 编译）
│   └── src/
│       ├── pages/           # index(首页) / register(注册) / create(建房) / room(房间)
│       ├── components/      # RoleConfig(人数+开关+实时角色构成)
│       └── utils/           # request / auth / profile / socket
├── server/                  # 后端：Node + Express + ws
│   ├── http/                # login / profile（REST）
│   ├── ws/                  # WebSocket 房间逻辑
│   ├── store/               # roomStore / userStore（内存 Map，Redis 留口子）
│   ├── lib/                 # roomCode（房间码生成）
│   ├── middleware/          # authGuard（JWT 鉴权）
│   ├── utils/               # token（零依赖 JWT）
│   └── test/                # roomCode / roles / roomStore / ws.e2e（20 用例）
├── shared/                  # 共享：@avalon/shared
│   ├── types.ts             # 领域模型（公开/私密拆分）
│   ├── protocol.ts          # 消息协议（事件 + 信封）
│   └── roles.ts             # 角色表、人数配置、发牌构成
└── docs/                    # 本文档
```

## 快速开始

```bash
# 0. 首次：根目录安装（workspaces 自动软链 @avalon/shared）
npm install

# 1. 后端（一个终端）
cd server && npm run dev      # tsx watch，http + ws 同在 :3000

# 2. 前端编译（另一个终端，watch）
cd client && npm run dev:weapp # 输出到 client/dist

# 3. 微信开发者工具导入 client/ 项目
#    详情 → 本地设置 → 勾「不校验合法域名…」（否则 localhost 被拦）
```

本地多人联调：把 `server/.env` 的 `MOCK_LOGIN` 设为 `true`（跳过微信、每个客户端各拿一个伪 openid），联真机时再改回 `false`。

## 测试

```bash
cd server && npm test          # 20 个用例：房间码 / 角色表 / store / ws 端到端
cd server && npm run typecheck  # 类型检查
```

## 安全红线（贯穿全项目）

阿瓦隆是身份隐藏游戏。**服务端持有完整状态（含所有人身份），但绝不整体下发**。任何广播都只发公开视图（`PublicRoom`，无 `role`/`team`/`votes`）；身份只通过 `ROLE_INFO` 按人单独算、单独发。胜负与身份判定全在服务端，**客户端不可信**。详见 [Day1 开发日报](./Day1-开发日报.md)。
