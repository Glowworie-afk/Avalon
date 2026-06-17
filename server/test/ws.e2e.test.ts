import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { setupWebSocket } from '../ws';
import { signToken } from '../utils/token';
import { saveUser, _clearAllUsers } from '../store/userStore';
import { getRoom, _clearAllRooms } from '../store/roomStore';
import {
  ClientEvent,
  ServerEvent,
  makeMessage,
  type Message,
  type PublicRoom,
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

/** 一个带消息缓冲、可 await 等待指定事件的测试客户端 */
class Client {
  private ws: WebSocket;
  private buffer: Message[] = [];
  private waiters: { pred: (m: Message) => boolean; resolve: (m: Message) => void }[] = [];

  constructor(token: string) {
    this.ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Message;
      const idx = this.waiters.findIndex((w) => w.pred(msg));
      if (idx >= 0) {
        const [w] = this.waiters.splice(idx, 1);
        w!.resolve(msg);
      } else {
        this.buffer.push(msg);
      }
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

  /** 等待第一条满足 type 的消息（先翻缓冲再等未来），超时报错 */
  waitFor(type: string, timeout = 2000): Promise<Message> {
    const idx = this.buffer.findIndex((m) => m.type === type);
    if (idx >= 0) {
      const [m] = this.buffer.splice(idx, 1);
      return Promise.resolve(m!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`等待 ${type} 超时`)), timeout);
      this.waiters.push({
        pred: (m) => m.type === type,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  close(): void {
    this.ws.close();
  }
}

function room(msg: Message): PublicRoom {
  return (msg.payload as { room: PublicRoom }).room;
}

test('建房 → 加入：双方都收到含 2 人的 ROOM_UPDATE', async () => {
  await saveUser('hostA', { nickname: '阿尔法', avatarUrl: '' });
  await saveUser('userB', { nickname: '贝塔', avatarUrl: '' });

  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 6 } });
  const created = room(await host.waitFor(ServerEvent.ROOM_UPDATE));
  assert.equal(created.players.length, 1);
  assert.equal(created.players[0]!.isHost, true);
  assert.equal(created.players[0]!.nickname, '阿尔法');
  assert.equal(created.config.playerCount, 6);
  const roomId = created.roomId;

  const guest = new Client(signToken('userB'));
  await guest.open();
  guest.send(ClientEvent.JOIN_ROOM, { roomId });

  const hostView = room(await host.waitFor(ServerEvent.ROOM_UPDATE));
  const guestView = room(await guest.waitFor(ServerEvent.ROOM_UPDATE));
  assert.equal(hostView.players.length, 2);
  assert.equal(guestView.players.length, 2);
  // 广播是公开视图：绝不能带 role/team
  for (const p of hostView.players) {
    assert.ok(!('role' in p), '公开视图不应含 role');
    assert.ok(!('team' in p), '公开视图不应含 team');
  }

  host.close();
  guest.close();
});

test('加入不存在的房间报错', async () => {
  const c = new Client(signToken('x'));
  await c.open();
  c.send(ClientEvent.JOIN_ROOM, { roomId: 'NOPE' });
  const e = await c.waitFor(ServerEvent.ERROR);
  assert.match((e.payload as { message: string }).message, /房间不存在/);
  c.close();
});

test('重复加入同一房间不会重复占座', async () => {
  await saveUser('hostA', { nickname: '阿尔法', avatarUrl: '' });
  await saveUser('userB', { nickname: '贝塔', avatarUrl: '' });

  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guest = new Client(signToken('userB'));
  await guest.open();
  guest.send(ClientEvent.JOIN_ROOM, { roomId });
  await guest.waitFor(ServerEvent.ROOM_UPDATE);
  await host.waitFor(ServerEvent.ROOM_UPDATE);

  guest.send(ClientEvent.JOIN_ROOM, { roomId });
  const view = room(await host.waitFor(ServerEvent.ROOM_UPDATE));
  assert.deepEqual(view.players.map((p) => p.openid), ['hostA', 'userB']);

  host.close();
  guest.close();
});

test('房间满员后继续加入会被拒绝', async () => {
  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guests: Client[] = [];
  for (let i = 1; i < 5; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    await c.waitFor(ServerEvent.ROOM_UPDATE);
    guests.push(c);
  }

  const extra = new Client(signToken('p5'));
  await extra.open();
  extra.send(ClientEvent.JOIN_ROOM, { roomId });
  const e = await extra.waitFor(ServerEvent.ERROR);
  assert.match((e.payload as { message: string }).message, /房间已满/);

  host.close();
  guests.forEach((c) => c.close());
  extra.close();
});

test('只有房主能改配置；非房主被拒', async () => {
  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 6 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guest = new Client(signToken('userB'));
  await guest.open();
  guest.send(ClientEvent.JOIN_ROOM, { roomId });
  await guest.waitFor(ServerEvent.ROOM_UPDATE);
  await host.waitFor(ServerEvent.ROOM_UPDATE);

  // 非房主改配置 → 报错
  guest.send(ClientEvent.UPDATE_CONFIG, { config: { playerCount: 8 } });
  const e = await guest.waitFor(ServerEvent.ERROR);
  assert.match((e.payload as { message: string }).message, /只有房主/);

  // 房主改配置 → 广播生效
  host.send(ClientEvent.UPDATE_CONFIG, { config: { playerCount: 8, useLancelot: true } });
  const updated = room(await host.waitFor(ServerEvent.ROOM_UPDATE));
  assert.equal(updated.config.playerCount, 8);
  assert.equal(updated.config.useLancelot, true);

  host.close();
  guest.close();
});

test('非房主不能开始游戏', async () => {
  const host = new Client(signToken('p0'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guests: Client[] = [];
  for (let i = 1; i < 5; i++) {
    const c = new Client(signToken(`p${i}`));
    await c.open();
    c.send(ClientEvent.JOIN_ROOM, { roomId });
    c.send(ClientEvent.TOGGLE_READY, {});
    await c.waitFor(ServerEvent.ROOM_UPDATE);
    guests.push(c);
  }

  const guest = guests[0]!;
  guest.send(ClientEvent.START_GAME, {});
  const e = await guest.waitFor(ServerEvent.ERROR);
  assert.match((e.payload as { message: string }).message, /只有房主/);

  host.close();
  guests.forEach((c) => c.close());
});

test('准备状态同步：玩家 toggle 后房主能看到', async () => {
  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 6 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guest = new Client(signToken('userB'));
  await guest.open();
  guest.send(ClientEvent.JOIN_ROOM, { roomId });
  await guest.waitFor(ServerEvent.ROOM_UPDATE);
  await host.waitFor(ServerEvent.ROOM_UPDATE);

  guest.send(ClientEvent.TOGGLE_READY, {});
  const view = room(await host.waitFor(ServerEvent.ROOM_UPDATE));
  const g = view.players.find((p) => p.openid === 'userB');
  assert.equal(g!.isReady, true);

  host.close();
  guest.close();
});

test('人数不齐时开始游戏被拒', async () => {
  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 6 } });
  await host.waitFor(ServerEvent.ROOM_UPDATE);

  host.send(ClientEvent.START_GAME, {});
  const e = await host.waitFor(ServerEvent.ERROR);
  assert.match((e.payload as { message: string }).message, /需要 6 人/);

  host.close();
});

test('唯一玩家离开后房间解散', async () => {
  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 5 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  host.send(ClientEvent.LEAVE_ROOM, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(await getRoom(roomId), null);

  host.close();
});

test('房主退出后房主转移给下一位', async () => {
  const host = new Client(signToken('hostA'));
  await host.open();
  host.send(ClientEvent.CREATE_ROOM, { config: { playerCount: 6 } });
  const roomId = room(await host.waitFor(ServerEvent.ROOM_UPDATE)).roomId;

  const guest = new Client(signToken('userB'));
  await guest.open();
  guest.send(ClientEvent.JOIN_ROOM, { roomId });
  await guest.waitFor(ServerEvent.ROOM_UPDATE);
  await host.waitFor(ServerEvent.ROOM_UPDATE);

  host.send(ClientEvent.LEAVE_ROOM, {});
  const view = room(await guest.waitFor(ServerEvent.ROOM_UPDATE));
  assert.equal(view.players.length, 1);
  assert.equal(view.players[0]!.openid, 'userB');
  assert.equal(view.players[0]!.isHost, true);
  assert.equal(view.hostOpenid, 'userB');

  host.close();
  guest.close();
});
