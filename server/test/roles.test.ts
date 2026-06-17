import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoleList,
  canUseLancelot,
  groupRolesByTeam,
  TEAM_SIZE,
  ROLE_META,
} from '@avalon/shared';

test('5–10 人好坏总数与官方一致', () => {
  const expected: Record<number, [number, number]> = {
    5: [3, 2], 6: [4, 2], 7: [4, 3], 8: [5, 3], 9: [6, 3], 10: [6, 4],
  };
  for (const [countStr, [good, evil]] of Object.entries(expected)) {
    const count = Number(countStr);
    assert.deepEqual(TEAM_SIZE[count], { good, evil });
    const roles = buildRoleList(count);
    assert.equal(roles.length, count, `${count} 人角色总数`);
    const g = groupRolesByTeam(roles);
    assert.equal(g.good.length, good, `${count} 人好阵营数`);
    assert.equal(g.evil.length, evil, `${count} 人坏阵营数`);
  }
});

test('基础局必含梅林/派西维尔/莫甘娜/刺客', () => {
  const roles = buildRoleList(5);
  for (const r of ['merlin', 'percival', 'morgana', 'assassin'] as const) {
    assert.ok(roles.includes(r), `应包含 ${r}`);
  }
});

test('兰斯洛特：7 人可开，会加入好/坏兰斯洛特且人数不变', () => {
  assert.equal(canUseLancelot(5), false);
  assert.equal(canUseLancelot(6), false);
  assert.equal(canUseLancelot(7), true);

  const roles = buildRoleList(7, { useLancelot: true });
  assert.equal(roles.length, 7);
  assert.ok(roles.includes('good_lancelot'));
  assert.ok(roles.includes('evil_lancelot'));
  const g = groupRolesByTeam(roles);
  assert.equal(g.good.length, 4);
  assert.equal(g.evil.length, 3);
});

test('兰斯洛特：5 人开关无效（人数不够，不应出现兰斯洛特）', () => {
  const roles = buildRoleList(5, { useLancelot: true });
  assert.ok(!roles.includes('good_lancelot'));
  assert.ok(!roles.includes('evil_lancelot'));
});

test('湖中仙女不改变角色构成', () => {
  const base = buildRoleList(8);
  const withLake = buildRoleList(8, { useLadyOfLake: true });
  assert.deepEqual(withLake, base);
});

test('非法人数返回空数组', () => {
  assert.deepEqual(buildRoleList(4), []);
  assert.deepEqual(buildRoleList(11), []);
});

test('ROLE_META 覆盖所有出现过的角色且阵营正确', () => {
  const roles = buildRoleList(10, { useLancelot: true });
  for (const r of roles) {
    assert.ok(ROLE_META[r], `缺少 ${r} 的元数据`);
    assert.ok(['good', 'evil'].includes(ROLE_META[r].team));
  }
});
