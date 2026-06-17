import { useEffect, useRef, useState } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { ensureSocket, sendMessage, onMessage } from '../../utils/socket'
import { ensureLogin, whoAmI } from '../../utils/auth'
import { getProfile } from '../../utils/profile'
import RoleConfig from '../../components/RoleConfig'
import GameBoard from '../../components/GameBoard'
import {
  ClientEvent,
  ServerEvent,
  type PublicRoom,
  type GameConfig,
  type RoomUpdatePayload,
  type ErrorPayload,
  type VoteResultPayload,
  type GameOverPayload,
} from '@avalon/shared'
import './index.scss'

/**
 * 房间页（大厅）。承载两种入口：
 *   mode=create —— 进来后发 CREATE_ROOM（带配置），服务端建房并回 ROOM_UPDATE。
 *   mode=join   —— 进来后发 JOIN_ROOM（带房间号）。
 * 之后所有人靠 ROOM_UPDATE 全量刷新，房主可改配置 / 开始，其他人准备。
 */
export default function Room() {
  const router = useRouter()
  const mode = router.params.mode ?? 'join'

  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [myOpenid, setMyOpenid] = useState('')
  const [voteResult, setVoteResult] = useState<VoteResultPayload | null>(null)
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null)
  // 分享回调可能拿到旧闭包，用 ref 保证读到最新房间号
  const roomIdRef = useRef('')

  // 转发给好友 / 群：分享卡片的 path 带上房间号，对方点开直达本房间自动加入
  useShareAppMessage(() => ({
    title: '快来玩阿瓦隆！点我直接加入房间',
    path: roomIdRef.current
      ? `/pages/room/index?mode=join&roomId=${roomIdRef.current}`
      : '/pages/index/index',
  }))

  useEffect(() => {
    let unsub = () => {}
    ;(async () => {
      try {
        await ensureLogin()
        // 通过分享链接进来的人可能还没注册，先去填名称/头像
        if (mode === 'join') {
          const profile = await getProfile()
          if (!profile) {
            Taro.redirectTo({
              url: `/pages/register/index?intent=join&roomId=${router.params.roomId}`,
            })
            return
          }
        }
        setMyOpenid(await whoAmI())
        await ensureSocket()
        unsub = onMessage((msg) => {
          if (msg.type === ServerEvent.ROOM_UPDATE) {
            const r = (msg.payload as RoomUpdatePayload).room
            roomIdRef.current = r.roomId
            setRoom(r)
          } else if (msg.type === ServerEvent.ERROR) {
            Taro.showToast({ title: (msg.payload as ErrorPayload).message, icon: 'none' })
          } else if (msg.type === ServerEvent.GAME_STARTED) {
            Taro.showToast({ title: '游戏开始', icon: 'none' })
          } else if (msg.type === ServerEvent.VOTE_RESULT) {
            setVoteResult(msg.payload as VoteResultPayload)
          } else if (msg.type === ServerEvent.GAME_OVER) {
            setGameOver(msg.payload as GameOverPayload)
          }
        })

        if (mode === 'create') {
          const config: GameConfig = {
            playerCount: Number(router.params.pc ?? 5),
            useLancelot: router.params.lan === '1',
            useLadyOfLake: router.params.lake === '1',
          }
          sendMessage(ClientEvent.CREATE_ROOM, { config })
        } else {
          sendMessage(ClientEvent.JOIN_ROOM, { roomId: router.params.roomId })
        }
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '连接失败', icon: 'none' })
      }
    })()
    return () => unsub()
  }, [])

  const me = room?.players.find((p) => p.openid === myOpenid)
  const isHost = !!me?.isHost
  const total = room?.config.playerCount ?? 0
  const joined = room?.players.length ?? 0

  const copyCode = () => {
    if (!room) return
    Taro.setClipboardData({ data: room.roomId })
  }

  const onConfigChange = (config: GameConfig) => {
    if (!isHost) return
    sendMessage(ClientEvent.UPDATE_CONFIG, { config })
  }

  const toggleReady = () => sendMessage(ClientEvent.TOGGLE_READY, {})
  const startGame = () => sendMessage(ClientEvent.START_GAME, {})

  const leave = () => {
    sendMessage(ClientEvent.LEAVE_ROOM, {})
    Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/index/index' }))
  }

  if (!room) {
    return (
      <View className='room room-loading'>
        <Text>连接中…</Text>
      </View>
    )
  }

  // 游戏已开始：渲染对局面板
  if (room.status === 'playing' && room.game) {
    return (
      <View className='room'>
        <GameBoard room={room} myOpenid={myOpenid} voteResult={voteResult} gameOver={gameOver} />
      </View>
    )
  }

  const allReady = room.players.every((p) => p.isReady)
  const canStart = isHost && joined === total && allReady

  return (
    <View className='room'>
      {/* 房间号 + 邀请 */}
      <View className='room-header'>
        <View className='code-wrap' onClick={copyCode}>
          <Text className='code-label'>房间号</Text>
          <Text className='code'>{room.roomId}</Text>
        </View>
        <Text className='count'>{joined}/{total} 人</Text>
      </View>

      <Button className='invite-btn' openType='share'>
        邀请好友 / 分享到群
      </Button>

      {/* 配置（房主可改，其他人只读） */}
      <RoleConfig config={room.config} editable={isHost} onChange={onConfigChange} />

      {/* 玩家列表 */}
      <View className='players'>
        {room.players.map((p) => (
          <View key={p.openid} className={`player ${p.connected ? '' : 'offline'}`}>
            <View className='avatar'>
              {p.avatarUrl ? (
                <Image className='avatar-img' src={p.avatarUrl} mode='aspectFill' />
              ) : (
                <Text className='avatar-fallback'>{p.nickname.slice(0, 1)}</Text>
              )}
            </View>
            <Text className='nickname'>{p.nickname}</Text>
            {p.isHost ? (
              <Text className='badge host'>房主</Text>
            ) : p.isReady ? (
              <Text className='badge ready'>已准备</Text>
            ) : (
              <Text className='badge waiting'>未准备</Text>
            )}
          </View>
        ))}
      </View>

      {/* 底部操作 */}
      <View className='footer'>
        {isHost ? (
          <Button className='btn-main' disabled={!canStart} onClick={startGame}>
            {joined < total ? `还差 ${total - joined} 人` : allReady ? '开始游戏' : '等待玩家准备'}
          </Button>
        ) : (
          <Button className={`btn-main ${me?.isReady ? 'cancel' : ''}`} onClick={toggleReady}>
            {me?.isReady ? '取消准备' : '准备'}
          </Button>
        )}
        <Button className='btn-leave' onClick={leave}>
          退出房间
        </Button>
      </View>
    </View>
  )
}
