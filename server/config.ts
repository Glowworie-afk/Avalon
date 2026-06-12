import 'dotenv/config';

/**
 * 统一的服务端配置。
 * 所有敏感信息（appsecret、jwt 密钥）都从 .env 读取，绝不写死在代码里、绝不提交到 git。
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`缺少必需的环境变量：${name}，请在 server/.env 中配置`);
  }
  return value;
}

// mockLogin = true 时跳过微信，直接用 code 当伪 openid，方便本地联调
const mockLogin = process.env.MOCK_LOGIN === 'true';

export const config = {
  port: Number(process.env.PORT ?? 3000),

  mockLogin,

  // 微信小程序凭证（mock 模式下可以留空）
  wxAppId: mockLogin ? (process.env.WX_APPID ?? '') : required('WX_APPID', process.env.WX_APPID),
  wxSecret: mockLogin ? (process.env.WX_SECRET ?? '') : required('WX_SECRET', process.env.WX_SECRET),

  // 给客户端签发 token 用的密钥；本地随便填，生产必须是长随机串
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-change-me',

  // token 有效期（秒），默认 7 天
  tokenTtl: Number(process.env.TOKEN_TTL ?? 60 * 60 * 24 * 7),
} as const;
