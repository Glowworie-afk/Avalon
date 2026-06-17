import Taro from '@tarojs/taro';
import { request, setToken, getToken, clearToken } from './request';

/**
 * 登录流程（客户端这一半）：
 * 1. Taro.login() 拿到临时 code（5 分钟有效、一次性）
 * 2. 把 code POST 给后端 /api/login
 * 3. 后端拿 code 去微信换 openid，再签发一个自己的 token 返回
 * 4. 把 token 存到本地，之后所有请求都自动带上它
 */

interface LoginResult {
  token: string;
  openid: string;
}

/** 执行一次完整登录，返回后端发的 token */
export async function login(): Promise<LoginResult> {
  // 第 1 步：拿 code
  const { code } = await Taro.login();
  if (!code) {
    throw new Error('Taro.login 没拿到 code');
  }

  // 第 2、3 步：用 code 换 token（这个接口不需要带旧 token）
  const result = await request<LoginResult>({
    url: '/api/login',
    method: 'POST',
    data: { code },
    auth: false,
  });

  // 第 4 步：存 token
  setToken(result.token);
  return result;
}

/**
 * 确保已登录：本地有 token 就直接用，没有就走一次登录。
 * 适合在 App 启动时调用。
 */
export async function ensureLogin(): Promise<void> {
  if (getToken()) return;
  await login();
}

/** 查询当前登录用户的 openid（受保护接口，token 有效才返回） */
export async function whoAmI(): Promise<string> {
  const res = await request<{ openid: string }>({ url: '/api/me' });
  return res.openid;
}

export { getToken, clearToken };
