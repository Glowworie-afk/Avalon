/**
 * 任务（Quest）相关配置：每轮组队人数表、失败牌数、否决轨上限。
 * 和角色表一样作为前后端单一数据源：UI 展示人数表用它，服务端校验组队人数也用它。
 */

export const TOTAL_ROUNDS = 5

/** 连续否决达到这个次数，坏人直接获胜 */
export const MAX_REJECTS = 5

/**
 * 每轮组队人数（阿瓦隆官方表）。
 * 行 = 总人数 5–10，列 = 第 1..5 轮。
 */
export const MISSION_TEAM_SIZE: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
}

/** 第 round 轮（1–5）需要的队员数；非法输入返回 0 */
export function teamSize(playerCount: number, round: number): number {
  const row = MISSION_TEAM_SIZE[playerCount]
  if (!row) return 0
  return row[round - 1] ?? 0
}

/**
 * 第 round 轮任务需要的失败牌数。
 * 7 人及以上的第 4 轮需要 2 张失败牌才算任务失败，其余均为 1 张。
 * （Day 5 任务执行时用，这里先定义好。）
 */
export function failsRequired(playerCount: number, round: number): number {
  return playerCount >= 7 && round === 4 ? 2 : 1
}
