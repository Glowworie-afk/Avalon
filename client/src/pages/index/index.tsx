import { useState, useEffect } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ensureLogin } from '../../utils/auth'
import { getProfile, saveProfile } from '../../utils/profile'
import { request, setToken } from '../../utils/request'
import './index.scss'

// 角色展示数据源
const ROLES_SHOWCASE = [
  { id: 'merlin', name: '梅林', team: 'good', icon: '👁️', desc: '好人阵营领袖。你能看到所有的坏人（莫德雷德除外）。请隐藏好自己，别被刺客发现！' },
  { id: 'assassin', name: '刺客', team: 'evil', icon: '🗡️', desc: '坏人阵营核心。如果好人完成三次任务，你将在最后刺杀梅林，绝地翻盘！' },
  { id: 'percival', name: '派西维尔', team: 'good', icon: '🛡️', desc: '梅林的护卫。你能看到梅林和莫甘娜，但无法分辨谁是谁。' },
  { id: 'morgana', name: '莫甘娜', team: 'evil', icon: '🔮', desc: '邪恶的女巫。你会伪装成梅林，迷惑派西维尔的视线。' },
  { id: 'mordred', name: '莫德雷德', team: 'evil', icon: '👑', desc: '坏人阵营大BOSS。你的身份对梅林隐形，是刺入好人内部的利刃。' },
]

interface LoginResult {
  token: string
  openid: string
}

export default function Index() {
  const [busy, setBusy] = useState(false)
  const [roleIdx, setRoleIdx] = useState(0)
  
  // 玩家状态（头像留空则展示文字占位）
  const [user, setUser] = useState({ nickname: '玩家', avatarUrl: '', avatarText: '玩' })

  // 页面显示时，抓取真实用户信息同步到左上角头像
  useDidShow(() => {
    getProfile().then(profile => {
      if (profile) {
        setUser({
          nickname: profile.nickname || '玩家',
          avatarUrl: profile.avatarUrl || '',
          avatarText: (profile.nickname || '玩').charAt(0)
        })
      }
    }).catch(() => {})
  })

  // 自动轮播逻辑：利用 React key 的变动触发 SCSS 里面的 @keyframes 动画
  useEffect(() => {
    const timer = setInterval(() => {
      setRoleIdx((prevIdx) => (prevIdx + 1) % ROLES_SHOWCASE.length)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  const currentRole = ROLES_SHOWCASE[roleIdx]

  // 建房主流程
  const onCreate = async () => {
    if (busy) return
    setBusy(true)
    try {
      await ensureLogin()
      const profile = await getProfile()
      Taro.navigateTo({
        url: profile ? '/pages/create/index' : '/pages/register/index?intent=create',
      })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '网络错误', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const loginAsTestUser = async (id: number) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await request<LoginResult>({
        url: '/api/login',
        method: 'POST',
        data: { code: `user${id}` },
        auth: false,
      })
      setToken(result.token)
      const profile = await saveProfile({
        nickname: `测试玩家${id}`,
        avatarUrl: '',
      })
      setUser({
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        avatarText: profile.nickname.charAt(0),
      })
      Taro.showToast({ title: `已登录测试玩家${id}`, icon: 'none' })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '测试登录失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  // 点击头像跳转到我们刚刚重构好的独立修改资料页
  const handleEditProfile = () => {
    Taro.navigateTo({ url: '/pages/register/index?intent=edit' })
  }

  return (
    <View className='index-page'>
      
      {/* 1. 左上角头像 (点击跳转修改资料) */}
      <View className='avatar-wrap'>
        <Button 
          className='avatar-btn'
          onClick={handleEditProfile}
        >
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} className='avatar-img' />
          ) : (
             <Text>{user.avatarText}</Text>
          )}
        </Button>
      </View>

      {/* 2. 中部核心视觉：角色轮播卡片 */}
      <View className='card-area'>
        <View className='role-card'>
          {/* 背景阵营呼吸辉光 */}
          <View className={`glow ${currentRole.team}`} />

          {/* 重点：此处的 key=currentRole.id 能保证每次切换自动重置 CSS 动画 */}
          <View key={currentRole.id} className='content'>
            <View className={`team-badge ${currentRole.team}`}>
              {currentRole.team === 'good' ? '好人阵营' : '坏人阵营'}
            </View>
            
            <View className='icon-wrap'>
              <Text>{currentRole.icon}</Text>
            </View>
            
            <Text className='role-name'>{currentRole.name}</Text>
            <View className='divider' />
            <Text className='role-desc'>{currentRole.desc}</Text>
          </View>
        </View>
      </View>

      {/* 3. 底部建房按钮 */}
      <View className='bottom-area'>
        <View className='dev-login-panel'>
          <Text className='dev-title'>本地联调用户</Text>
          <View className='dev-user-grid'>
            {[1, 2, 3, 4, 5].map((id) => (
              <Button
                key={id}
                className='dev-user-btn'
                disabled={busy}
                onClick={() => loginAsTestUser(id)}
              >
                P{id}
              </Button>
            ))}
          </View>
        </View>
        <Button className='create-btn' loading={busy} onClick={onCreate}>
          创建房间
        </Button>
      </View>

    </View>
  )
}
