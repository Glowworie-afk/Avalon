import { request } from './request'

/** 用户资料（昵称 + 头像），对应后端 /api/profile */
export interface Profile {
  nickname: string
  avatarUrl: string
}

/** 查询当前用户资料；没注册过返回 null */
export async function getProfile(): Promise<Profile | null> {
  const res = await request<{ profile: Profile | null }>({ url: '/api/profile' })
  return res.profile
}

/** 保存（注册/更新）资料 */
export async function saveProfile(p: Profile): Promise<Profile> {
  const res = await request<{ ok: boolean; profile: Profile }>({
    url: '/api/profile',
    method: 'POST',
    data: { nickname: p.nickname, avatarUrl: p.avatarUrl },
  })
  return res.profile
}
