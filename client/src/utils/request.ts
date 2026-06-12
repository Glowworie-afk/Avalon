import Taro from '@tarojs/taro';

/**
 * 统一的请求封装：
 * - 自动拼上后端地址
 * - 自动带上本地存的 token（Authorization: Bearer xxx）
 * - 401 时自动清掉过期 token
 */

// 后端地址。本地用微信开发者工具调试时，记得勾上
// "详情 -> 本地设置 -> 不校验合法域名"，否则 http://localhost 会被拦。
// 正式上线要换成 https 域名，并在小程序后台配置 request 合法域名。
const BASE_URL = 'http://localhost:3000';

const TOKEN_KEY = 'token';

export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) || '';
}

export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY);
}

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown>;
  /** 是否需要带 token，默认 true。登录接口本身设为 false */
  auth?: boolean;
}

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, auth = true } = options;

  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) header.Authorization = `Bearer ${token}`;
  }

  const res = await Taro.request({
    url: `${BASE_URL}${url}`,
    method,
    data,
    header,
  });

  if (res.statusCode === 401) {
    clearToken();
    throw new Error('未登录或登录已过期');
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`请求失败：${res.statusCode}`);
  }

  return res.data as T;
}
