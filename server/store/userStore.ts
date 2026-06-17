/**
 * 用户资料存储（昵称 + 头像）。
 *
 * 注册检测用它：登录拿到 openid 后查这里，有资料就直接进，没有就让用户填名称/头像。
 * 同样先用内存 Map，Redis 留口子。
 */

export interface UserProfile {
  nickname: string
  avatarUrl: string
}

const users = new Map<string, UserProfile>()

export async function getUser(openid: string): Promise<UserProfile | null> {
  return users.get(openid) ?? null
}

export async function saveUser(openid: string, profile: UserProfile): Promise<void> {
  users.set(openid, profile)
}

/** 仅供测试使用：清空 */
export async function _clearAllUsers(): Promise<void> {
  users.clear()
}
