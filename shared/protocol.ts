/**
 * 消息协议：前后端通过 WebSocket 收发的所有消息都走这里。
 *
 * 用字符串字面量联合类型而不是 enum——纯类型、零运行时代码，
 * 不会给前后端打包引入额外负担（避免 enum 生成的运行时对象）。
 */

import type { PublicRoom, RoleInfo, GameConfig, GamePhase, Team } from './types'

// ===== 客户端 → 服务端（玩家操作）=====
export const ClientEvent = {
  CREATE_ROOM: 'create_room', // 建房（房主），带初始配置
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  UPDATE_CONFIG: 'update_config', // 房主改人数/扩展开关
  TOGGLE_READY: 'toggle_ready',
  START_GAME: 'start_game',
  PROPOSE_TEAM: 'propose_team',
  VOTE: 'vote',
  QUEST_ACTION: 'quest_action',
  LADY_INSPECT: 'lady_inspect',
  ASSASSINATE: 'assassinate',
  PING: 'ping', // 基础链路（Day 1）
} as const
export type ClientEvent = (typeof ClientEvent)[keyof typeof ClientEvent]

// ===== 服务端 → 客户端（状态推送）=====
export const ServerEvent = {
  ROOM_UPDATE: 'room_update', // 公开房间视图，广播
  GAME_STARTED: 'game_started',
  ROLE_INFO: 'role_info', // 私密，单独发给每个人
  PHASE_CHANGE: 'phase_change',
  VOTE_RESULT: 'vote_result',
  QUEST_RESULT: 'quest_result',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  WELCOME: 'welcome', // 握手成功（Day 1）
  PONG: 'pong', // 基础链路（Day 1）
} as const
export type ServerEvent = (typeof ServerEvent)[keyof typeof ServerEvent]

export type EventType = ClientEvent | ServerEvent

// ===== 统一信封：所有消息都长这样 =====
export interface Message<T = unknown> {
  type: EventType
  payload: T
}

// ===== 各事件的 payload 类型（按需扩充）=====

export interface CreateRoomPayload {
  config?: Partial<GameConfig> // 不传则用默认配置
}

export interface JoinRoomPayload {
  roomId: string
}

export interface UpdateConfigPayload {
  config: Partial<GameConfig>
}

export interface WelcomePayload {
  openid: string
}

export interface RoomUpdatePayload {
  room: PublicRoom
}

export interface RoleInfoPayload {
  info: RoleInfo
}

export interface ErrorPayload {
  message: string
}

// ===== 对局（Day 4：组队 + 投票）=====

export interface ProposeTeamPayload {
  seats: number[] // 队长提名的队员座位号
}

export interface VotePayload {
  approve: boolean // true 赞成 / false 反对
}

export interface QuestActionPayload {
  fail: boolean // true 出失败牌；好人服务端会强制按成功牌结算
}

/** 进入对局：前端收到后切到对局界面 */
export interface GameStartedPayload {
  round: number
  leaderSeat: number
}

/** 阶段变化（组队 / 投票 / 任务 …） */
export interface PhaseChangePayload {
  phase: GamePhase
  round: number
  leaderSeat: number
  proposedTeam: number[]
  rejectCount: number
}

/** 投票结算：所有人投完后揭晓每个人的票 */
export interface VoteResultPayload {
  approved: boolean
  votes: { openid: string; approve: boolean }[]
  round: number
  leaderSeat: number // 通过则不变；否决则已轮转到下一任队长
  rejectCount: number
}

export interface QuestResultPayload {
  round: number
  result: 'success' | 'fail'
  failCount: number
  requiredFails: number
  successCount: number
  failResultCount: number
}

/** 终局 */
export interface GameOverPayload {
  winner: Team
  reason: string
}

/** 构造一条消息的小助手，保证结构统一 */
export function makeMessage<T>(type: EventType, payload: T): Message<T> {
  return { type, payload }
}
