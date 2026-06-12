import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token';

/**
 * 鉴权中间件（对应流程的第 7 步）。
 * 客户端登录后，之后每个请求都在 header 里带： Authorization: Bearer <token>
 * 这个中间件负责验证 token，并把解析出的 openid 挂到 req.openid 上，
 * 后续业务代码就能知道"当前是哪个玩家"。
 */

// 给 Express 的 Request 类型扩展一个 openid 字段
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      openid?: string;
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'missing token' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }

  req.openid = payload.sub;
  next();
}
