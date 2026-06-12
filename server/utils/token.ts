import crypto from 'node:crypto';
import { config } from '../config';

/**
 * 一个零依赖的 JWT（HS256）实现，只用 Node 自带的 crypto。
 *
 * token 结构： base64url(header).base64url(payload).base64url(signature)
 * - header / payload 是公开可读的（任何人都能 base64 解出来），所以别往里塞密码
 * - signature 用 jwtSecret 算出来，没有密钥就伪造不了，这是安全的关键
 */

interface TokenPayload {
  sub: string; // subject，这里存 openid
  iat: number; // 签发时间（秒）
  exp: number; // 过期时间（秒）
}

function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(data: string): string {
  return base64urlEncode(
    crypto.createHmac('sha256', config.jwtSecret).update(data).digest(),
  );
}

/** 用 openid 签发一个 token */
export function signToken(openid: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64urlEncode(
    JSON.stringify({ sub: openid, iat: now, exp: now + config.tokenTtl } satisfies TokenPayload),
  );
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

/**
 * 校验 token，成功返回 payload，失败返回 null。
 * 失败原因：格式不对 / 签名不匹配（被篡改或伪造）/ 已过期
 */
export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  // 用同样的密钥重新算一遍签名，和 token 里带的对比
  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(base64urlDecode(payload).toString('utf8')) as TokenPayload;
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) {
      return null; // 过期了
    }
    return data;
  } catch {
    return null;
  }
}
