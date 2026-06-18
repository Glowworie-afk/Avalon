import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { setupWebSocket } from '../ws';
import { signToken } from '../utils/token';
import { saveUser, _clearAllUsers } from '../store/userStore';
import { _clearAllRooms } from '../store/roomStore';
import {
  ClientEvent,
  ServerEvent,
  makeMessage,
  type Message,
  type PublicRoom,
  type VoteResultPayload,
  type QuestResultPayload,
} from '@avalon/shared';

let server: Server;
let port: number;

before(async () => {
  server = createServer();
  setupWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(async () => {
  await _clearAllRooms();
  await _clearAllUsers();
});

class Client {
  private ws: WebSocket;
  private buffer: Message[] = [];
  private seen: Message[] = [];
  private waiters: { pred: (m: Message) => boolean; resolve: (m: Message) => void }[] = [];

  constructor(token: string) {
    this.ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Message;
      this.seen.push(msg);
      const idx = this.waiters.findIndex((w) => w.pred(msg));
      if (idx >= 0) this.waiters.splice(idx, 1)[0]!.resolve(msg);
      else this.buffer.push(msg);
    });
  }
  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);
    });
  }
  send(type: string, payload: unknown): void {
    this.ws.send(JSON.stringify(makeMessage(type as never, payload)));
  }
  waitFor(pred: (m: Message) => boolean, timeout = 2000): Promise<Message> {
    const idx = this.buffer.findIndex(pred);
    if (idx >= 0) return Promise.resolve(this.buffer.splice(idx, 1)[0]!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('等待消息超时')), timeout);
      this.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }
  messages(): Message[] { return [...this.seen]; }
  close(): void { this.ws.close(); }
}

const isType = (t: string) => (m: Message) => m.type === t;
const roomOf = (m: Message) => (m.payload as { room: PublicRoom }).room;

test('START_GAME 私密下发身份：每人只收到自己的 ROLE_INFO，ROOM_UPDATE 永远不带身份', async () => {
  for (let i = 0; i < 5; i++) await saveUser(`p${i}`, { nickname: `玩家${i}`, avatarUrl: '' });

  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = roomOf(await host.waitFor(isType(ServerEvent.ROOM_UPDATE))).roomId;

  const clients = [host];
  for (let i = 1; i < 5; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    c.send(ClientEvent.TOGGLE_READY, {});
    clients.push(c);
  }

  await host.waitFor(
    (m) => m.type === ServerEvent.ROOM_UPDATE &&
      roomOf(m).players.length === 5 &&
      roomOf(m).players.every((p) => p.isReady),
    4000,
  );

  host.send(ClientEvent.START_GAME, {});

  const roleMessages = await Promise.all(clients.map((c) => c.waitFor(isType(ServerEvent.ROLE_INFO))));
  await host.waitFor(isType(ServerEvent.GAME_STARTED));
  await host.waitFor((m) => m.type === ServerEvent.ROOM_UPDATE && roomOf(m).status === 'playing');

  for (const msg of roleMessages) {
    const info = (msg.payload as { info: { role?: string; team?: string } }).info;
    assert.ok(info.role, 'ROLE_INFO 应包含本人角色');
    assert.ok(info.team, 'ROLE_INFO 应包含本人阵营');
  }

  const roleInfoCounts = clients.map((c) => c.messages().filter((m) => m.type === ServerEvent.ROLE_INFO).length);
  assert.deepEqual(roleInfoCounts, [1, 1, 1, 1, 1]);

  const roleNames = ['merlin', 'percival', 'loyal', 'mordred', 'morgana', 'oberon', 'assassin', 'minion', 'lancelot'];
  for (const c of clients) {
    const roomUpdates = c.messages().filter((m) => m.type === ServerEvent.ROOM_UPDATE);
    assert.ok(roomUpdates.length > 0, '应收到房间广播');
    for (const update of roomUpdates) {
      const raw = JSON.stringify(update);
      assert.equal(raw.includes('"role"'), false, 'ROOM_UPDATE 不应包含 role 字段');
      assert.equal(raw.includes('"team"'), false, 'ROOM_UPDATE 不应包含 team 字段');
      for (const roleName of roleNames) {
        assert.equal(raw.includes(roleName), false, `ROOM_UPDATE 不应泄露角色名 ${roleName}`);
      }
    }
  }

  clients.forEach((c) => c.close());
});

test('7 人局真实发牌，重连后仍能重新收到自己的 ROLE_INFO', async () => {
  for (let i = 0; i < 7; i++) await saveUser(`p${i}`, { nickname: `玩家${i}`, avatarUrl: '' });

  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 7 } });
  const roomId = roomOf(await host.waitFor(isType(ServerEvent.ROOM_UPDATE))).roomId;

  const clients = [host];
  for (let i = 1; i < 7; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    c.send(ClientEvent.TOGGLE_READY, {});
    clients.push(c);
  }

  await host.waitFor(
    (m) => m.type === ServerEvent.ROOM_UPDATE &&
      roomOf(m).players.length === 7 &&
      roomOf(m).players.every((p) => p.isReady),
    4000,
  );
  host.send(ClientEvent.START_GAME, {});

  const roleMessages = await Promise.all(clients.map((c) => c.waitFor(isType(ServerEvent.ROLE_INFO))));
  const roles = roleMessages.map((m) => (m.payload as { info: { role: string } }).info.role).sort();
  assert.deepEqual(roles, ['assassin', 'loyal', 'loyal', 'merlin', 'morgana', 'oberon', 'percival'].sort());

  const reconnecting = clients[3]!;
  reconnecting.close();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const back = new Client(signToken('p3'));
  await back.open();
  back.send(ClientEvent.JOIN_ROOM, { roomId });
  await back.waitFor((m) => m.type === ServerEvent.ROOM_UPDATE && roomOf(m).status === 'playing');
  const restored = await back.waitFor(isType(ServerEvent.ROLE_INFO));
  assert.ok((restored.payload as { info: { role?: string; team?: string } }).info.role);
  assert.ok((restored.payload as { info: { role?: string; team?: string } }).info.team);

  clients.forEach((c) => c.close());
  back.close();
});

test('5 人开局 → 队长组队 → 全员赞成 → 提案通过', async () => {
  for (let i = 0; i < 5; i++) await saveUser(`p${i}`, { nickname: `玩家${i}`, avatarUrl: '' });

  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = roomOf(await host.waitFor(isType(ServerEvent.ROOM_UPDATE))).roomId;

  const guests: Client[] = [];
  for (let i = 1; i < 5; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    c.send(ClientEvent.TOGGLE_READY, {});
    guests.push(c);
  }

  // 等到 5 人且全部准备
  await host.waitFor(
    (m) => m.type === ServerEvent.ROOM_UPDATE &&
      roomOf(m).players.length === 5 &&
      roomOf(m).players.every((p) => p.isReady),
    4000,
  );

  // 开始游戏
  host.send(ClientEvent.START_GAME, {});
  await host.waitFor(isType(ServerEvent.GAME_STARTED));
  const started = roomOf(
    await host.waitFor((m) => m.type === ServerEvent.ROOM_UPDATE && roomOf(m).status === 'playing'),
  );
  assert.equal(started.game!.phase, 'team_building');
  assert.equal(started.game!.leaderSeat, 0); // 队长是 p0

  // 队长（p0）提名 2 人（第 1 轮 5 人需 2 名）
  host.send(ClientEvent.PROPOSE_TEAM, { seats: [0, 1] });
  const voting = roomOf(
    await host.waitFor((m) => m.type === ServerEvent.ROOM_UPDATE && roomOf(m).game?.phase === 'voting'),
  );
  assert.deepEqual(voting.game!.proposedTeam, [0, 1]);

  // 全员赞成
  host.send(ClientEvent.VOTE, { approve: true });
  for (const g of guests) g.send(ClientEvent.VOTE, { approve: true });

  const result = (await host.waitFor(isType(ServerEvent.VOTE_RESULT))).payload as VoteResultPayload;
  assert.equal(result.approved, true);
  assert.equal(result.votes.length, 5);
  assert.ok(result.votes.every((v) => v.approve));

  host.send(ClientEvent.QUEST_ACTION, { fail: false });
  guests[0]!.send(ClientEvent.QUEST_ACTION, { fail: false });
  const quest = (await host.waitFor(isType(ServerEvent.QUEST_RESULT))).payload as QuestResultPayload;
  assert.equal(quest.round, 1);
  assert.equal(quest.result, 'success');
  const afterQuest = roomOf(
    await host.waitFor((m) => m.type === ServerEvent.ROOM_UPDATE && roomOf(m).game?.round === 2),
  );
  assert.deepEqual(afterQuest.game!.questResults, ['success']);
  const raw = JSON.stringify(afterQuest);
  assert.equal(raw.includes('questActions'), false);
  assert.equal(raw.includes('"votes"'), false);

  host.close();
  guests.forEach((g) => g.close());
});

test('5 人开局 → 非队长组队被拒', async () => {
  for (let i = 0; i < 5; i++) await saveUser(`p${i}`, { nickname: `玩家${i}`, avatarUrl: '' });
  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = roomOf(await host.waitFor(isType(ServerEvent.ROOM_UPDATE))).roomId;

  const guests: Client[] = [];
  for (let i = 1; i < 5; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    c.send(ClientEvent.TOGGLE_READY, {});
    guests.push(c);
  }
  await host.waitFor(
    (m) => m.type === ServerEvent.ROOM_UPDATE &&
      roomOf(m).players.length === 5 && roomOf(m).players.every((p) => p.isReady),
    4000,
  );
  host.send(ClientEvent.START_GAME, {});
  await host.waitFor(isType(ServerEvent.GAME_STARTED));

  // 非队长 p1 试图组队
  const g1 = guests[0]!;
  g1.send(ClientEvent.PROPOSE_TEAM, { seats: [0, 1] });
  const e = await g1.waitFor(isType(ServerEvent.ERROR));
  assert.match((e.payload as { message: string }).message, /只有队长/);

  host.close();
  guests.forEach((g) => g.close());
});
