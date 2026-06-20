// src/mocks/game.ts
import { PublicRoom, RoleInfo } from '@avalon/shared'

// 固定的测试账号 ID
export const MOCK_MY_OPENID = 'test-my-id'

// 1. 基础房间壳子 (所有阶段共用的部分)
const baseRoom = {
  roomId: 'DEBUG888',
  status: 'playing', // 强制进入游戏态
  config: { playerCount: 5, useLancelot: false, useLadyOfLake: false },
  players: [
    { openid: MOCK_MY_OPENID, nickname: '亚瑟王(我)', avatarUrl: '', isHost: true, isReady: true, connected: true, seat: 0 },
    { openid: 'bot-2', nickname: '梅林bot', avatarUrl: '', isHost: false, isReady: true, connected: true, seat: 1 },
    { openid: 'bot-3', nickname: '派西维尔bot', avatarUrl: '', isHost: false, isReady: true, connected: true, seat: 2 },
    { openid: 'bot-4', nickname: '莫甘娜bot', avatarUrl: '', isHost: false, isReady: true, connected: true, seat: 3 },
    { openid: 'bot-5', nickname: '刺客bot', avatarUrl: '', isHost: false, isReady: true, connected: false, seat: 4 }, // 模拟一个离线玩家
  ]
}

// 2. 身份牌数据
export const mockRoleInfo = {
  role: 'merlin',
  team: 'good',
  name: '梅林',
  desc: '你是好人阵营领袖。你看到了坏人是 4号 和 5号。',
  knownEvil: ['bot-4', 'bot-5']
}

// 3. 游戏各阶段数据字典 (通过切换 Key 来测试不同画面)
export const GamePhaseMocks: Record<string, PublicRoom> = {
  
  // 阶段一：等待查看身份
  reveal: {
    ...baseRoom,
    game: {
      phase: 'role_reveal',
      leaderSeat: 0,
      questResults: [],
      rejectCount: 0,
      proposedTeam: []
    } as any
  } as PublicRoom,

  // 阶段二：组队中 (队长是我)
  teamBuilding: {
    ...baseRoom,
    game: {
      phase: 'team_building',
      leaderSeat: 0, // 我是队长
      questResults: [],
      rejectCount: 0,
      proposedTeam: ['bot-2'], // 我已经点选了一个人
    } as any
  } as PublicRoom,

  // 阶段三：投票中
  voting: {
    ...baseRoom,
    game: {
      phase: 'voting',
      leaderSeat: 1, // 队长是 2号
      questResults: ['success'], // 前面已经成功了一次
      rejectCount: 2, // 已经被连续否决2次
      proposedTeam: ['bot-2', 'bot-3', MOCK_MY_OPENID], // 正在投票的队伍
    } as any
  } as PublicRoom,

  // 阶段四：刺杀阶段 (终局前夕)
  assassin: {
    ...baseRoom,
    game: {
      phase: 'assassin',
      leaderSeat: 3,
      questResults: ['success', 'fail', 'success', 'fail', 'success'], // 3胜2负，好人即将获胜
      rejectCount: 0,
      proposedTeam: [],
    } as any
  } as PublicRoom

}