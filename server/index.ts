import express from 'express';
import { createServer } from 'node:http';
import { config } from './config';
import loginRouter from './http/login';
import profileRouter from './http/profile';
import { authGuard } from './middleware/auth';
import { setupWebSocket } from './ws';

const app = express();

// 解析 JSON 请求体（Express 5 需要显式开启，否则 req.body 是 undefined）
app.use(express.json());

// 健康检查，方便确认服务有没有起来
app.get('/health', (_req, res) => {
  res.json({ ok: true, mockLogin: config.mockLogin });
});

// 登录相关路由： POST /api/login
app.use('/api', loginRouter);

// 用户资料路由： GET/POST /api/profile（注册检测 + 存名称头像）
app.use('/api', profileRouter);

// —— 受保护的示例接口 ——
// 加上 authGuard 后，没带有效 token 的请求会被挡在 401。
// 带了 token 的请求能在 req.openid 拿到当前玩家身份。
app.get('/api/me', authGuard, (req, res) => {
  res.json({ openid: req.openid });
});

// 用一个 http.Server 同时承载 Express（HTTP 接口）和 WebSocket，复用同一端口
const server = createServer(app);
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
  console.log(`ws endpoint    ws://localhost:${config.port}`);
  console.log(`mockLogin = ${config.mockLogin}`);
});
