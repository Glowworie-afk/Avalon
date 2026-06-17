import { useState } from 'react'
import { View, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import RoleConfig from '../../components/RoleConfig'
import { MIN_PLAYERS, type GameConfig } from '@avalon/shared'
import './index.scss'

/**
 * 建房配置页：选人数 + 两个扩展开关，实时看到对应的角色构成。
 * 点「创建房间」后把配置带去房间页，由房间页真正发 CREATE_ROOM。
 */
export default function Create() {
  const [config, setConfig] = useState<GameConfig>({
    playerCount: MIN_PLAYERS,
    useLancelot: false,
    useLadyOfLake: false,
  })

  const create = () => {
    const { playerCount, useLancelot, useLadyOfLake } = config
    Taro.navigateTo({
      url: `/pages/room/index?mode=create&pc=${playerCount}&lan=${useLancelot ? 1 : 0}&lake=${useLadyOfLake ? 1 : 0}`,
    })
  }

  return (
    <View className='create'>
      <RoleConfig config={config} editable onChange={setConfig} />
      <Button className='create-btn' onClick={create}>
        创建房间
      </Button>
    </View>
  )
}
