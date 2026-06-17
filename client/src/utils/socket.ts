import Taro from '@tarojs/taro'
import { getToken } from './request'
import { makeMessage, type Message, type EventType } from '@avalon/shared'

/**
 * WebSocket 封装（对应 Day 1）。
 *
 * 两个坑提前知道：
 * 1. 没有自动重连——连接断了不会自己恢复，要监听 onClose 手动重连（Day 9 专门做，这里先留口子）。
 * 2. 本地开发用 ws://localhost，需在微信开发者工具勾「不校验合法域名」；
 *    真机要 wss:// + 备案域名。
 */

// 与后端保持一致：本地 ws://localhost:3000，上线换成 wss://你的域名
const WS_BASE = 'ws://localhost:3000'

type Listener = (msg: Message) => void

let task: Taro.SocketTask | null = null
const listeners = new Set<Listener>()

/** 建立连接。token 通过 URL query 传，后端握手时据此认人 */
export function connectSocket(): Promise<Taro.SocketTask> {
  return new Promise((resolve, reject) => {
    const token = getToken()
    if (!token) {
      reject(new Error('未登录，无法建立 WebSocket'))
      return
    }

    Taro.connectSocket({ url: `${WS_BASE}?token=${token}` })
      .then((socketTask) => {
        task = socketTask

        socketTask.onOpen(() => {
          console.log('[ws] 已连接')
        })

        socketTask.onMessage((res) => {
          let msg: Message
          try {
            msg = JSON.parse(res.data as string)
          } catch {
            return
          }
          // 分发给所有订阅者
          listeners.forEach((fn) => fn(msg))
        })

        socketTask.onClose(() => {
          console.log('[ws] 断开了')
          task = null
          // Day 9：这里加指数退避重连
        })

        socketTask.onError((err) => {
          console.error('[ws] 出错:', err)
        })

        resolve(socketTask)
      })
      .catch(reject)
  })
}

/** 已连接就复用，没连接就建一条。页面进入时调用，避免重复连接 */
export function ensureSocket(): Promise<Taro.SocketTask> {
  if (task) return Promise.resolve(task)
  return connectSocket()
}

/** 按统一信封发送一条消息 */
export function sendMessage<T>(type: EventType, payload: T): void {
  if (!task) {
    console.warn('[ws] 未连接，消息未发送')
    return
  }
  task.send({ data: JSON.stringify(makeMessage(type, payload)) })
}

/** 订阅服务端推来的消息，返回取消订阅函数 */
export function onMessage(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 主动关闭连接 */
export function closeSocket(): void {
  task?.close({})
  task = null
}
