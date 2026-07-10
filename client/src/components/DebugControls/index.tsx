import { View, Text, Picker } from '@tarojs/components'
import { ROLE_META, type PublicRoom, type Role } from '@avalon/shared'
import './index.scss'

interface DebugControlsProps {
  room: PublicRoom
  debugRoles: Record<string, Role>
  roleOptions: Role[]
  onRoleChange(openid: string, role: Role): void
}

export default function DebugControls({ room, debugRoles, roleOptions, onRoleChange }: DebugControlsProps) {
  const roleOptionLabels = roleOptions.map((role) => ROLE_META[role].name)

  return (
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
                  if (nextRole) onRoleChange(p.openid, nextRole)
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
  )
}
