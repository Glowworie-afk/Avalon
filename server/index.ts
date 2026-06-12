import express from 'express';
import { config } from './config';
import loginRouter from './http/login';
import { authGuard } from './middleware/auth';

const app = express();

// 解析 JSON 请求体（Express 5 需要显式开启，否则 req.body 是 undefined）
app.use(express.json());

// 健康检查，方便确认服务有没有起来
app.get('/health', (_req, res) => {
  res.json({ ok: true, mockLogin: config.mockLogin });
});

// 登录相关路由： POST /api/login
app.use('/api', loginRouter);

// —— 受保护的示例接口 ——
// 加上 authGuard 后，没带有效 token 的请求会被挡在 401。
// 带了 token 的请求能在 req.openid 拿到当前玩家身份。
app.get('/api/me', authGuard, (req, res) => {
  res.json({ openid: req.openid });
});

app.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
  console.log(`mockLogin = ${config.mockLogin}`);
});
