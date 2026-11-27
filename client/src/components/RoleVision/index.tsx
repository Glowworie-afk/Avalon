import { View, Text, Image } from '@tarojs/components'
import type { PublicRoom, RoleInfo } from '@avalon/shared'
import { visiblePlayers } from './visiblePlayers'
import './index.scss'

export default function RoleVision({ room, roleInfo }: { room: PublicRoom; roleInfo: RoleInfo | null }) {
  const players = visiblePlayers(roleInfo).flatMap(item => {
    const player = room.players.find(p => p.openid === item.openid)
    return player ? [{ ...item, player }] : []
  })
  return (
    <View className='role-vision-panel'>
      <Text className='role-vision-title'>你能看到的身份信息</Text>
      {players.length ? (
        <View className='role-vision-list'>
          {players.map(({ openid, label, player }) => (
            <View key={openid} className={'role-vision-player ' + (roleInfo?.role === 'percival' ? 'mystery' : 'evil')}>
              <View className='role-vision-avatar'>
                {player.avatarUrl ? <Image src={player.avatarUrl} className='role-vision-img' /> : <Text className='role-vision-fallback'>{player.nickname.slice(0, 1)}</Text>}
                <Text className='role-vision-seat'>{player.seat + 1}</Text>
              </View>
              <Text className='role-vision-name'>{player.nickname}</Text>
              <Text className='role-vision-label'>{label}</Text>
            </View>
          ))}
        </View>
      ) : <Text className='role-vision-empty'>当前身份没有额外可见信息</Text>}
    </View>
  )
}
