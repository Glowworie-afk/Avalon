import { useEffect, useRef, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { ensureSocket, sendMessage, onMessage } from '../../utils/socket'
import { ensureLogin, whoAmI } from '../../utils/auth'
import { getProfile } from '../../utils/profile'
import RoleDeal from '../../components/RoleDeal'
import GameBoard from '../../components/GameBoard'
import {
  ClientEvent,
  ServerEvent,
  buildRoleList,
  ROLE_META,
  type PublicRoom,
  type GameConfig,
  type RoomUpdatePayload,
  type ErrorPayload,
  type VoteResultPayload,
  type QuestResultPayload,
  type GameOverPayload,
  type LadyResultPayload,
  type RoleInfoPayload,
  type RoleInfo,
  type Role,
} from '@avalon/shared'
import './index.scss'


export default function Room() {
  const router = useRouter()
  const mode = router.params.mode ?? 'join'

  const [room, setRoom] = useState<PublicRoom | null>(null)
  const [myOpenid, setMyOpenid] = useState('')
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null)
  const [voteResult, setVoteResult] = useState<VoteResultPayload | null>(null)
  const [questResult, setQuestResult] = useState<QuestResultPayload | null>(null)
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null)
  const [ladyResult, setLadyResult] = useState<LadyResultPayload | null>(null)
  const [dealDone, setDealDone] = useState(false)
  const [debugRoles, setDebugRoles] = useState<Record<string, Role>>({})
  const roomIdRef = useRef('')

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
          } else if (msg.type === ServerEvent.ROLE_INFO) {
            setRoleInfo((msg.payload as RoleInfoPayload).info)
          } else if (msg.type === ServerEvent.VOTE_RESULT) {
            setVoteResult(msg.payload as VoteResultPayload)
          } else if (msg.type === ServerEvent.QUEST_RESULT) {
            setQuestResult(msg.payload as QuestResultPayload)
          } else if (msg.type === ServerEvent.GAME_OVER) {
            setGameOver(msg.payload as GameOverPayload)
          } else if (msg.type === ServerEvent.LADY_RESULT) {
            const result = msg.payload as LadyResultPayload
            setLadyResult(result)
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
  }, [mode, router.params])

  useEffect(() => {
    if (!room || room.status !== 'waiting') return

    const rolePool = buildRoleList(room.config.playerCount, room.config)
    if (rolePool.length !== room.players.length) return

    setDebugRoles((prev) => {
      const next: Record<string, Role> = {}
      room.players
        .slice()
        .sort((a, b) => a.seat - b.seat)
        .forEach((player, index) => {
          next[player.openid] = prev[player.openid] ?? rolePool[index]!
        })
      return next
    })
  }, [room])


  const me = room?.players.find((p) => p.openid === myOpenid)
  const isHost = !!me?.isHost
  const total = room?.config.playerCount ?? 0
  const joined = room?.players.length ?? 0

  const roleOptions = room ? buildRoleList(room.config.playerCount, room.config) : []
  const roleOptionLabels = roleOptions.map((role) => ROLE_META[role].name)
  const showDebugRolePicker = isHost && joined === total && roleOptions.length === joined && room?.status === 'waiting'

  const toggleReady = () => sendMessage(ClientEvent.TOGGLE_READY, {})
  const startGame = () => {
    if (showDebugRolePicker) {
      sendMessage(ClientEvent.DEBUG_SET_ROLES, {
        assignments: room!.players.map((p) => ({
          openid: p.openid,
          role: debugRoles[p.openid] ?? roleOptions[p.seat]!,
        })),
      })
    }
    sendMessage(ClientEvent.START_GAME, {})
  }
  const debugFillBots = () => sendMessage(ClientEvent.DEBUG_FILL_BOTS, {})

  const leave = () => {
    sendMessage(ClientEvent.LEAVE_ROOM, {})
    Taro.navigateBack().catch(() => Taro.reLaunch({ url: '/pages/index/index' }))
  }

  if (!room) {
    return (
      <View className='room-page loading'>
        <Text className='loading-icon'>🛡️</Text>
        <Text>集结骑士中…</Text>
      </View>
    )
  }
  if ((room.status === 'playing' || gameOver) && room.game) {
    
    // 分支 A：发牌抽卡动画
    if (!gameOver && !dealDone && roleInfo) {
      // 👉 直接 return 组件，不要套在任何 View 里
      return <RoleDeal room={room} roleInfo={roleInfo} onComplete={() => setDealDone(true)} />
    }

    // 分支 B：正式进入对局主盘面
    // 👉 直接 return GameBoard，彻底摆脱 room-page 的样式束缚！
    return (
      <GameBoard
        room={room}
        myOpenid={myOpenid}
        roleInfo={roleInfo}
        voteResult={voteResult}
        questResult={questResult}
        gameOver={gameOver}
        ladyResult={ladyResult}
      />
    )
  }

  const canStart = isHost && joined === total && room.players.every((p) => p.isReady)
  const emptySlots = Array.from({ length: total - joined })

  return (
    <View className='room-page'>
      <View className='content'>
        <View className='room-summary'>
          <Text className='status-text'>等待骑士入座 ({joined}/{total})</Text>
          <View className='tags'>
            <Text className='tag'>{total} 人局</Text>
            {room.config.useLadyOfLake && <Text className='tag highlight'>湖中仙女</Text>}
            {room.config.useLancelot && <Text className='tag highlight'>兰斯洛特</Text>}
          </View>
        </View>

        <View className={`player-grid count-${total}`}>
          {room.players.map((p) => (
            <View key={p.openid} className={`seat occupied ${p.connected ? '' : 'offline'}`}>
              <View className={`avatar-wrap ${p.isReady ? 'is-ready' : ''}`}>
                {p.avatarUrl ? (
                  <Image className='avatar-img' src={p.avatarUrl} mode='aspectFill' />
                ) : (
                  <Text className='avatar-fallback'>{p.nickname.slice(0, 1)}</Text>
                )}
                {p.isHost && <Text className='host-crown'>👑</Text>}
              </View>
              <Text className='nickname'>{p.nickname}</Text>
              <Text className={`status-badge ${p.isReady ? 'ready' : 'waiting'}`}>
                {p.isReady ? '已准备' : '未准备'}
              </Text>
            </View>
          ))}

          {emptySlots.map((_, idx) => (
            <Button key={`empty-${idx}`} className='seat empty' openType='share'>
              <View className='dashed-circle'>
                <Text className='plus-icon'>+</Text>
              </View>
              <Text className='invite-text'>邀请好友</Text>
            </Button>
          ))}
        </View>
        {showDebugRolePicker && (
          <View className='debug-role-panel'>
            <Text className='debug-role-title'>测试角色配置</Text>
            {room.players
              .slice()
              .sort((a, b) => a.seat - b.seat)
              .map((p) => {
                const selectedRole = debugRoles[p.openid] ?? roleOptions[p.seat]!
                const selectedIndex = Math.max(0, roleOptions.indexOf(selectedRole))
                return (
                  <View key={p.openid} className='debug-role-row'>
                    <Text className='debug-player-name'>{p.seat + 1}. {p.nickname}</Text>
                    <Picker
                      mode='selector'
                      range={roleOptionLabels}
                      value={selectedIndex}
                      onChange={(e) => {
                        const nextRole = roleOptions[Number(e.detail.value)]
                        if (!nextRole) return
                        setDebugRoles((prev) => ({ ...prev, [p.openid]: nextRole }))
                      }}
                    >
                      <View className={'debug-role-picker ' + ROLE_META[selectedRole].team}>
                        <Text>{ROLE_META[selectedRole].name}</Text>
                      </View>
                    </Picker>
                  </View>
                )
              })}
          </View>
        )}
      </View>

      <View className='footer'>
        {isHost ? (
          <View className='host-actions'>
            <Button className='btn-secondary' disabled={joined === total} onClick={debugFillBots}>
              补齐测试玩家
            </Button>
            <Button className='btn-main' disabled={!canStart} onClick={startGame}>
              开始游戏 ({joined}/{total})
            </Button>
          </View>
        ) : (
          <Button className={`btn-main ${me?.isReady ? 'cancel' : ''}`} onClick={toggleReady}>
            {me?.isReady ? '取消准备' : '准备就绪'}
          </Button>
        )}
      </View>
    </View>
  )
}
