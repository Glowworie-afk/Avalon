import { useState, useMemo } from 'react'
import { View, Text, Button, Switch } from '@tarojs/components'
import Taro from '@tarojs/taro'
// 直接引用 shared 提供的配置和工具函数[cite: 15]
import { buildRoleList, groupRolesByTeam, ROLE_META, type GameConfig } from '@avalon/shared'
import './index.scss'

// 辅助函数：将相同角色合并，用于展示 "X2" "X3"
function aggregateRoles(roleIds: string[]) {
  const counts: Record<string, number> = {}
  roleIds.forEach(id => {
    counts[id] = (counts[id] || 0) + 1
  })
  
  return Object.entries(counts).map(([id, count]) => ({
    id,
    count,
    meta: ROLE_META[id as keyof typeof ROLE_META] // 获取角色中文名等元数据[cite: 15]
  }))
}

export default function Create() {
  const [config, setConfig] = useState<GameConfig>({
    playerCount: 5,
    useLancelot: false,
    useLadyOfLake: false,
  })

  // 监听人数变化：如果选了 5 或 6 人，自动关闭需要 7 人以上的扩展包
  const handleCountChange = (num: number) => {
    setConfig(prev => {
      const next = { ...prev, playerCount: num }
      if (num < 7) {
        next.useLancelot = false
        next.useLadyOfLake = false
      }
      return next
    })
  }

  // 监听扩展开关：如果开启且当前人数小于 7，自动把人数拉到 7 人
  const handleExtensionToggle = (ext: 'useLancelot' | 'useLadyOfLake', value: boolean) => {
    setConfig(prev => {
      const next = { ...prev, [ext]: value }
      if (value && next.playerCount < 7) {
        next.playerCount = 7
      }
      return next
    })
  }

  // 利用 shared 提供的方法，生成真实对局的角色列表并进行红蓝分组[cite: 15]
  const roles = useMemo(() => {
    const roleList = buildRoleList(config.playerCount, config)
    const grouped = groupRolesByTeam(roleList)
    
    return {
      good: aggregateRoles(grouped.good),
      evil: aggregateRoles(grouped.evil),
      goodTotal: grouped.good.length,
      evilTotal: grouped.evil.length
    }
  }, [config])

  const create = () => {
    const { playerCount, useLancelot, useLadyOfLake } = config
    Taro.navigateTo({
      url: `/pages/room/index?mode=create&pc=${playerCount}&lan=${useLancelot ? 1 : 0}&lake=${useLadyOfLake ? 1 : 0}`,
    })
  }

  return (
    <View className='create-page'>

      <View className='content'>
        {/* 1. 人数选择器 */}
        <View className='player-count-selector'>
          {[5, 6, 7, 8, 9, 10].map(num => (
            <View 
              key={num}
              className={`count-pill ${config.playerCount === num ? 'active' : ''}`}
              onClick={() => handleCountChange(num)}
            >
              <Text>{num}</Text>
            </View>
          ))}
        </View>

        {/* 2. 阵营角色直观展示 (合并同类项版) */}
        <View className='faction-board'>
          {/* 蓝方：好人阵营 */}
          <View className='faction good'>
            <View className='faction-header'>
              <Text className='faction-title'>好人</Text>
              <Text className='faction-count'>{roles.goodTotal} 人</Text>
            </View>
            <View className='role-list'>
              {roles.good.map((item) => (
                <View key={item.id} className='role-item'>
                  <View className='role-info'>
                    <Text className='role-icon'>🛡️</Text>
                    <Text className='role-name'>{item.meta.name}</Text>
                  </View>
                  {item.count > 1 && <Text className='role-badge'>X{item.count}</Text>}
                </View>
              ))}
            </View>
          </View>

          {/* 红方：坏人阵营 */}
          <View className='faction evil'>
            <View className='faction-header'>
              <Text className='faction-title'>坏人</Text>
              <Text className='faction-count'>{roles.evilTotal} 人</Text>
            </View>
            <View className='role-list'>
              {roles.evil.map((item) => (
                <View key={item.id} className='role-item'>
                  <View className='role-info'>
                    <Text className='role-icon'>🗡️</Text>
                    <Text className='role-name'>{item.meta.name}</Text>
                  </View>
                  {item.count > 1 && <Text className='role-badge'>X{item.count}</Text>}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 3. 扩展包开关 */}
        <View className='extension-panel'>
          <View className='ext-item'>
            <View className='ext-info'>
              <Text className='ext-name'>湖中仙女</Text>
              <Text className='ext-desc'>查验阵营 (适合7人以上)</Text>
            </View>
            <Switch 
              color="#eab308" 
              checked={config.useLadyOfLake}
              onChange={(e) => handleExtensionToggle('useLadyOfLake', e.detail.value)}
            />
          </View>
          <View className='ext-item'>
            <View className='ext-info'>
              <Text className='ext-name'>兰斯洛特</Text>
              <Text className='ext-desc'>阵营可能会反转</Text>
            </View>
            <Switch 
              color="#eab308" 
              checked={config.useLancelot}
              onChange={(e) => handleExtensionToggle('useLancelot', e.detail.value)}
            />
          </View>
        </View>
      </View>

      {/* 4. 底部确认按钮 */}
      <View className='bottom-area'>
        <Button className='create-btn' onClick={create}>
          确认配置并建房
        </Button>
      </View>
    </View>
  )
}