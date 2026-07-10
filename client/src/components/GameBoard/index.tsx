import { useEffect, useState } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { sendMessage } from '../../utils/socket'
import {
  ClientEvent,
  MISSION_TEAM_SIZE,
  ROLE_META,
  failsRequired,
  type GameOverPayload,
  type LadyResultPayload,
  type PublicPlayer,
  type PublicRoom,
  type QuestResultPayload,
  type RoleInfo,
  type VoteResultPayload,
} from '@avalon/shared'
import './index.scss'

interface GameBoardProps {
  room: PublicRoom
  myOpenid: string
  roleInfo: RoleInfo | null
  voteResult?: VoteResultPayload | null
  questResult?: QuestResultPayload | null
  gameOver?: GameOverPayload | null
  ladyResult?: LadyResultPayload | null
}

export default function GameBoard({ room, myOpenid, roleInfo, questResult, gameOver, ladyResult }: GameBoardProps) {
  const game = room.game
  if (!game) return null

  const me = room.players.find(p => p.openid === myOpenid)
  const isMyTurn = room.players[game.leaderSeat]?.openid === myOpenid
  const isTeamMember = me ? game.proposedTeam.includes(me.seat) : false

  const questSizes = MISSION_TEAM_SIZE[room.config.playerCount] || [2, 3, 2, 3, 3]
  const currentTeamSize = questSizes[game.round - 1] ?? 0
  const leader = room.players.find((p) => p.seat === game.leaderSeat)
  const requiredFails = failsRequired(room.config.playerCount, game.round)

  // 本地状态：选人、查看身份
  const [localSelected, setLocalSelected] = useState<number[]>(game.proposedTeam || [])
  const [showRole, setShowRole] = useState(false) // 控制左上角眼睛的闭合状态
  const [dismissedLadyResultKey, setDismissedLadyResultKey] = useState('')

  useEffect(() => {
    setLocalSelected(game.proposedTeam || [])
  }, [game.phase, game.round, game.proposedTeam])

  const togglePlayerSelect = (seat: number) => {
    if (!isMyTurn || game.phase !== 'team_building') return
    if (localSelected.includes(seat)) {
      setLocalSelected(localSelected.filter(id => id !== seat))
    } else {
      if (localSelected.length >= currentTeamSize) {
        Taro.showToast({ title: '车队已满', icon: 'none' })
        return
      }
      setLocalSelected([...localSelected, seat])
    }
  }

  const submitTeam = () => {
    sendMessage(ClientEvent.PROPOSE_TEAM, { seats: localSelected })
  }

  const vote = (approve: boolean) => {
    sendMessage(ClientEvent.VOTE, { approve })
  }

  const submitQuest = (fail: boolean) => {
    sendMessage(ClientEvent.QUEST_ACTION, { fail })
  }

  const inspectLady = (targetOpenid: string) => {
    sendMessage(ClientEvent.LADY_INSPECT, { targetOpenid })
  }

  const assassinate = (targetOpenid: string) => {
    sendMessage(ClientEvent.ASSASSINATE, { targetOpenid })
  }

  const successCount = game.questResults.filter((result) => result === 'success').length
  const failCount = game.questResults.filter((result) => result === 'fail').length
  const phaseLabel = game.phase === 'team_building'
    ? '组建车队'
    : game.phase === 'voting'
      ? '全员投票'
      : game.phase === 'quest'
        ? '任务执行'
        : game.phase === 'lady'
          ? '湖中仙女'
          : game.phase === 'assassin'
            ? '刺杀梅林'
            : '结算中'
  const proposalSeats = game.phase === 'team_building' ? localSelected : game.proposedTeam
  const proposalPlayers = proposalSeats
    .map((seat) => room.players.find((p) => p.seat === seat))
    .filter((p): p is PublicPlayer => Boolean(p))
  const remainingSlots = Math.max(0, currentTeamSize - proposalPlayers.length)
  const proposalSlots = Array.from({ length: currentTeamSize }, (_, index) => proposalPlayers[index] ?? null)
  const ladyHolder = room.players.find((p) => p.seat === game.ladyOfLakeHolder)
  const isLadyHolder = ladyHolder?.openid === myOpenid

  if (gameOver) {
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

  // 渲染总任务概览：每轮人数 + 成功/失败状态
  const renderMissionOverview = () => (
    <View className='mission-overview'>
      <View className='mission-score-row'>
        <View className='score-chip success'>
          <Text className='score-value'>{successCount}</Text>
          <Text className='score-text'>成功</Text>
        </View>
        <View className='phase-chip'>
          <Text className='phase-round'>第 {game.round} 轮任务</Text>
          <Text className='phase-name'>{phaseLabel}</Text>
        </View>
        <View className='score-chip fail'>
          <Text className='score-value'>{failCount}</Text>
          <Text className='score-text'>失败</Text>
        </View>
      </View>

      <View className='mission-track'>
        {questSizes.map((size, index) => {
          const result = game.questResults[index]
          let statusClass = 'pending'
          if (result === 'success') statusClass = 'success'
          if (result === 'fail') statusClass = 'fail'
          const isCurrent = index === game.round - 1 && game.phase !== 'over'
          const statusText = result === 'success' ? '胜' : result === 'fail' ? '败' : isCurrent ? '今' : `${size}`

          return (
            <View key={index} className={`mission-node ${statusClass} ${isCurrent ? 'current' : ''}`}>
              <Text className='mission-round'>{index + 1}</Text>
              <Text className='mission-state'>{statusText}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )

  // 渲染否决警戒线
  const renderRejectTrack = () => (
    <View className='reject-track'>
      <Text className='reject-label'>两次否决后强制发车</Text>
      <View className='dots'>
        {[1, 2].map(num => (
          <View key={num} className={`dot ${game.rejectCount >= num ? 'danger' : ''}`} />
        ))}
      </View>
    </View>
  )

  // 按座位号稳定展示圆桌玩家
  const sortedPlayers = [...room.players].sort((a, b) => a.seat - b.seat)
  const getSeatStyle = (index: number, total: number) => {
    const angle = -90 + (360 / Math.max(total, 1)) * index
    const rad = (angle * Math.PI) / 180
    const radiusX = total <= 6 ? 38 : total <= 8 ? 40 : 42
    const radiusY = total <= 6 ? 36 : total <= 8 ? 39 : 41
    return {
      left: `${50 + Math.cos(rad) * radiusX}%`,
      top: `${50 + Math.sin(rad) * radiusY}%`,
    }
  }

  const renderPlayerSeat = (p: PublicPlayer, index: number, total: number) => {
    const isLeader = p.seat === game.leaderSeat
    const isSelected = game.phase === 'team_building'
      ? localSelected.includes(p.seat)
      : game.proposedTeam.includes(p.seat)
    const selectionIndex = proposalSeats.indexOf(p.seat)

    return (
      <View
        key={p.openid}
        className={`player-seat ${isSelected ? 'selected' : ''} ${isLeader ? 'leader' : ''} ${p.openid === myOpenid ? 'me' : ''} ${p.connected ? '' : 'offline'}`}
        style={getSeatStyle(index, total)}
        onClick={() => togglePlayerSelect(p.seat)}
      >
        <View className='avatar-wrap'>
          {p.avatarUrl ? (
            <Image src={p.avatarUrl} className='avatar-img' />
          ) : (
            <Text className='avatar-fallback'>{p.nickname.slice(0,1)}</Text>
          )}
          {isLeader && <View className='leader-badge'><Text>👑</Text></View>}
          {isSelected && (
            <View className='selected-badge'>
              <Text>{selectionIndex + 1}/{currentTeamSize}</Text>
            </View>
          )}
        </View>
        <Text className='nickname'>{p.nickname}</Text>
      </View>
    )
  }

  const renderTeamProposalDock = () => {
    const canSubmit = isMyTurn && proposalPlayers.length === currentTeamSize
    const actionText = canSubmit ? '确认提案' : `还差 ${remainingSlots} 人`

    return (
      <View className='team-proposal-dock'>
        <View className='dock-header'>
          <View>
            <Text className='dock-title'>本轮车队</Text>
            <Text className='dock-subtitle'>
              {isMyTurn ? '选择出征成员' : `等待 ${leader?.nickname ?? '队长'} 组建车队`}
            </Text>
          </View>
          <Text className='dock-count'>{proposalPlayers.length}/{currentTeamSize}</Text>
        </View>

        <View className={`proposal-slots count-${currentTeamSize}`}>
          {proposalSlots.map((player, index) => (
            <View key={player?.openid ?? `empty-${index}`} className={`proposal-slot ${player ? 'filled' : 'empty'}`}>
              {player ? (
                <>
                  <View className='slot-avatar'>
                    {player.avatarUrl ? (
                      <Image src={player.avatarUrl} className='slot-img' />
                    ) : (
                      <Text className='slot-fallback'>{player.nickname.slice(0, 1)}</Text>
                    )}
                  </View>
                  <Text className='slot-name'>{player.nickname}</Text>
                </>
              ) : (
                <>
                  <Text className='slot-plus'>+</Text>
                  <Text className='slot-name'>空位</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {isMyTurn ? (
          <Button
            className={`dock-action ${canSubmit ? 'ready' : ''}`}
            disabled={!canSubmit}
            onClick={submitTeam}
          >
            {actionText}
          </Button>
        ) : (
          <Text className='dock-waiting'>队长确认后进入全员投票</Text>
        )}
      </View>
    )
  }



  const renderLadyResultOverlay = () => {
    if (!ladyResult) return null
    const resultKey = `${ladyResult.targetOpenid}-${ladyResult.nextHolderSeat}-${ladyResult.targetTeam}`
    if (dismissedLadyResultKey === resultKey) return null
    const targetName = ladyResult.targetNickname || room.players.find((p) => p.openid === ladyResult.targetOpenid)?.nickname || '未知玩家'
    const isGood = ladyResult.targetTeam === 'good'
    return (
      <View className='lady-result-mask'>
        <View className={'lady-result-card ' + ladyResult.targetTeam}>
          <Text className='lady-result-kicker'>湖中仙女查验结果</Text>
          <Text className='lady-result-target'>{ladyResult.targetSeat + 1}. {targetName}</Text>
          <Text className='lady-result-team'>{isGood ? '好人阵营' : '坏人阵营'}</Text>
          <Text className='lady-result-copy'>结果只向你揭示，湖中仙女令牌已传给该玩家。</Text>
          <Button className='lady-result-confirm' onClick={() => setDismissedLadyResultKey(resultKey)}>我知道了</Button>
        </View>
      </View>
    )
  }

  const renderLadyDock = () => {
    const inspectedSeats = game.ladyHistory ?? []
    const candidates = room.players.filter((p) => p.openid !== myOpenid && !inspectedSeats.includes(p.seat))

    if (!isLadyHolder) {
      return (
        <View className='lady-group waiting'>
          <Text className='lady-title'>湖中仙女查验</Text>
          <Text className='lady-subtitle'>等待 {ladyHolder?.nickname ?? '持有者'} 选择查验目标</Text>
        </View>
      )
    }

    return (
      <View className='lady-group'>
        <Text className='lady-title'>湖中仙女在你手中</Text>
        <Text className='lady-subtitle'>选择一名未持有过湖中仙女的玩家，系统只会向你揭示阵营</Text>
        <View className='lady-targets'>
          {candidates.map((p) => (
            <Button key={p.openid} className='lady-target' onClick={() => inspectLady(p.openid)}>
              <Text>{p.seat + 1}. {p.nickname}</Text>
            </Button>
          ))}
        </View>
        {ladyResult && (
          <Text className={'lady-result ' + ladyResult.targetTeam}>
            上次查验：{ladyResult.targetTeam === 'good' ? '好人阵营' : '坏人阵营'}
          </Text>
        )}
      </View>
    )
  }

  const getVisiblePlayers = () => {
    if (!roleInfo) return []
    if (roleInfo.knownEvil?.length) {
      return roleInfo.knownEvil.map((openid) => ({ openid, label: '梅林视野', tone: 'evil' as const }))
    }
    if (roleInfo.merlinCandidates?.length) {
      return roleInfo.merlinCandidates.map((openid) => ({ openid, label: '梅林候选', tone: 'mystery' as const }))
    }
    if (roleInfo.fellowEvil?.length) {
      return roleInfo.fellowEvil.map((openid) => ({ openid, label: '邪恶同伙', tone: 'evil' as const }))
    }
    return []
  }

  const renderVisionPlayer = (item: { openid: string; label: string; tone: 'evil' | 'mystery' }) => {
    const player = room.players.find((p) => p.openid === item.openid)
    if (!player) return null
    return (
      <View key={item.openid} className={'role-vision-player ' + item.tone}>
        <View className='role-vision-avatar'>
          {player.avatarUrl ? (
            <Image src={player.avatarUrl} className='role-vision-img' />
          ) : (
            <Text className='role-vision-fallback'>{player.nickname.slice(0, 1)}</Text>
          )}
          <Text className='role-vision-seat'>{player.seat + 1}</Text>
        </View>
        <Text className='role-vision-name'>{player.nickname}</Text>
        <Text className='role-vision-label'>{item.label}</Text>
      </View>
    )
  }

  const renderRoleCardOverlay = () => {
    if (!showRole) return null
    const roleMeta = roleInfo ? ROLE_META[roleInfo.role] : null
    const visiblePlayers = getVisiblePlayers()

    return (
      <View className='role-card-mask' onClick={() => setShowRole(false)}>
        <View className={'role-card-panel ' + (roleInfo?.team ?? 'unknown')} onClick={(e) => e.stopPropagation()}>
          <Button className='role-card-close' onClick={() => setShowRole(false)}>×</Button>
          <Text className='role-card-kicker'>你的身份牌</Text>
          <Text className='role-card-icon'>{roleInfo?.team === 'evil' ? '🗡️' : '🛡️'}</Text>
          <Text className='role-card-name'>{roleMeta?.name ?? '未知身份'}</Text>
          <Text className='role-card-team'>{roleInfo?.team === 'evil' ? '坏人阵营' : '好人阵营'}</Text>
          <Text className='role-card-desc'>{roleMeta?.desc ?? '身份信息尚未下发'}</Text>

          <View className='role-vision-panel'>
            <Text className='role-vision-title'>你能看到的身份信息</Text>
            {visiblePlayers.length > 0 ? (
              <View className='role-vision-list'>
                {visiblePlayers.map((item) => renderVisionPlayer(item))}
              </View>
            ) : (
              <Text className='role-vision-empty'>当前身份没有额外可见信息</Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  const renderQuestDock = () => {
    const questTeam = game.proposedTeam
      .map((seat) => room.players.find((p) => p.seat === seat))
      .filter((p): p is PublicPlayer => Boolean(p))
    const lastResult = questResult?.round === game.round ? questResult : null

    if (!isTeamMember) {
      return (
        <View className='quest-dock waiting'>
          <View className='quest-dock-header'>
            <Text className='quest-eyebrow'>任务执行中</Text>
            <Text className='quest-title'>等待车队提交任务牌</Text>
            <Text className='quest-subtitle'>本轮 {questTeam.length} 名队员正在决定任务结果</Text>
          </View>
          <View className='quest-team-strip'>
            {questTeam.map((p) => (
              <View key={p.openid} className='quest-member-pill'>
                <Text className='quest-member-seat'>{p.seat + 1}</Text>
                <Text className='quest-member-name'>{p.nickname}</Text>
              </View>
            ))}
          </View>
          <View className='quest-rule-note'>
            <Text>需要 {requiredFails} 张失败牌才会失败</Text>
          </View>
        </View>
      )
    }

    return (
      <View className='quest-dock active'>
        <View className='quest-dock-header'>
          <Text className='quest-eyebrow'>第 {game.round} 轮任务</Text>
          <Text className='quest-title'>你在本轮车队中</Text>
          <Text className='quest-subtitle'>选择要提交的任务牌</Text>
        </View>

        <View className='quest-team-strip'>
          {questTeam.map((p) => (
            <View key={p.openid} className={'quest-member-pill ' + (p.openid === myOpenid ? 'me' : '')}>
              <Text className='quest-member-seat'>{p.seat + 1}</Text>
              <Text className='quest-member-name'>{p.nickname}</Text>
            </View>
          ))}
        </View>

        <View className='quest-rule-note'>
          <Text>{room.config.playerCount >= 7 && game.round === 4 ? '特殊轮次：' : ''}需要 {requiredFails} 张失败牌才会失败</Text>
        </View>

        <View className='quest-action-grid'>
          <Button className='quest-action success' onClick={() => submitQuest(false)}>
            <Text className='quest-action-label'>任务成功</Text>
            <Text className='quest-action-hint'>护送远征完成</Text>
          </Button>
          {roleInfo?.team === 'evil' ? (
            <Button className='quest-action fail' onClick={() => submitQuest(true)}>
              <Text className='quest-action-label'>任务失败</Text>
              <Text className='quest-action-hint'>暗中破坏任务</Text>
            </Button>
          ) : (
            <View className='quest-action locked'>
              <Text className='quest-action-label'>任务失败</Text>
              <Text className='quest-action-hint'>好人不能提交失败牌</Text>
            </View>
          )}
        </View>

        {lastResult && (
          <Text className={'quest-result-hint ' + lastResult.result}>
            本轮已结算：{lastResult.result === 'success' ? '成功' : '失败'}
          </Text>
        )}
      </View>
    )
  }

  return (
    <View className='game-board'>

      {/* 1. 右上角：身份牌查看 */}
      <Button className='role-eye-btn' onClick={() => setShowRole(true)}>
        <Text className='eye-icon'>👓</Text>
      </Button>
      {renderRoleCardOverlay()}
      {renderLadyResultOverlay()}

      {/* 2. 顶部：任务进度面板 */}
      <View className='top-dashboard'>
        <View className='board-title-row'>
          <View>
            <Text className='board-title'>阿瓦隆远征</Text>
            <Text className='board-subtitle'>队长 {leader?.nickname ?? '-'} · 需要 {currentTeamSize} 人</Text>
          </View>
        </View>
        {renderMissionOverview()}
        {renderRejectTrack()}
      </View>

      {/* 3. 中部：圆桌玩家列表 */}
      <View className={`players-layout count-${sortedPlayers.length}`}>
        <View className='table-aura'>
          <Text className='table-kicker'>{phaseLabel}</Text>
          <Text className='table-round'>第 {game.round} 轮</Text>
          <Text className='table-need'>车队 {proposalPlayers.length}/{currentTeamSize}</Text>
          <View className='table-team-slots'>
            {proposalSlots.map((player, index) => (
              <View key={player?.openid ?? `table-empty-${index}`} className={`table-team-slot ${player ? 'filled' : ''}`}>
                <Text>{player ? player.seat + 1 : '+'}</Text>
              </View>
            ))}
          </View>
        </View>
        {sortedPlayers.map((p, index) => renderPlayerSeat(p, index, sortedPlayers.length))}
      </View>

      {/* 4. 底部：动态操作台 */}
      <View className='action-console'>
        <View className='phase-actions'>
          {
            // 阶段 A：组建车队 - 队长视角
            game.phase === 'team_building' && isMyTurn ? (
              renderTeamProposalDock()

            // 阶段 A：组建车队 - 队员视角
            ) : game.phase === 'team_building' && !isMyTurn ? (
              renderTeamProposalDock()

            // 阶段 B：发车投票
            ) : game.phase === 'voting' ? (
              <View className='vote-group'>
                <Text className='vote-title'>是否赞成这支队伍出征？</Text>
                <View className='vote-buttons'>
                  <Button className='vote-btn approve' onClick={() => vote(true)}>赞成发车</Button>
                  <Button className='vote-btn reject' onClick={() => vote(false)}>反对发车</Button>
                </View>
              </View>

            // 阶段 C：执行任务
            ) : game.phase === 'quest' ? (
              renderQuestDock()

            // 阶段 D：湖中仙女查验
            ) : game.phase === 'lady' ? (
              renderLadyDock()

            // 阶段 E：刺客猜梅林
            ) : game.phase === 'assassin' ? (
              roleInfo?.role === 'assassin' ? (
                <View className='assassin-group'>
                  <Text className='assassin-title'>选择你要刺杀的梅林</Text>
                  <View className='assassin-targets'>
                    {room.players
                      .filter((p) => p.openid !== myOpenid && !roleInfo.fellowEvil?.includes(p.openid))
                      .map((p) => (
                        <Button
                          key={p.openid}
                          className='assassin-target'
                          onClick={() => assassinate(p.openid)}
                        >
                          {p.nickname}
                        </Button>
                      ))}
                  </View>
                </View>
              ) : (
                <Text className='waiting-text'>三次任务成功，等待刺客进行最后刺杀...</Text>
              )

            // 阶段 E：兜底/结算阶段
            ) : (
              <Text className='waiting-text'>系统演算中...</Text>
            )
          }
        </View>
      </View>

    </View>
  )
}
