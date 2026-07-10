import { useState, useEffect } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import { ROLE_META, type RoleInfo, type PublicRoom } from '@avalon/shared'
import './index.scss'

interface RoleDealProps {
  room: PublicRoom
  roleInfo: RoleInfo
  onComplete: () => void
}

// 用于动画闪烁的假角色池
const SHUFFLE_POOL = ['梅林', '派西维尔', '忠臣', '莫甘娜', '刺客', '奥伯伦', '爪牙', '莫德雷德']

export default function RoleDeal({ room, roleInfo, onComplete }: RoleDealProps) {
  const [isShuffling, setIsShuffling] = useState(true)
  const [flashName, setFlashName] = useState('洗牌中...')
  const roleMeta = ROLE_META[roleInfo.role]

  useEffect(() => {
    // 模拟洗牌动画：每 80ms 切换一次名字，持续 2 秒
    let count = 0
    const maxCount = 25 
    const timer = setInterval(() => {
      setFlashName(SHUFFLE_POOL[count % SHUFFLE_POOL.length])
      count++
      if (count > maxCount) {
        clearInterval(timer)
        setIsShuffling(false)
      }
    }, 80)

    return () => clearInterval(timer)
  }, [])

  // 获取我能看到的人的具体信息（头像、昵称、座位号）
  const knownPlayers = roleInfo.knownEvil?.map(openid => {
    const p = room.players.find(x => x.openid === openid)
    return p
  }).filter(Boolean)

  return (
    <View className='role-deal-container'>
      <View className='star-bg' /> {/* 模拟暗黑星空背景 */}

      {isShuffling ? (
        <View className='shuffle-box'>
          <Text className='shuffle-icon'>🃏</Text>
          <Text className='flash-name'>{flashName}</Text>
        </View>
      ) : (
        <View className={`reveal-box ${roleInfo.team}`}>
          <Text className='team-tag'>
            {roleInfo.team === 'good' ? '好人阵营' : '坏人阵营'}
          </Text>
          
          <Text className='role-icon'>
            {roleInfo.team === 'good' ? '🛡️' : '🗡️'}
          </Text>
          
          <Text className='role-name'>{roleMeta.name}</Text>
          <Text className='role-desc'>{roleMeta.desc}</Text>

          {/* 视野展示区：显示我能看到的人 */}
          {knownPlayers && knownPlayers.length > 0 && (
            <View className='vision-area'>
              <Text className='vision-title'>你眼中的特殊标记：</Text>
              <View className='vision-list'>
                {knownPlayers.map(p => (
                  <View key={p!.openid} className='target-player'>
                    <View className='avatar-wrap'>
                      {p!.avatarUrl ? (
                        <Image src={p!.avatarUrl} className='avatar' />
                      ) : (
                        <Text className='avatar-fallback'>{p!.nickname.slice(0, 1)}</Text>
                      )}
                      <Text className='seat-badge'>{p!.seat + 1}</Text>
                    </View>
                    <Text className='target-name'>{p!.nickname}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Button className='confirm-btn' onClick={onComplete}>
            确认身份并入局
          </Button>
        </View>
      )}
    </View>
  )
}
