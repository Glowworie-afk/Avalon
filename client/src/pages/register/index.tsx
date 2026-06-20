import { useState, useEffect } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { saveProfile, getProfile } from '../../utils/profile'
import './index.scss'

/**
 * 注册与修改资料统一页面：填昵称 + 选头像。
 * 路由参数 intent 支持三种模式：
 * 'create': 保存后去建房页
 * 'join': 保存后带上 roomId 去加入房间
 * 'edit': 保存后直接返回上一页（如首页）
 */
export default function Register() {
  const router = useRouter()
  const intent = router.params.intent ?? 'create'
  const roomId = router.params.roomId ?? ''

  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // 页面加载时，尝试获取已有信息（用于 'edit' 模式回显）
  useEffect(() => {
    getProfile().then(profile => {
      if (profile) {
        setNickname(profile.nickname || '')
        setAvatarUrl(profile.avatarUrl || '')
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const onChooseAvatar = (e: any) => setAvatarUrl(e.detail.avatarUrl)

  const submit = async () => {
    const name = nickname.trim()
    if (!name) {
      Taro.showToast({ title: '总得有个代号吧，勇士', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      await saveProfile({ nickname: name, avatarUrl })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      
      // 延迟一点跳转，让用户看清成功提示
      setTimeout(() => {
        if (intent === 'edit') {
          Taro.navigateBack() // 修改模式：直接返回首页
        } else if (intent === 'join') {
          Taro.redirectTo({ url: `/pages/room/index?mode=join&roomId=${roomId}` })
        } else {
          Taro.redirectTo({ url: '/pages/create/index' })
        }
      }, 800)
      
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <View className='register'>
      <View className='header-section'>
        <Text className='reg-title'>{intent === 'edit' ? '修改资料' : '建立档案'}</Text>
        <Text className='reg-subtitle'>获取属于你的阿瓦隆通行证</Text>
      </View>

      <Button 
        className={`avatar-btn ${avatarUrl ? 'has-avatar' : ''}`} 
        openType='chooseAvatar' 
        onChooseAvatar={onChooseAvatar}
      >
        {avatarUrl ? (
          <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
        ) : (
          <View className='avatar-placeholder'>
            <Text className='avatar-icon'>📷</Text>
            <Text className='avatar-tip'>点击获取</Text>
          </View>
        )}
      </Button>

      <View className='input-group'>
        <Text className='label'>骑士代号 (Nickname)</Text>
        <Input
          className='nickname-input'
          type='nickname'
          placeholder='在此输入或一键获取'
          placeholderTextColor='#475569'
          maxlength={8}
          value={nickname}
          onInput={(e) => setNickname(e.detail.value)}
          onBlur={(e) => setNickname(e.detail.value)}
        />
      </View>

      <Button className='submit-btn' loading={saving} onClick={submit}>
        {intent === 'edit' ? '保存更改' : '准备就绪'}
      </Button>
    </View>
  )
}