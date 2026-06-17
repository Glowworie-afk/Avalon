import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRoom, saveRoom, deleteRoom, roomExists, _clearAllRooms } from '../store/roomStore';
import type { Room } from '@avalon/shared';

function makeRoom(roomId: string): Room {
  return {
    roomId,
    hostOpenid: 'host1',
    players: [
      { openid: 'host1', nickname: '房主', avatarUrl: '', seat: 0, isHost: true, isReady: true, connected: true },
    ],
    status: 'waiting',
    config: { playerCount: 5, useLancelot: false, useLadyOfLake: false },
    createdAt: Date.now(),
  };
}

beforeEach(async () => {
  await _clearAllRooms();
});

test('save 后能 get 回来', async () => {
  const room = makeRoom('AAAA');
  await saveRoom(room);
  const got = await getRoom('AAAA');
  assert.ok(got);
  assert.equal(got!.hostOpenid, 'host1');
  assert.equal(got!.players.length, 1);
});

test('不存在的房间返回 null', async () => {
  assert.equal(await getRoom('ZZZZ'), null);
});

test('roomExists 反映存在状态', async () => {
  assert.equal(await roomExists('BBBB'), false);
  await saveRoom(makeRoom('BBBB'));
  assert.equal(await roomExists('BBBB'), true);
});

test('delete 后取不到', async () => {
  await saveRoom(makeRoom('CCCC'));
  await deleteRoom('CCCC');
  assert.equal(await getRoom('CCCC'), null);
  assert.equal(await roomExists('CCCC'), false);
});
