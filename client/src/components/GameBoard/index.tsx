import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { sendMessage } from '../../utils/socket'
import {
  ClientEvent,
  teamSize,
  failsRequired,
  TOTAL_ROUNDS,
  MAX_REJECTS,
  ROLE_META,
  type PublicRoom,
  type RoleInfo,
  type VoteResultPayload,
  type QuestResultPayload,
  type GameOverPayload,
} from '@avalon/shared'
import './index.scss'

interface Props {
  room: PublicRoom
  myOpenid: string
  roleInfo: RoleInfo | null
  voteResult: VoteResultPayload | null
  questResult: QuestResultPayload | null
  gameOver: GameOverPayload | null
}

/**
 * 对局面板（Day 4：组队 + 投票）。
 * 每轮人数表、否决轨、队长组队点选、赞成/反对、票数结算揭晓、坏人胜结算。
 * 任务执行成败（Day 5）暂为占位。
 */
export default function GameBoard({ room, myOpenid, roleInfo, voteResult, questResult, gameOver }: Props) {
  const g = room.game
  const players = [...room.players].sort((a, b) => a.seat - b.seat)
  const count = room.config.playerCount

  const [selected, setSelected] = useState<number[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [hasQuested, setHasQuested] = useState(false)
  const [roleVisible, setRoleVisible] = useState(false)

  // 每进入一轮新投票（轮次或提名变化），重置本地的"已投票"
  const voteKey = `${g?.round}-${(g?.proposedTeam ?? []).join(',')}`
  useEffect(() => setHasVoted(false), [voteKey])
  useEffect(() => setHasQuested(false), [g?.phase, g?.round, (g?.proposedTeam ?? []).join(',')])
  // 回到组队阶段时清空已选
  useEffect(() => {
    if (g?.phase === 'team_building') setSelected([])
  }, [g?.phase, g?.round, g?.leaderSeat])

  if (!g) return null

  const leader = players.find((p) => p.seat === g.leaderSeat)
  const isLeader = leader?.openid === myOpenid
  const need = teamSize(count, g.round)
  const proposed = new Set(g.proposedTeam)
  const me = players.find((p) => p.openid === myOpenid)
  const onQuestTeam = me ? proposed.has(me.seat) : false

  const toggleSelect = (seat: number) => {
    if (!isLeader || g.phase !== 'team_building') return
    setSelected((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : prev.length < need ? [...prev, seat] : prev,
    )
  }

  const submitTeam = () => {
    if (selected.length !== need) return
    sendMessage(ClientEvent.PROPOSE_TEAM, { seats: selected })
  }
  const vote = (approve: boolean) => {
    sendMessage(ClientEvent.VOTE, { approve })
    setHasVoted(true)
  }
  const quest = (fail: boolean) => {
    sendMessage(ClientEvent.QUEST_ACTION, { fail })
    setHasQuested(true)
  }

  const nickOf = (openid: string) => players.find((p) => p.openid === openid)?.nickname ?? openid
  const nightLines = buildNightLines(roleInfo, nickOf)

  return (
    <View className='game'>
      <View
        className={`role-card ${roleVisible ? 'show' : ''}`}
        onTouchStart={() => setRoleVisible(true)}
        onTouchEnd={() => setRoleVisible(false)}
        onTouchCancel={() => setRoleVisible(false)}
      >
        {roleInfo && roleVisible ? (
          <>
            <Text className='role-name'>{ROLE_META[roleInfo.role].name}</Text>
            <Text className={`role-team ${roleInfo.team}`}>{roleInfo.team === 'good' ? '好人阵营' : '坏人阵营'}</Text>
            <View className='night-info'>
              {nightLines.map((line) => (
                <Text key={line} className='night-line'>{line}</Text>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text className='role-name hidden'>{roleInfo ? '长按查看身份' : '等待身份信息'}</Text>
            <Text className='role-team'>松手自动隐藏</Text>
          </>
        )}
      </View>

      {/* 任务进度 + 每轮人数表 */}
      <View className='track'>
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
          const round = i + 1
          const result = g.questResults[i] // 'success' | 'fail' | undefined（Day 5 才有）
          const current = round === g.round
          const need2 = failsRequired(count, round) === 2
          return (
            <View
              key={round}
              className={`node ${current ? 'current' : ''} ${result ?? ''}`}
            >
              <Text className='node-size'>{teamSize(count, round)}</Text>
              {need2 && <Text className='node-flag'>两失败</Text>}
              <Text className='node-round'>第{round}轮</Text>
            </View>
          )
        })}
      </View>

      {/* 否决轨 */}
      <View className='rejects'>
        <Text className='rejects-label'>否决轨</Text>
        <View className='rejects-dots'>
          {Array.from({ length: MAX_REJECTS }, (_, i) => (
            <View
              key={i}
              className={`dot ${i < g.rejectCount ? 'on' : ''} ${i === MAX_REJECTS - 1 ? 'danger' : ''}`}
            />
          ))}
        </View>
        <Text className='rejects-hint'>连续 {MAX_REJECTS} 次否决坏人胜</Text>
      </View>

      {/* 上一轮投票揭晓 */}
      {voteResult && g.phase !== 'voting' && (
        <View className={`vote-result ${voteResult.approved ? 'pass' : 'fail'}`}>
          <Text className='vr-title'>{voteResult.approved ? '提案通过' : '提案被否决'}</Text>
          <View className='vr-list'>
            {voteResult.votes.map((v) => (
              <Text key={v.openid} className={`vr-chip ${v.approve ? 'y' : 'n'}`}>
                {nickOf(v.openid)} {v.approve ? '赞成' : '反对'}
              </Text>
            ))}
          </View>
        </View>
      )}

      {questResult && (
        <View className={`quest-result ${questResult.result}`}>
          <Text className='qr-title'>第{questResult.round}轮任务{questResult.result === 'success' ? '成功' : '失败'}</Text>
          <Text className='qr-meta'>
            失败牌 {questResult.failCount}/{questResult.requiredFails}，当前成功 {questResult.successCount} / 失败 {questResult.failResultCount}
          </Text>
        </View>
      )}

      {/* 队长 */}
      <View className='leader-bar'>
        <Text>当前队长：{leader?.nickname ?? '—'}</Text>
        {isLeader && <Text className='you'>（你）</Text>}
      </View>

      {/* 主体：按阶段 */}
      {gameOver ? (
        <View className='over'>
          <Text className='over-title'>{gameOver.winner === 'evil' ? '坏人阵营获胜' : '好人阵营获胜'}</Text>
          <Text className='over-reason'>{gameOver.reason}</Text>
        </View>
      ) : g.phase === 'team_building' ? (
        <View className='phase'>
          <Text className='phase-tip'>
            {isLeader ? `请选择 ${need} 名队员（已选 ${selected.length}）` : `等待队长组队（需 ${need} 人）`}
          </Text>
          <View className='seats'>
            {players.map((p) => {
              const sel = selected.includes(p.seat)
              return (
                <View
                  key={p.openid}
                  className={`seat ${sel ? 'sel' : ''} ${p.seat === g.leaderSeat ? 'leader' : ''}`}
                  onClick={() => toggleSelect(p.seat)}
                >
                  <Text className='seat-name'>{p.nickname}</Text>
                  <Text className='seat-no'>{p.seat === g.leaderSeat ? '队长' : `#${p.seat}`}</Text>
                </View>
              )
            })}
          </View>
          {isLeader && (
            <Button className='action' disabled={selected.length !== need} onClick={submitTeam}>
              提交提案
            </Button>
          )}
        </View>
      ) : g.phase === 'voting' ? (
        <View className='phase'>
          <Text className='phase-tip'>对队长的提案投票（{g.votedCount}/{players.length} 已投）</Text>
          <View className='seats'>
            {players.map((p) => (
              <View key={p.openid} className={`seat ${proposed.has(p.seat) ? 'on-team' : ''}`}>
                <Text className='seat-name'>{p.nickname}</Text>
                <Text className='seat-no'>{proposed.has(p.seat) ? '上场' : `#${p.seat}`}</Text>
              </View>
            ))}
          </View>
          {hasVoted ? (
            <Text className='voted-tip'>已投票，等待其他人…</Text>
          ) : (
            <View className='vote-btns'>
              <Button className='approve' onClick={() => vote(true)}>赞成</Button>
              <Button className='reject' onClick={() => vote(false)}>反对</Button>
            </View>
          )}
        </View>
      ) : g.phase === 'quest' ? (
        <View className='phase'>
          <Text className='phase-tip'>任务执行</Text>
          <View className='team-show'>
            {g.proposedTeam.map((s) => (
              <Text key={s} className='team-chip'>{players.find((p) => p.seat === s)?.nickname}</Text>
            ))}
          </View>
          {!onQuestTeam ? (
            <Text className='placeholder'>等待队员提交任务牌…</Text>
          ) : hasQuested ? (
            <Text className='voted-tip'>已提交任务牌，等待队友…</Text>
          ) : (
            <View className='vote-btns'>
              <Button className='approve' onClick={() => quest(false)}>成功</Button>
              {roleInfo?.team === 'evil' && (
                <Button className='reject' onClick={() => quest(true)}>失败</Button>
              )}
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
}

function buildNightLines(roleInfo: RoleInfo | null, nickOf: (openid: string) => string): string[] {
  if (!roleInfo) return []
  if (roleInfo.role === 'merlin') {
    return [`你看到的坏人：${names(roleInfo.knownEvil, nickOf)}`]
  }
  if (roleInfo.role === 'percival') {
    return [`你看到的梅林候选：${names(roleInfo.merlinCandidates, nickOf)}`]
  }
  if (roleInfo.team === 'evil') {
    return roleInfo.fellowEvil
      ? [`你认识的坏人同伴：${names(roleInfo.fellowEvil, nickOf)}`]
      : ['你是奥伯伦，不与其他坏人互认']
  }
  return ['你没有额外夜晚信息']
}

function names(openids: string[] | undefined, nickOf: (openid: string) => string): string {
  return openids?.length ? openids.map(nickOf).join('、') : '无'
}
