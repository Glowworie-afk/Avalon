/**
 * 消息协议：前后端通过 WebSocket 收发的所有消息都走这里。
 *
 * 用字符串字面量联合类型而不是 enum——纯类型、零运行时代码，
 * 不会给前后端打包引入额外负担（避免 enum 生成的运行时对象）。
 */

import type { PublicRoom, RoleInfo } from './types'

// ===== 客户端 → 服务端（玩家操作）=====
export const ClientEvent = {
  JOIN_ROOM: 'join_room',
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

export interface JoinRoomPayload {
  roomId: string
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

/** 构造一条消息的小助手，保证结构统一 */
export function makeMessage<T>(type: EventType, payload: T): Message<T> {
  return { type, payload }
}
