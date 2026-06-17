import { View, Text, Button, Switch } from '@tarojs/components'
import {
  buildRoleList,
  groupRolesByTeam,
  canUseLancelot,
  ROLE_META,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type GameConfig,
  type Role,
} from '@avalon/shared'
import './index.scss'

interface Props {
  config: GameConfig
  /** 可编辑（房主）= true；只读 = false */
  editable?: boolean
  onChange?: (c: GameConfig) => void
}

/** 把角色数组聚合成「名称 ×数量」 */
function tally(roles: Role[]): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of roles) {
    const name = ROLE_META[r].name
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return [...m.entries()].map(([name, count]) => ({ name, count }))
}

/**
 * 人数 + 兰斯洛特 + 湖中仙女 配置，并实时展示当前人数对应的角色构成。
 * 在建房页（可编辑）和房间页（房主可编辑 / 其他人只读）复用同一套渲染。
 */
export default function RoleConfig({ config, editable = false, onChange }: Props) {
  const set = (patch: Partial<GameConfig>) => onChange?.({ ...config, ...patch })

  const setCount = (n: number) => {
    const playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n))
    // 人数降到 7 以下时兰斯洛特自动关闭
    set({ playerCount, useLancelot: canUseLancelot(playerCount) ? config.useLancelot : false })
  }

  const lancelotOk = canUseLancelot(config.playerCount)
  const roles = buildRoleList(config.playerCount, config)
  const { good, evil } = groupRolesByTeam(roles)

  return (
    <View className='role-config'>
      {/* 人数选择 */}
      <View className='rc-row'>
        <Text className='rc-label'>游戏人数</Text>
        <View className='rc-stepper'>
          <Button
            className='rc-step-btn'
            disabled={!editable || config.playerCount <= MIN_PLAYERS}
            onClick={() => setCount(config.playerCount - 1)}
          >
            −
          </Button>
          <Text className='rc-count'>{config.playerCount}</Text>
          <Button
            className='rc-step-btn'
            disabled={!editable || config.playerCount >= MAX_PLAYERS}
            onClick={() => setCount(config.playerCount + 1)}
          >
            ＋
          </Button>
        </View>
      </View>

      {/* 扩展开关 */}
      <View className='rc-row'>
        <View className='rc-switch-label'>
          <Text className='rc-label'>兰斯洛特</Text>
          {!lancelotOk && <Text className='rc-hint'>需 7 人及以上</Text>}
        </View>
        <Switch
          checked={config.useLancelot && lancelotOk}
          disabled={!editable || !lancelotOk}
          onChange={(e) => set({ useLancelot: e.detail.value })}
        />
      </View>
      <View className='rc-row'>
        <Text className='rc-label'>湖中仙女</Text>
        <Switch
          checked={config.useLadyOfLake}
          disabled={!editable}
          onChange={(e) => set({ useLadyOfLake: e.detail.value })}
        />
      </View>

      {/* 实时角色构成 */}
      <View className='rc-roles'>
        <View className='rc-team rc-good'>
          <Text className='rc-team-title'>好人阵营 · {good.length}</Text>
          {tally(good).map((it) => (
            <Text key={it.name} className='rc-role-tag'>
              {it.name}{it.count > 1 ? ` ×${it.count}` : ''}
            </Text>
          ))}
        </View>
        <View className='rc-team rc-evil'>
          <Text className='rc-team-title'>坏人阵营 · {evil.length}</Text>
          {tally(evil).map((it) => (
            <Text key={it.name} className='rc-role-tag'>
              {it.name}{it.count > 1 ? ` ×${it.count}` : ''}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}
