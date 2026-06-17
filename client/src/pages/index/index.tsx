import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ensureLogin } from '../../utils/auth'
import { getProfile } from '../../utils/profile'
import './index.scss'

/**
 * 首页：创建房间。
 * 加入房间不再输码——房主在房间页点「邀请」分享给好友/群，对方点开分享卡片直接进房。
 * 创建前先做注册检测：没填过名称/头像就先去注册页。
 */
export default function Index() {
  const [busy, setBusy] = useState(false)

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

  return (
    <View className='index'>
      <View className='hero'>
        <Text className='title'>阿瓦隆</Text>
        <Text className='subtitle'>发牌器 · 5–10 人</Text>
      </View>

      <Button className='btn-primary' loading={busy} onClick={onCreate}>
        创建房间
      </Button>

      <Text className='tip'>建好房后，点「邀请」把链接发给好友或群，对方点开即可加入</Text>
    </View>
  )
}
