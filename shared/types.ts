/**
 * 领域数据模型。
 *
 * 核心安全原则（Day 1 就要定死）：
 *   服务端持有「完整态」（含所有人身份），但绝不整体下发。
 *   广播只能用「公开视图」（PublicRoom / PublicPlayer，不含 role/team）；
 *   身份只通过「私密视图」（RoleInfo）按人单独算、单独发。
 *
 * 把私密字段（role/team）和公开字段拆成不同类型，是为了让编译器帮你守住这条线——
 * 广播函数只接受 PublicRoom，从类型上就不可能把身份发出去。
 */

// ===== 基础枚举型（用字符串字面量联合，纯类型、零运行时）=====

export type Team = 'good' | 'evil'

export type Role =
  | 'merlin' // 梅林（好）：能看到坏人（莫德雷德除外）
  | 'percival' // 派西维尔（好）：能看到梅林和莫甘娜，但分不清谁是谁
  | 'loyal' // 普通忠臣（好）
  | 'mordred' // 莫德雷德（坏）：梅林看不到他
  | 'morgana' // 莫甘娜（坏）：会被派西维尔误认成梅林
  | 'oberon' // 奥伯伦（坏）：和其他坏人互不相认
  | 'assassin' // 刺客（坏）：终局可刺杀梅林
  | 'minion' // 普通爪牙（坏）
  | 'good_lancelot' // 好兰斯洛特
  | 'evil_lancelot' // 坏兰斯洛特

export type RoomStatus = 'waiting' | 'playing' | 'finished'

export type GamePhase =
  | 'night' // 夜晚信息公示
  | 'team_building' // 队长组队
  | 'voting' // 投票
  | 'quest' // 任务执行
  | 'assassin' // 刺客猜梅林
  | 'over' // 结束

export interface GameConfig {
  playerCount: number // 目标人数 5–10，决定房间容量与发牌时的角色构成
  useLancelot: boolean
  useLadyOfLake: boolean
}

// ===== 服务端完整态：含私密字段，永不整体下发 =====

export interface Player {
  openid: string
  nickname: string
  avatarUrl: string // 头像 URL（注册时填写）
  seat: number // 座位号
  isHost: boolean
  isReady: boolean
  connected: boolean // 是否在线，掉线重连要用
  // —— 私密字段，绝不能进任何广播 ——
  role?: Role
  team?: Team
}

export interface GameState {
  phase: GamePhase
  round: number // 第几轮任务 1–5
  leaderSeat: number // 当前队长座位
  questResults: ('success' | 'fail')[] // 每轮任务结果
  proposedTeam: number[] // 队长提名的座位
  rejectCount: number // 连续否决次数，到 5 坏人胜
  // votes 只存服务端，揭晓前绝不进公开视图（防偷看先投者）
  votes: Record<string, 'approve' | 'reject'>
  // questActions 只存服务端，结算前绝不进公开视图
  questActions: Record<string, 'success' | 'fail'>
  ladyOfLakeHolder?: number // 湖中仙女令牌当前持有者座位
  ladyHistory: number[] // 持有过仙女的座位，用于「不能查已持有者」
}

export interface Room {
  roomId: string // 房间码
  hostOpenid: string
  players: Player[]
  status: RoomStatus
  config: GameConfig
  game?: GameState
  createdAt: number
}

// ===== 公开视图：广播用，绝无 role/team、绝无 votes =====

export interface PublicPlayer {
  openid: string
  nickname: string
  avatarUrl: string
  seat: number
  isHost: boolean
  isReady: boolean
  connected: boolean
}

export interface PublicGameState {
  phase: GamePhase
  round: number
  leaderSeat: number
  questResults: ('success' | 'fail')[]
  proposedTeam: number[]
  rejectCount: number
  votedCount: number // 已投票人数（只报数量、不报谁投了什么，揭晓前保密）
  ladyOfLakeHolder?: number
}

export interface PublicRoom {
  roomId: string
  hostOpenid: string
  players: PublicPlayer[]
  status: RoomStatus
  config: GameConfig
  game?: PublicGameState
  createdAt: number
}

// ===== 私密视图：每个玩家单独算一份，只通过 ROLE_INFO 发给本人 =====

export interface RoleInfo {
  role: Role
  team: Team
  knownEvil?: string[] // 梅林看到的坏人 openid（莫德雷德除外）
  merlinCandidates?: string[] // 派西维尔看到的梅林+莫甘娜（不分谁是谁）
  fellowEvil?: string[] // 坏人互认看到的同伙（奥伯伦除外）
}

// ===== 投影函数：把完整态「降级」成公开视图 =====
// 广播前一律走这里，确保 role/team/votes 被剥掉。

export function toPublicPlayer(p: Player): PublicPlayer {
  return {
    openid: p.openid,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    seat: p.seat,
    isHost: p.isHost,
    isReady: p.isReady,
    connected: p.connected,
  }
}

export function toPublicGameState(g: GameState): PublicGameState {
  return {
    phase: g.phase,
    round: g.round,
    leaderSeat: g.leaderSeat,
    questResults: g.questResults,
    proposedTeam: g.proposedTeam,
    rejectCount: g.rejectCount,
    votedCount: Object.keys(g.votes).length,
    // 仅在有值时才带上可选字段（兼容 exactOptionalPropertyTypes）
    ...(g.ladyOfLakeHolder !== undefined ? { ladyOfLakeHolder: g.ladyOfLakeHolder } : {}),
  }
}

export function toPublicRoom(room: Room): PublicRoom {
  return {
    roomId: room.roomId,
    hostOpenid: room.hostOpenid,
    players: room.players.map(toPublicPlayer),
    status: room.status,
    config: room.config,
    createdAt: room.createdAt,
    ...(room.game ? { game: toPublicGameState(room.game) } : {}),
  }
}
