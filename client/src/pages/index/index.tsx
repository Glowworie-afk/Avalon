import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { login, getToken } from '../../utils/auth'
import { request } from '../../utils/request'
import './index.scss'

export default function Index () {
  const [openid, setOpenid] = useState('')
  const [token, setTokenState] = useState('')

  useLoad(() => {
    console.log('Page loaded.')
    setTokenState(getToken())
  })

  // 手动触发一次登录（App 启动时其实已自动登录过，这里方便演示 / 重试）
  const handleLogin = async () => {
    try {
      const res = await login()
      setTokenState(res.token)
      setOpenid(res.openid)
    } catch (e) {
      console.error(e)
    }
  }

  // 调用受保护接口，验证 token 确实能认出"我是谁"
  const handleWhoAmI = async () => {
    try {
      const res = await request<{ openid: string }>({ url: '/api/me' })
      setOpenid(res.openid)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <View className='index'>
      <Text>Avalon 登录演示</Text>
      <View style={{ marginTop: '20px' }}>
        <Button onClick={handleLogin}>登录（Taro.login → 换 token）</Button>
        <Button onClick={handleWhoAmI} style={{ marginTop: '12px' }}>
          调用 /api/me（验证 token）
        </Button>
      </View>
      <View style={{ marginTop: '20px' }}>
        <Text>token: {token ? `${token.slice(0, 24)}...` : '（未登录）'}</Text>
      </View>
      <View style={{ marginTop: '8px' }}>
        <Text>openid: {openid || '（点上面按钮获取）'}</Text>
      </View>
    </View>
  )
}
