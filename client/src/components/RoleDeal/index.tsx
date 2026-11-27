import { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { ROLE_META, type RoleInfo, type PublicRoom } from '@avalon/shared'
import RoleVision from '../RoleVision'
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

          <RoleVision room={room} roleInfo={roleInfo} />

          <Button className='confirm-btn' onClick={onComplete}>
            确认身份并入局
          </Button>
        </View>
      )}
    </View>
  )
}
