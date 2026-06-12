import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { login, getToken } from '../../utils/auth'
import { request } from '../../utils/request'
import { connectSocket, sendMessage, onMessage } from '../../utils/socket'
import './index.scss'

export default function Index () {
  const [openid, setOpenid] = useState('')
  const [token, setTokenState] = useState('')
  const [wsLog, setWsLog] = useState<string[]>([])

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

  const log = (line: string) =>
    setWsLog((prev) => [...prev.slice(-6), line])

  // 连接 WebSocket，并订阅服务端推来的消息
  const handleConnect = async () => {
    try {
      await connectSocket()
      onMessage((msg) => log(`收到: ${JSON.stringify(msg)}`))
      log('已连接')
    } catch (e: any) {
      log(`连接失败: ${e.message}`)
    }
  }

  // 进一个测试房间，再发一条聊天，验证「发消息 → 广播回来」
  const handleJoinAndChat = () => {
    sendMessage({ type: 'JOIN', roomId: 'TEST' })
    sendMessage({ type: 'CHAT', text: 'hello avalon' })
  }

  return (
    <View className='index'>
      <Text>Avalon 登录 + WebSocket 演示</Text>

      <View style={{ marginTop: '20px' }}>
        <Button onClick={handleLogin}>登录（Taro.login → 换 token）</Button>
        <Button onClick={handleWhoAmI} style={{ marginTop: '12px' }}>
          调用 /api/me（验证 token）
        </Button>
      </View>

      <View style={{ marginTop: '20px' }}>
        <Button onClick={handleConnect}>连接 WebSocket</Button>
        <Button onClick={handleJoinAndChat} style={{ marginTop: '12px' }}>
          进房间 TEST 并发消息
        </Button>
      </View>

      <View style={{ marginTop: '20px' }}>
        <Text>token: {token ? `${token.slice(0, 24)}...` : '（未登录）'}</Text>
      </View>
      <View style={{ marginTop: '8px' }}>
        <Text>openid: {openid || '（点上面按钮获取）'}</Text>
      </View>

      <View style={{ marginTop: '16px' }}>
        <Text>WS 日志：</Text>
        {wsLog.map((line, i) => (
          <View key={i}><Text style={{ fontSize: '12px' }}>{line}</Text></View>
        ))}
      </View>
    </View>
  )
}
