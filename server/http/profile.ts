import { Router } from 'express'
import { authGuard } from '../middleware/auth'
import { getUser, saveUser } from '../store/userStore'

/**
 * 用户资料接口（对应「注册检测 + 填名称/头像」）。
 *   GET  /api/profile  -> { profile: { nickname, avatarUrl } | null }
 *   POST /api/profile  body { nickname, avatarUrl } -> { ok, profile }
 *
 * openid 由 authGuard 从 token 解析，挂在 req.openid 上，客户端无需也不应自己传。
 */

const router = Router()

router.get('/profile', authGuard, async (req, res) => {
  const profile = await getUser(req.openid!)
  res.json({ profile })
})

router.post('/profile', authGuard, async (req, res) => {
  const { nickname, avatarUrl } = req.body ?? {}
  if (typeof nickname !== 'string' || nickname.trim() === '') {
    return res.status(400).json({ error: 'nickname 必填' })
  }
  const profile = {
    nickname: nickname.trim().slice(0, 20), // 限长，防超长昵称
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : '',
  }
  await saveUser(req.openid!, profile)
  res.json({ ok: true, profile })
})

export default router
