import { View, Text } from '@tarojs/components'
import { ROLE_META, MISSION_TEAM_SIZE, type GameOverPayload, type PublicRoom } from '@avalon/shared'

export default function GameResults({ room, gameOver }: { room: PublicRoom; gameOver: GameOverPayload }) {
  const game = room.game!
  const questSizes = MISSION_TEAM_SIZE[room.config.playerCount] ?? []
  const successCount = game.questResults.filter(result => result === 'success').length
  const failCount = game.questResults.filter(result => result === 'fail').length

    const revealedRoles = gameOver.revealedRoles ?? []
    const goodRoles = revealedRoles.filter((p) => p.team === 'good')
    const evilRoles = revealedRoles.filter((p) => p.team === 'evil')

    const renderRoleColumn = (team: 'good' | 'evil', title: string, players: typeof revealedRoles) => (
      <View className={'reveal-column ' + team}>
        <View className='reveal-column-head'>
          <Text className='reveal-column-title'>{title}</Text>
          <Text className='reveal-column-count'>{players.length} 人</Text>
        </View>
        {players.map((p) => {
          const meta = ROLE_META[p.role]
          return (
            <View key={p.openid} className='reveal-row'>
              <Text className='reveal-seat'>{p.seat + 1}</Text>
              <View className='reveal-identity'>
                <Text className='reveal-player'>{p.nickname}</Text>
                <Text className='reveal-role'>{meta.name}</Text>
              </View>
            </View>
          )
        })}
      </View>
    )

    return (
      <View className='game-board game-over-board'>
        <View className={'game-over-hero ' + gameOver.winner}>
          <Text className='game-over-kicker'>最终结算</Text>
          <Text className='game-over-title'>
            {gameOver.winner === 'good' ? '好人阵营胜利' : '坏人阵营胜利'}
          </Text>
          <Text className='game-over-reason'>{gameOver.reason}</Text>
        </View>

        <View className='final-score-panel'>
          <View className='final-score-card success'>
            <Text className='score-number'>{successCount}</Text>
            <Text className='score-label'>任务成功</Text>
          </View>
          <View className='final-mission-track'>
            {questSizes.map((size, index) => {
              const result = game.questResults[index]
              return (
                <View key={index} className={'final-mission-dot ' + (result ?? 'pending')}>
                  <Text className='final-round'>{index + 1}</Text>
                  <Text className='final-size'>{size}人</Text>
                </View>
              )
            })}
          </View>
          <View className='final-score-card fail'>
            <Text className='score-number'>{failCount}</Text>
            <Text className='score-label'>任务失败</Text>
          </View>
        </View>

        <View className='role-reveal-panel'>
          <Text className='role-reveal-title'>身份揭晓</Text>
          <View className='role-reveal-columns'>
            {renderRoleColumn('good', '好人阵营', goodRoles)}
            {renderRoleColumn('evil', '坏人阵营', evilRoles)}
          </View>
        </View>
      </View>
    )
}
