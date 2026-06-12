import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { ensureLogin } from './utils/auth'

import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    // 小程序启动时静默登录：本地有 token 就跳过，没有就自动换一个
    ensureLogin()
      .then(() => console.log('登录完成'))
      .catch((e) => console.error('登录失败：', e))
  })

  // children 是将要会渲染的页面
  return children
}

export default App
