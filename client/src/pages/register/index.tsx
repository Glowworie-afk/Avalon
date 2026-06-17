import { useState } from 'react'
import { View, Text, Button, Input, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { saveProfile } from '../../utils/profile'
import './index.scss'

/**
 * 注册页：填昵称 + 选头像。
 * 头像用微信「头像昵称填写能力」：button open-type=chooseAvatar；
 * 昵称用 input type=nickname，可一键带出微信昵称。
 *
 * 注意：chooseAvatar 拿到的是临时路径，正式上线需上传到服务器/对象存储换永久 URL，
 * 否则换设备/重启后头像会失效。Day 2 先存临时路径，单机联调够用。
 */
export default function Register() {
  const router = useRouter()
  const intent = router.params.intent ?? 'create'
  const roomId = router.params.roomId ?? ''

  const [nickname, setNickname] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const onChooseAvatar = (e: any) => setAvatarUrl(e.detail.avatarUrl)

  const submit = async () => {
    const name = nickname.trim()
    if (!name) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await saveProfile({ nickname: name, avatarUrl })
      if (intent === 'join') {
        Taro.redirectTo({ url: `/pages/room/index?mode=join&roomId=${roomId}` })
      } else {
        Taro.redirectTo({ url: '/pages/create/index' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className='register'>
      <Text className='reg-title'>设置你的资料</Text>

      <Button className='avatar-btn' openType='chooseAvatar' onChooseAvatar={onChooseAvatar}>
        {avatarUrl ? (
          <Image className='avatar-img' src={avatarUrl} mode='aspectFill' />
        ) : (
          <View className='avatar-placeholder'>
            <Text className='avatar-plus'>＋</Text>
            <Text className='avatar-tip'>选择头像</Text>
          </View>
        )}
      </Button>

      <Input
        className='nickname-input'
        type='nickname'
        placeholder='输入昵称'
        maxlength={20}
        value={nickname}
        onInput={(e) => setNickname(e.detail.value)}
        onBlur={(e) => setNickname(e.detail.value)}
      />

      <Button className='submit-btn' loading={saving} onClick={submit}>
        确定
      </Button>
    </View>
  )
}
