import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoleList,
  canUseLadyOfLake,
  canUseLancelot,
  failsRequired,
  groupRolesByTeam,
  MISSION_TEAM_SIZE,
  ROLE_META,
  TEAM_SIZE,
  teamSize,
} from '@avalon/shared';

type RuleCase = {
  playerCount: number;
  good: number;
  evil: number;
  missionTeamSizes: [number, number, number, number, number];
  lancelot: boolean;
  ladyOfLake: boolean;
  fourthQuestFailsRequired: 1 | 2;
};

const RULE_CASES: RuleCase[] = [
  { playerCount: 5, good: 3, evil: 2, missionTeamSizes: [2, 3, 2, 3, 3], lancelot: false, ladyOfLake: false, fourthQuestFailsRequired: 1 },
  { playerCount: 6, good: 4, evil: 2, missionTeamSizes: [2, 3, 4, 3, 4], lancelot: false, ladyOfLake: false, fourthQuestFailsRequired: 1 },
  { playerCount: 7, good: 4, evil: 3, missionTeamSizes: [2, 3, 3, 4, 4], lancelot: true, ladyOfLake: true, fourthQuestFailsRequired: 2 },
  { playerCount: 8, good: 5, evil: 3, missionTeamSizes: [3, 4, 4, 5, 5], lancelot: true, ladyOfLake: true, fourthQuestFailsRequired: 2 },
  { playerCount: 9, good: 6, evil: 3, missionTeamSizes: [3, 4, 4, 5, 5], lancelot: true, ladyOfLake: true, fourthQuestFailsRequired: 2 },
  { playerCount: 10, good: 6, evil: 4, missionTeamSizes: [3, 4, 4, 5, 5], lancelot: true, ladyOfLake: true, fourthQuestFailsRequired: 2 },
];

test('规则表：5-10 人的阵营人数、任务人数和扩展开关一致', () => {
  for (const row of RULE_CASES) {
    const { playerCount } = row;

    assert.deepEqual(TEAM_SIZE[playerCount], { good: row.good, evil: row.evil }, `${playerCount} 人阵营人数`);
    assert.deepEqual(MISSION_TEAM_SIZE[playerCount], row.missionTeamSizes, `${playerCount} 人任务人数表`);
    assert.equal(canUseLancelot(playerCount), row.lancelot, `${playerCount} 人兰斯洛特开关`);
    assert.equal(canUseLadyOfLake(playerCount), row.ladyOfLake, `${playerCount} 人湖中仙女开关`);

    const roles = buildRoleList(playerCount, {
      useLancelot: row.lancelot,
      useLadyOfLake: row.ladyOfLake,
    });
    const grouped = groupRolesByTeam(roles);
    assert.equal(roles.length, playerCount, `${playerCount} 人角色总数`);
    assert.equal(grouped.good.length, row.good, `${playerCount} 人好阵营角色数`);
    assert.equal(grouped.evil.length, row.evil, `${playerCount} 人坏阵营角色数`);

    row.missionTeamSizes.forEach((size, index) => {
      assert.equal(teamSize(playerCount, index + 1), size, `${playerCount} 人第 ${index + 1} 轮任务人数`);
    });
    assert.equal(failsRequired(playerCount, 4), row.fourthQuestFailsRequired, `${playerCount} 人第 4 轮失败牌阈值`);
  }
});

test('规则表：基础核心角色和扩展角色只在对应人数出现', () => {
  for (const row of RULE_CASES) {
    const roles = buildRoleList(row.playerCount, { useLancelot: true, useLadyOfLake: true });

    for (const coreRole of ['merlin', 'percival', 'morgana', 'assassin'] as const) {
      assert.ok(roles.includes(coreRole), `${row.playerCount} 人应包含 ${coreRole}`);
    }

    assert.equal(roles.includes('good_lancelot'), row.lancelot, `${row.playerCount} 人好兰斯洛特`);
    assert.equal(roles.includes('evil_lancelot'), row.lancelot, `${row.playerCount} 人坏兰斯洛特`);
  }
});

test('规则表：湖中仙女不改变任何人数的角色构成', () => {
  for (const row of RULE_CASES) {
    assert.deepEqual(
      buildRoleList(row.playerCount, { useLadyOfLake: true }),
      buildRoleList(row.playerCount),
      `${row.playerCount} 人湖中仙女不应影响角色池`,
    );
  }
});

test('规则表：非法人数和非法轮次不会返回有效配置', () => {
  for (const count of [4, 11]) {
    assert.deepEqual(buildRoleList(count), []);
    assert.equal(canUseLancelot(count), false);
    assert.equal(canUseLadyOfLake(count), false);
    assert.equal(teamSize(count, 1), 0);
  }

  assert.equal(teamSize(5, 0), 0);
  assert.equal(teamSize(5, 6), 0);
});

test('规则表：所有规则表会发出的角色都有元数据', () => {
  const allRoles = new Set(RULE_CASES.flatMap((row) => buildRoleList(row.playerCount, { useLancelot: true })));
  for (const role of allRoles) {
    assert.ok(ROLE_META[role], `缺少 ${role} 的 ROLE_META`);
  }
});
