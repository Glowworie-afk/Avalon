import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamSize, failsRequired, MISSION_TEAM_SIZE, TOTAL_ROUNDS, MAX_REJECTS } from '@avalon/shared';

test('每轮人数表与官方一致', () => {
  assert.deepEqual(MISSION_TEAM_SIZE[5], [2, 3, 2, 3, 3]);
  assert.deepEqual(MISSION_TEAM_SIZE[6], [2, 3, 4, 3, 4]);
  assert.deepEqual(MISSION_TEAM_SIZE[7], [2, 3, 3, 4, 4]);
  assert.deepEqual(MISSION_TEAM_SIZE[8], [3, 4, 4, 5, 5]);
  assert.deepEqual(MISSION_TEAM_SIZE[9], [3, 4, 4, 5, 5]);
  assert.deepEqual(MISSION_TEAM_SIZE[10], [3, 4, 4, 5, 5]);
});

test('teamSize 取数正确，非法输入返回 0', () => {
  assert.equal(teamSize(5, 1), 2);
  assert.equal(teamSize(7, 4), 4);
  assert.equal(teamSize(10, 5), 5);
  assert.equal(teamSize(4, 1), 0);
  assert.equal(teamSize(5, 6), 0);
});

test('failsRequired：7 人及以上第 4 轮需 2 张，其余 1 张', () => {
  assert.equal(failsRequired(5, 4), 1);
  assert.equal(failsRequired(6, 4), 1);
  assert.equal(failsRequired(7, 4), 2);
  assert.equal(failsRequired(10, 4), 2);
  assert.equal(failsRequired(7, 1), 1);
  assert.equal(failsRequired(7, 3), 1);
});

test('常量', () => {
  assert.equal(TOTAL_ROUNDS, 5);
  assert.equal(MAX_REJECTS, 5);
});
