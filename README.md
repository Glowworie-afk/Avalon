# Avalon

[![CI](https://github.com/Glowworie-afk/Avalon/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Glowworie-afk/Avalon/actions/workflows/ci.yml)

微信小程序多人阿瓦隆游戏，使用 Taro / React、Node.js / Express / WebSocket 与共享 TypeScript 规则包。目标是完成可玩的产品，并通过实际开发学习全栈、Git、测试、CI/CD、Docker、AWS 和监控，形成可展示的求职作品。

- [GitHub 仓库](https://github.com/Glowworie-afk/Avalon)
- [项目看板](https://github.com/users/Glowworie-afk/projects/1/views/1)
- [产品范围](docs/PRD.md) · [版本路线与当前进度](docs/ROADMAP.md) · [系统架构](docs/ARCHITECTURE.md)
- [贡献规范](CONTRIBUTING.md) · [AI 开发规则](AGENTS.md) · [Ponytail 使用说明](docs/ponytail-setup.md) · [审计报告](docs/ponytail-audit.md)

## 当前状态

当前开发阶段为 **v0.1.0：工程基础与 CI**，不是产品已发布的版本。package.json 中现有的 `1.0.0` 不代表 v1.0.0 路线已经完成，本次未修改包版本。

已有大厅、发牌与私密身份、任务循环、刺杀、兰斯洛特和湖中仙女代码。仍有安全、状态恢复和 UI 问题；已有实现不等于验收通过。2026-11-25 的审计记录为服务端 61 个测试通过、服务端类型检查通过、客户端类型检查失败，详见审计报告。基础 CI 配置已添加，远端运行待验证，见 [CI 说明](docs/CI.md)，当前阶段不创建 AWS 资源。

详细验证记录见 [当前状态报告](docs/STATUS.md)，含本地模拟器与完整协议局结果。可复现的隔离本地启动步骤见 [本地开发说明](docs/LOCAL_DEVELOPMENT.md)。

## 本地运行

需要 Node.js、npm、微信开发者工具。审计环境使用 Node v24.3.0 / npm 11.4.2；这只是已用环境，尚未定义或验证最低版本，也未验证全新安装。

在仓库根目录安装 npm workspaces 依赖：

```bash
npm install
```

首次运行且 `server/.env` 不存在时，将 `server/.env.example` 复制为 `server/.env`。本地联调设 `MOCK_LOGIN=true`，并设置自己的 `JWT_SECRET`。真实微信登录需 `MOCK_LOGIN=false` 与有效的 `WX_APPID`、`WX_SECRET`。不要提交真实凭证。

分别在两个终端运行：

```bash
# 终端一：从仓库根目录进入后端，使 dotenv 能读取 server/.env
cd server
npm run dev
```

```bash
# 终端二：从仓库根目录编译小程序
npm run dev:weapp --workspace client
```

在微信开发者工具中导入 `client/`，构建产物位于 `client/dist/`。服务器默认监听 3000 端口；本地健康检查为 `http://localhost:3000/health`。

**当前接线限制：** 客户端 `src/utils/request.ts` 的 `BASE_URL` 与 `src/utils/socket.ts` 的 `WS_BASE` 仍硬编码为远端地址，不会自动连到本地后端；`.env.*` 尚未接管这两个常量。进行本地联调前，需要将它们指向自己的本地服务（真机使用可访问的局域网地址）。这属于待修复的环境配置问题，本次文档迁移未改动常量。开发工具跳过合法域名检查仅用于本地调试；发布前需要 HTTPS/WSS 与正确的域名配置。

## 检查命令

在仓库根目录：

```bash
npm test --workspace server
npm run typecheck --workspace server
npm run build:weapp --workspace client
```

客户端目前没有 `typecheck` npm script，可直接运行其已安装的编译器：

```bash
client/node_modules/.bin/tsc --noEmit -p client/tsconfig.json
```

该检查目前失败，尚不能作为通过的质量门禁。服务端 WebSocket 集成测试需要本机监听端口权限。测试/类型检查不替代多设备验收，本次状态审查已重新运行服务端测试、双方类型检查和小程序构建，实际结果见当前状态报告。

## 目录

| 路径 | 职责 |
|---|---|
| `client/` | 小程序页面、组件、HTTP/Socket 客户端 |
| `server/` | HTTP、WebSocket、鉴权、游戏引擎、内存存储与测试 |
| `shared/` | 数据类型、协议、角色规则、任务人数表及公开视图投影 |
| `docs/` | 产品、路线、架构、审计和历史记录 |

运行状态目前存于进程内存，服务重启会丢失房间和用户资料；尚不支持多实例共享状态。持久化方案与部署安排见架构和路线文档。
