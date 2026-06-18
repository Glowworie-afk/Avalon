/**
 * 对局引擎（Day 4：队长轮转 + 组队提案 + 投票结算 + 否决轨 + 刺客环节）。
 *
 * 纯函数式：直接改传入的 Room.game，返回结算结果，不碰网络——方便单测。
 * WebSocket 层只负责把这里生成的公开/私密结果按协议发出去。
 */

import {
    buildRoleList,
    ROLE_META,
    teamSize,
    failsRequired,
    MAX_REJECTS,
    TOTAL_ROUNDS,
    type Role,
    type RoleInfo,
    type Room,
  } from '@avalon/shared'
  
  /** 开局：建对局状态，首任队长定为座位 0。 */
  export function initGame(room: Room): void {
    room.status = 'playing'
    room.game = {
      phase: 'team_building',
      round: 1,
      leaderSeat: 0,
      questResults: [],
      proposedTeam: [],
      rejectCount: 0,
      votes: {},
      questActions: {},
      ladyHistory: [],
    }
  }
  
  export interface DealResult {
    roleInfoByOpenid: Record<string, RoleInfo>
  }
  
  /** 开局发牌：洗角色池、写回每个 Player 的私密 role/team，并生成逐人私密视图。 */
  export function dealRoles(room: Room, random: () => number = Math.random): EngineError | { ok: true; deal: DealResult } {
    const roles = buildRoleList(room.config.playerCount, room.config)
    if (roles.length !== room.players.length) {
      return { ok: false, error: `发牌失败：需要 ${room.config.playerCount} 人，当前 ${room.players.length} 人` }
    }
  
    const shuffled = shuffle(roles, random)
    room.players.forEach((player, i) => {
      const role = shuffled[i]!
      player.role = role
      player.team = ROLE_META[role].team
    })
  
    return {
      ok: true,
      deal: {
        roleInfoByOpenid: Object.fromEntries(room.players.map((p) => [p.openid, buildRoleInfo(room, p.openid)])),
      },
    }
  }
  
  function shuffle<T>(items: T[], random: () => number): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
  }
  
  export function buildRoleInfo(room: Room, openid: string): RoleInfo {
    const me = room.players.find((p) => p.openid === openid)
    if (!me?.role || !me.team) {
      throw new Error(`missing dealt role for ${openid}`)
    }
  
    const info: RoleInfo = { role: me.role, team: me.team }
  
    if (me.role === 'merlin') {
      info.knownEvil = room.players
        .filter((p) => p.team === 'evil' && p.role !== 'mordred')
        .map((p) => p.openid)
    }
  
    if (me.role === 'percival') {
      info.merlinCandidates = room.players
        .filter((p) => p.role === 'merlin' || p.role === 'morgana')
        .map((p) => p.openid)
    }
  
    if (me.team === 'evil' && me.role !== 'oberon') {
      info.fellowEvil = room.players
        .filter((p) => p.openid !== openid && p.team === 'evil' && p.role !== 'oberon')
        .map((p) => p.openid)
    }
  
    return info
  }
  
  export type EngineError = { ok: false; error: string }
  
  /** 队长提交组队提案 */
  export function proposeTeam(
    room: Room,
    openid: string,
    seats: number[],
  ): EngineError | { ok: true } {
    const g = room.game
    if (!g) return { ok: false, error: '游戏未开始' }
    if (g.phase !== 'team_building') return { ok: false, error: '当前不是组队阶段' }
  
    const leader = room.players.find((p) => p.seat === g.leaderSeat)
    if (!leader || leader.openid !== openid) return { ok: false, error: '只有队长可以组队' }
  
    const need = teamSize(room.config.playerCount, g.round)
    const unique = [...new Set(seats)]
    if (unique.length !== seats.length) return { ok: false, error: '队员不能重复' }
    if (seats.length !== need) return { ok: false, error: `本轮需要 ${need} 名队员` }
    const validSeats = new Set(room.players.map((p) => p.seat))
    if (!seats.every((s) => validSeats.has(s))) return { ok: false, error: '存在无效座位' }
  
    g.proposedTeam = seats
    g.votes = {}
    g.phase = 'voting'
    return { ok: true }
  }
  
  export interface VoteResolved {
    status: 'resolved'
    approved: boolean
    votes: { openid: string; approve: boolean }[]
    gameOver?: { winner: 'evil'; reason: string }
  }
  export type VoteTally = { status: 'pending' } | VoteResolved
  
  /** 一名玩家投票；所有人投完后自动结算 */
  export function castVote(
    room: Room,
    openid: string,
    approve: boolean,
  ): EngineError | { ok: true; tally: VoteTally } {
    const g = room.game
    if (!g) return { ok: false, error: '游戏未开始' }
    if (g.phase !== 'voting') return { ok: false, error: '当前不是投票阶段' }
    if (!room.players.some((p) => p.openid === openid)) return { ok: false, error: '你不在本局' }
    if (g.votes[openid] !== undefined) return { ok: false, error: '你已经投过票了' }
  
    g.votes[openid] = approve ? 'approve' : 'reject'
  
    // 还没投完
    if (Object.keys(g.votes).length < room.players.length) {
      return { ok: true, tally: { status: 'pending' } }
    }
  
    // 全部投完 → 结算
    const votes = room.players.map((p) => ({
      openid: p.openid,
      approve: g.votes[p.openid] === 'approve',
    }))
    const approveCount = votes.filter((v) => v.approve).length
    const approved = approveCount > room.players.length / 2 // 严格过半，平票算否决
  
    if (approved) {
      g.rejectCount = 0
      g.phase = 'quest' // 进入任务执行
      g.questActions = {}
      return { ok: true, tally: { status: 'resolved', approved: true, votes } }
    }
  
    // 否决：累加否决轨
    g.rejectCount += 1
    if (g.rejectCount >= MAX_REJECTS) {
      g.phase = 'over'
      return {
        ok: true,
        tally: {
          status: 'resolved',
          approved: false,
          votes,
          gameOver: { winner: 'evil', reason: `连续 ${MAX_REJECTS} 次组队被否决，坏人获胜` },
        },
      }
    }
  
    // 队长顺位轮转，回到组队
    g.leaderSeat = (g.leaderSeat + 1) % room.config.playerCount
    g.proposedTeam = []
    g.votes = {}
    g.questActions = {}
    g.phase = 'team_building'
    return { ok: true, tally: { status: 'resolved', approved: false, votes } }
  }
  
  export interface QuestResolved {
    status: 'resolved'
    round: number
    result: 'success' | 'fail'
    failCount: number
    requiredFails: number
    successCount: number
    failResultCount: number
    gameOver?: { winner: 'good' | 'evil'; reason: string }
  }
  export type QuestTally = { status: 'pending' } | QuestResolved
  
  /** 一名队员执行任务；队伍所有人提交后自动结算任务轨。 */
  export function submitQuestAction(
    room: Room,
    openid: string,
    fail: boolean,
  ): EngineError | { ok: true; tally: QuestTally } {
    const g = room.game
    if (!g) return { ok: false, error: '游戏未开始' }
    if (g.phase !== 'quest') return { ok: false, error: '当前不是任务阶段' }
  
    const player = room.players.find((p) => p.openid === openid)
    if (!player) return { ok: false, error: '你不在本局' }
    if (!g.proposedTeam.includes(player.seat)) return { ok: false, error: '你不在本轮任务队伍中' }
    if (g.questActions[openid] !== undefined) return { ok: false, error: '你已经提交过任务牌了' }
  
    // 好人不能出失败牌；即使客户端伪造 fail=true，服务端也按成功牌记。
    g.questActions[openid] = fail && player.team === 'evil' ? 'fail' : 'success'
  
    if (Object.keys(g.questActions).length < g.proposedTeam.length) {
      return { ok: true, tally: { status: 'pending' } }
    }
  
    const round = g.round
    const failCount = Object.values(g.questActions).filter((a) => a === 'fail').length
    const requiredFails = failsRequired(room.config.playerCount, round)
    const result: 'success' | 'fail' = failCount >= requiredFails ? 'fail' : 'success'
    g.questResults.push(result)
  
    const successCount = g.questResults.filter((r) => r === 'success').length
    const failResultCount = g.questResults.filter((r) => r === 'fail').length
    const base = { status: 'resolved' as const, round, result, failCount, requiredFails, successCount, failResultCount }
  
    // 【核心改动 1】：好人3次成功后，不再直接胜利，而是强行切入刺杀阶段！
    if (successCount >= 3) {
      g.phase = 'assassin' // 悬念开始
      return {
        ok: true,
        tally: { ...base }, // 没有 gameOver，前端收到状态改变进入刺杀UI
      }
    }
    if (failResultCount >= 3) {
      g.phase = 'over'
      room.status = 'finished'
      return {
        ok: true,
        tally: { ...base, gameOver: { winner: 'evil', reason: '三次任务失败，坏人阵营获胜' } },
      }
    }
    if (g.questResults.length >= TOTAL_ROUNDS) {
      // 理论上走不到这里，防守型编程
      const winner = successCount > failResultCount ? 'good' : 'evil'
      g.phase = 'over'
      room.status = 'finished'
      return {
        ok: true,
        tally: {
          ...base,
          gameOver: { winner, reason: `五轮任务结束，成功 ${successCount} 次，失败 ${failResultCount} 次` },
        },
      }
    }
  
    g.round += 1
    g.leaderSeat = (g.leaderSeat + 1) % room.config.playerCount
    g.proposedTeam = []
    g.votes = {}
    g.questActions = {}
    g.phase = 'team_building'
    return { ok: true, tally: base }
  }
  
  /** * 【核心改动 2】：刺客执行刺杀，终局结算
   */
  export function executeAssassination(
    room: Room,
    openid: string,
    targetOpenid: string
  ): EngineError | { ok: true, gameOver: { winner: 'good' | 'evil', reason: string } } {
    const g = room.game
    if (!g) return { ok: false, error: '游戏未开始' }
    if (g.phase !== 'assassin') return { ok: false, error: '当前不是刺杀阶段' }
  
    const assassinPlayer = room.players.find(p => p.openid === openid)
    if (!assassinPlayer || assassinPlayer.role !== 'assassin') {
      return { ok: false, error: '只有刺客可以执行刺杀' }
    }
  
    const targetPlayer = room.players.find(p => p.openid === targetOpenid)
    if (!targetPlayer) return { ok: false, error: '刺杀目标不存在' }
    if (targetPlayer.team === 'evil') return { ok: false, error: '刺客不能刺杀自己的邪恶同伙！' }
  
    // 刺杀完毕，无论成败，游戏彻底结束
    g.phase = 'over'
    room.status = 'finished'
  
    if (targetPlayer.role === 'merlin') {
      return {
        ok: true,
        gameOver: { winner: 'evil', reason: '刺杀成功！刺客精准识破了梅林，坏人阵营绝地翻盘！' }
      }
    } else {
      return {
        ok: true,
        gameOver: { winner: 'good', reason: `刺杀失败！刺客错误地刺杀了【${ROLE_META[targetPlayer.role!].name}】，好人阵营最终获胜！` }
      }
    }
  }