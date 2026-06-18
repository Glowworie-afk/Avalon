import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initGame, dealRoles, proposeTeam, castVote, submitQuestAction } from '../game/engine';
import { teamSize, toPublicRoom, type Room, type Player } from '@avalon/shared';

function makeRoom(count: number): Room {
  const players: Player[] = Array.from({ length: count }, (_, i) => ({
    openid: `p${i}`,
    nickname: `玩家${i}`,
    avatarUrl: '',
    seat: i,
    isHost: i === 0,
    isReady: true,
    connected: true,
  }));
  return {
    roomId: 'TEST',
    hostOpenid: 'p0',
    players,
    status: 'waiting',
    config: { playerCount: count, useLancelot: false, useLadyOfLake: false },
    createdAt: Date.now(),
  };
}

function leaderOpenid(room: Room): string {
  return room.players.find((p) => p.seat === room.game!.leaderSeat)!.openid;
}

test('initGame 建立对局状态，首任队长 seat 0', () => {
  const room = makeRoom(5);
  initGame(room);
  assert.equal(room.status, 'playing');
  assert.equal(room.game!.phase, 'team_building');
  assert.equal(room.game!.round, 1);
  assert.equal(room.game!.leaderSeat, 0);
  assert.equal(room.game!.rejectCount, 0);
});

test('dealRoles 发牌写回 Room，公开视图不包含任何身份字段', () => {
  const room = makeRoom(5);
  const result = dealRoles(room, () => 0.999999);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');

  assert.deepEqual(
    room.players.map((p) => p.role),
    ['merlin', 'percival', 'loyal', 'morgana', 'assassin'],
  );
  assert.deepEqual(
    room.players.map((p) => p.team),
    ['good', 'good', 'good', 'evil', 'evil'],
  );
  assert.deepEqual(result.deal.roleInfoByOpenid.p0, {
    role: 'merlin',
    team: 'good',
    knownEvil: ['p3', 'p4'],
  });
  assert.deepEqual(result.deal.roleInfoByOpenid.p1, {
    role: 'percival',
    team: 'good',
    merlinCandidates: ['p0', 'p3'],
  });
  assert.deepEqual(result.deal.roleInfoByOpenid.p3, {
    role: 'morgana',
    team: 'evil',
    fellowEvil: ['p4'],
  });

  const publicRoom = toPublicRoom(room);
  assert.equal(JSON.stringify(publicRoom).includes('merlin'), false);
  assert.equal(JSON.stringify(publicRoom).includes('assassin'), false);
  for (const player of publicRoom.players) {
    assert.equal('role' in player, false);
    assert.equal('team' in player, false);
  }
});

test('dealRoles 可见性：梅林看不到莫德雷德，派西维尔看到梅林/莫甘娜', () => {
  const room = makeRoom(9);
  const result = dealRoles(room, () => 0.999999);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');

  const merlin = result.deal.roleInfoByOpenid.p0!;
  const percival = result.deal.roleInfoByOpenid.p1!;
  assert.deepEqual(merlin.knownEvil, ['p6', 'p7']);
  assert.equal(merlin.knownEvil?.includes('p8'), false, '梅林不应看到莫德雷德');
  assert.deepEqual(percival.merlinCandidates, ['p0', 'p6']);
});

test('dealRoles 可见性：奥伯伦不互认，其他坏人也看不到奥伯伦', () => {
  const room = makeRoom(7);
  const result = dealRoles(room, () => 0.999999);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');

  assert.deepEqual(result.deal.roleInfoByOpenid.p4, {
    role: 'morgana',
    team: 'evil',
    fellowEvil: ['p5'],
  });
  assert.deepEqual(result.deal.roleInfoByOpenid.p5, {
    role: 'assassin',
    team: 'evil',
    fellowEvil: ['p4'],
  });
  assert.deepEqual(result.deal.roleInfoByOpenid.p6, {
    role: 'oberon',
    team: 'evil',
  });
});

test('dealRoles 支持兰斯洛特开关并保持好坏人数', () => {
  const room = makeRoom(7);
  room.config.useLancelot = true;
  const result = dealRoles(room, () => 0.999999);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('unreachable');

  assert.deepEqual(
    room.players.map((p) => p.role),
    ['merlin', 'percival', 'loyal', 'good_lancelot', 'morgana', 'assassin', 'evil_lancelot'],
  );
  assert.equal(room.players.filter((p) => p.team === 'good').length, 4);
  assert.equal(room.players.filter((p) => p.team === 'evil').length, 3);
  assert.equal(result.deal.roleInfoByOpenid.p3!.role, 'good_lancelot');
  assert.equal(result.deal.roleInfoByOpenid.p6!.role, 'evil_lancelot');
});

test('只有队长能组队，且人数必须匹配', () => {
  const room = makeRoom(5);
  initGame(room);
  // 非队长
  assert.deepEqual(proposeTeam(room, 'p1', [0, 1]), { ok: false, error: '只有队长可以组队' });
  // 人数不对（第 1 轮 5 人需 2 名）
  const wrong = proposeTeam(room, 'p0', [0, 1, 2]);
  assert.equal(wrong.ok, false);
  // 重复队员
  assert.deepEqual(proposeTeam(room, 'p0', [0, 0]), { ok: false, error: '队员不能重复' });
  // 正确
  assert.deepEqual(proposeTeam(room, 'p0', [0, 1]), { ok: true });
  assert.equal(room.game!.phase, 'voting');
  assert.deepEqual(room.game!.proposedTeam, [0, 1]);
});

test('多数赞成 → 提案通过，进入任务阶段，否决轨清零', () => {
  const room = makeRoom(5);
  initGame(room);
  proposeTeam(room, 'p0', [0, 1]);
  let last;
  for (const p of room.players) last = castVote(room, p.openid, true);
  assert.ok(last && last.ok && last.tally.status === 'resolved' && last.tally.approved);
  assert.equal(room.game!.phase, 'quest');
  assert.equal(room.game!.rejectCount, 0);
});

test('任务执行：队员提交后结算，并进入下一轮组队', () => {
  const room = makeRoom(5);
  room.players[0]!.team = 'evil';
  room.players[1]!.team = 'good';
  initGame(room);
  proposeTeam(room, 'p0', [0, 1]);
  for (const p of room.players) castVote(room, p.openid, true);

  const first = submitQuestAction(room, 'p0', true);
  assert.deepEqual(first, { ok: true, tally: { status: 'pending' } });
  const last = submitQuestAction(room, 'p1', false);
  assert.equal(last.ok, true);
  if (!last.ok || last.tally.status !== 'resolved') throw new Error('unreachable');
  assert.equal(last.tally.result, 'fail');
  assert.equal(last.tally.failCount, 1);
  assert.equal(room.game!.round, 2);
  assert.equal(room.game!.phase, 'team_building');
  assert.deepEqual(room.game!.questResults, ['fail']);
});

test('任务执行：好人伪造失败牌也会被服务端按成功处理', () => {
  const room = makeRoom(5);
  room.players.forEach((p) => { p.team = 'good'; });
  initGame(room);
  proposeTeam(room, 'p0', [0, 1]);
  for (const p of room.players) castVote(room, p.openid, true);
  submitQuestAction(room, 'p0', true);
  const last = submitQuestAction(room, 'p1', true);
  assert.equal(last.ok, true);
  if (!last.ok || last.tally.status !== 'resolved') throw new Error('unreachable');
  assert.equal(last.tally.result, 'success');
  assert.equal(last.tally.failCount, 0);
});

test('任务执行：7 人第 4 轮需要两张失败牌才失败', () => {
  const room = makeRoom(7);
  room.players.forEach((p, i) => { p.team = i < 2 ? 'evil' : 'good'; });
  initGame(room);
  room.game!.round = 4;
  proposeTeam(room, 'p0', [0, 1, 2, 3]);
  for (const p of room.players) castVote(room, p.openid, true);

  submitQuestAction(room, 'p0', true);
  submitQuestAction(room, 'p1', false);
  submitQuestAction(room, 'p2', false);
  const last = submitQuestAction(room, 'p3', false);
  assert.equal(last.ok, true);
  if (!last.ok || last.tally.status !== 'resolved') throw new Error('unreachable');
  assert.equal(last.tally.result, 'success');
  assert.equal(last.tally.requiredFails, 2);
  assert.equal(last.tally.failCount, 1);
});

test('完整五轮任务轨道：成功/失败交错直到第五轮好人获胜', () => {
  const room = makeRoom(5);
  room.players.forEach((p, i) => { p.team = i === 0 ? 'evil' : 'good'; });
  initGame(room);
  const failRounds = new Set([2, 4]);

  for (let round = 1; round <= 5; round++) {
    const need = teamSize(room.config.playerCount, round);
    const seats = Array.from({ length: need }, (_, i) => i);
    assert.equal(proposeTeam(room, leaderOpenid(room), seats).ok, true);
    for (const p of room.players) castVote(room, p.openid, true);
    let last: ReturnType<typeof submitQuestAction> | undefined;
    for (const seat of seats) {
      const p = room.players.find((player) => player.seat === seat)!;
      last = submitQuestAction(room, p.openid, failRounds.has(round) && p.team === 'evil');
    }
    assert.ok(last?.ok);
  }

  assert.deepEqual(room.game!.questResults, ['success', 'fail', 'success', 'fail', 'success']);
  assert.equal(room.game!.phase, 'over');
  assert.equal(room.status, 'finished');
});

test('平票算否决：6 人 3:3 → 否决，队长轮转，回到组队', () => {
  const room = makeRoom(6);
  initGame(room);
  proposeTeam(room, 'p0', [0, 1]); // 6 人第 1 轮需 2 名
  // 前 3 人赞成，后 3 人反对 → 3:3
  const choices = [true, true, true, false, false, false];
  let last: ReturnType<typeof castVote> | undefined;
  for (const [i, p] of room.players.entries()) {
    last = castVote(room, p.openid, choices[i]!);
  }
  assert.ok(last && last.ok && last.tally.status === 'resolved' && !last.tally.approved);
  assert.equal(room.game!.rejectCount, 1);
  assert.equal(room.game!.leaderSeat, 1); // 轮转
  assert.equal(room.game!.phase, 'team_building');
});

test('不能重复投票', () => {
  const room = makeRoom(5);
  initGame(room);
  proposeTeam(room, 'p0', [0, 1]);
  castVote(room, 'p1', true);
  assert.deepEqual(castVote(room, 'p1', false), { ok: false, error: '你已经投过票了' });
});

test('连续 5 次否决 → 坏人获胜，游戏结束', () => {
  const room = makeRoom(5);
  initGame(room);
  let last: ReturnType<typeof castVote> | undefined;
  for (let i = 0; i < 5; i++) {
    const proposal = proposeTeam(room, leaderOpenid(room), [0, 1]);
    assert.equal(proposal.ok, true);
    for (const p of room.players) last = castVote(room, p.openid, false); // 全员反对
  }
  assert.ok(last);
  assert.ok(last.ok);
  if (!last.ok) throw new Error('unreachable');
  assert.equal(last.tally.status, 'resolved');
  if (last.tally.status !== 'resolved') throw new Error('unreachable');
  assert.equal(last.tally.approved, false);
  assert.ok(last.tally.gameOver);
  assert.equal(last.tally.gameOver.winner, 'evil');
  assert.equal(room.game!.phase, 'over');
  assert.equal(room.game!.rejectCount, 5);
});
