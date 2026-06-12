import { Router } from 'express';
import { config } from '../config';
import { signToken } from '../utils/token';

const router = Router();

interface WxSessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

// POST /api/login   body: { code }
router.post('/login', async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    return res.status(400).json({ error: 'missing code' });
  }

  // —— 开发模式：跳过微信，直接用 code 当伪 openid，方便本地联调 ——
  if (config.mockLogin) {
    const openid = `mock_${code}`;
    return res.json({ token: signToken(openid), openid });
  }

  // —— 正式模式：拿 code 去微信换 openid ——
  try {
    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${config.wxAppId}` +
      `&secret=${config.wxSecret}` +
      `&js_code=${code}` +
      `&grant_type=authorization_code`;

    const wxRes = (await fetch(url).then((r) => r.json())) as WxSessionResponse;

    if (!wxRes.openid) {
      // 微信返回了错误（code 失效、appid 错误等）
      return res.status(401).json({
        error: 'wx login failed',
        detail: { errcode: wxRes.errcode, errmsg: wxRes.errmsg },
      });
    }

    const token = signToken(wxRes.openid);
    res.json({ token, openid: wxRes.openid });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'server error' });
  }
});

export default router;