/**
 * 角色与人数配置表。
 *
 * 这是「人数 → 角色构成」的单一数据源：
 *   - 建房配置页用它实时展示当前人数对应的角色（Day 2）。
 *   - Day 4 发牌直接复用同一张表，保证「展示的」和「发出的」永远一致。
 *
 * 阿瓦隆官方好/坏人数是固定的（见 TEAM_SIZE）；具体配哪些特殊角色这里给一套
 * 合理的基础局默认。兰斯洛特只有 7 人及以上才有可替换的填充坏人，故 <7 人禁用。
 * 湖中仙女是令牌机制，不改变任何角色构成。
 */

import type { Role, Team, GameConfig } from './types'

export const MIN_PLAYERS = 5
export const MAX_PLAYERS = 10

export interface RoleMeta {
  role: Role
  name: string // 中文名
  team: Team
  desc: string // 技能简述
}

export const ROLE_META: Record<Role, RoleMeta> = {
  merlin: { role: 'merlin', name: '梅林', team: 'good', desc: '能看到所有坏人（莫德雷德除外），但暴露身份会被刺杀' },
  percival: { role: 'percival', name: '派西维尔', team: 'good', desc: '能看到梅林和莫甘娜，但分不清谁是谁' },
  loyal: { role: 'loyal', name: '忠臣', team: 'good', desc: '亚瑟的忠臣，没有特殊能力' },
  good_lancelot: { role: 'good_lancelot', name: '好兰斯洛特', team: 'good', desc: '可能在对局中切换阵营' },
  mordred: { role: 'mordred', name: '莫德雷德', team: 'evil', desc: '梅林看不到他' },
  morgana: { role: 'morgana', name: '莫甘娜', team: 'evil', desc: '会被派西维尔误认成梅林' },
  oberon: { role: 'oberon', name: '奥伯伦', team: 'evil', desc: '与其他坏人互不相认' },
  assassin: { role: 'assassin', name: '刺客', team: 'evil', desc: '终局可指认梅林，猜中则坏人翻盘' },
  minion: { role: 'minion', name: '爪牙', team: 'evil', desc: '莫德雷德的爪牙，没有特殊能力' },
  evil_lancelot: { role: 'evil_lancelot', name: '坏兰斯洛特', team: 'evil', desc: '可能在对局中切换阵营' },
}

/** 5–10 人的好/坏阵营人数（阿瓦隆官方标准，固定不可改） */
export const TEAM_SIZE: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 },
}

/**
 * 各人数下，坏阵营在「莫甘娜 + 刺客」之外的填充角色（基础局默认）。
 * 5/6 人只有莫甘娜+刺客；7 人起多一个，给兰斯洛特留下可替换的位置。
 */
const EVIL_EXTRA: Record<number, Role[]> = {
  5: [],
  6: [],
  7: ['oberon'],
  8: ['minion'],
  9: ['mordred'],
  10: ['mordred', 'oberon'],
}

/** 兰斯洛特需要有可替换的填充坏人，7 人及以上才能开 */
export function canUseLancelot(count: number): boolean {
  return (EVIL_EXTRA[count]?.length ?? 0) > 0
}

/**
 * 生成某人数下的完整角色池（顺序：先好后坏）。
 * - 基础局：好 = 梅林 + 派西维尔 + 若干忠臣；坏 = 莫甘娜 + 刺客 + 填充。
 * - useLancelot（7 人起）：一个忠臣换成好兰斯洛特，一个填充坏人换成坏兰斯洛特，人数不变。
 * - useLadyOfLake：不影响角色构成。
 * 人数非法（不在 5–10）时返回空数组。
 */
export function buildRoleList(count: number, config?: Partial<GameConfig>): Role[] {
  const size = TEAM_SIZE[count]
  if (!size) return []

  const good: Role[] = ['merlin', 'percival']
  while (good.length < size.good) good.push('loyal')

  const evil: Role[] = ['morgana', 'assassin', ...(EVIL_EXTRA[count] ?? [])]

  if (config?.useLancelot && canUseLancelot(count)) {
    const gi = good.lastIndexOf('loyal')
    if (gi >= 0) good[gi] = 'good_lancelot'
    // 优先替换不影响核心规则的填充坏人
    const swapOrder: Role[] = ['minion', 'oberon', 'mordred']
    const target = swapOrder.find((r) => evil.includes(r))
    if (target) evil[evil.indexOf(target)] = 'evil_lancelot'
  }

  return [...good, ...evil]
}

/** 把角色池按阵营分组，方便 UI 展示 */
export function groupRolesByTeam(roles: Role[]): { good: Role[]; evil: Role[] } {
  return {
    good: roles.filter((r) => ROLE_META[r].team === 'good'),
    evil: roles.filter((r) => ROLE_META[r].team === 'evil'),
  }
}
