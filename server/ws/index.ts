import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../utils/token';
import {
  ClientEvent,
  ServerEvent,
  makeMessage,
  toPublicRoom,
  canUseLancelot,
  canUseLadyOfLake,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type Message,
  type JoinRoomPayload,
  type CreateRoomPayload,
  type UpdateConfigPayload,
  type DebugSetRolesPayload,
  type ProposeTeamPayload,
  type VotePayload,
  type QuestActionPayload,
  type LadyInspectPayload,
  type AssassinatePayload,
  type Room,
  type Player,
  type GameConfig,
  type RoleInfo,
} from '@avalon/shared';
import { config } from '../config';
import { getRoom, saveRoom, deleteRoom, roomExists } from '../store/roomStore';
import { getUser } from '../store/userStore';
import { generateUniqueCode } from '../lib/roomCode';
import {
  initGame,
  dealRoles,
  buildRoleInfo,
  proposeTeam,
  castVote,
  submitQuestAction,
  inspectLadyOfLake,
  executeAssassination,
} from '../game/engine';
import {
  currentAssignedRoles,
  debugFillBots,
  debugSetRoles,
  runDebugBots,
  type DebugBotContext,
} from './debugBots';

/**
 * WebSocket 房间逻辑（Day 2）。
 *
 * 所有消息走 @avalon/shared 的统一信封 { type, payload }。
 * 安全红线：服务端持有完整 Room，任何广播都先 toPublicRoom() 剥掉私密字段。
 * 任何「房主才能做的事」都在服务端校验 openid === room.hostOpenid，绝不信前端。
 */

export interface GameSocket extends WebSocket {
  openid?: string;
  roomId?: string | null;
}

const DEFAULT_CONFIG: GameConfig = {
  playerCount: MIN_PLAYERS,
  useLancelot: false,
  useLadyOfLake: false,
};

/** 校正配置：人数夹到合法区间、人数不足时强制关掉扩展机制 */
function normalizeConfig(input: Partial<GameConfig>, floor = MIN_PLAYERS): GameConfig {
  const merged = { ...DEFAULT_CONFIG, ...input };
  let playerCount = Math.round(merged.playerCount);
  if (Number.isNaN(playerCount)) playerCount = floor;
  playerCount = Math.min(MAX_PLAYERS, Math.max(floor, playerCount));
  const useLancelot = merged.useLancelot && canUseLancelot(playerCount);
  const useLadyOfLake = merged.useLadyOfLake && canUseLadyOfLake(playerCount);
  return { playerCount, useLancelot, useLadyOfLake };
}

function parseToken(url: string | undefined): string {
  if (!url) return '';
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get('token') ?? '';
}

const debugBotContext: DebugBotContext = {
  currentRoom,
  err,
  broadcast,
  broadcastRoom,
  broadcastVoteResult,
  broadcastQuestResult,
  refreshRoleInfo,
  broadcastGameOver,
};

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: GameSocket, req) => {
    const payload = verifyToken(parseToken(req.url));
    if (!payload) {
      socket.close(4001, 'unauthorized');
      return;
    }
    socket.openid = payload.sub;
    socket.roomId = null;
    console.log(`[ws] connected: ${socket.openid}`);
    send(socket, makeMessage(ServerEvent.WELCOME, { openid: socket.openid }));

    // 按到达顺序串行处理同一连接的消息：
    // 否则 JOIN_ROOM 紧跟 TOGGLE_READY 时两个 async handler 会并发，
    // toggle 可能在 join 设好 roomId 之前执行而被丢弃。用 per-socket 队列串起来。
    let queue: Promise<void> = Promise.resolve();
    socket.on('message', (raw) => {
      queue = queue
        .then(async () => {
          let msg: Message;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return send(socket, makeMessage(ServerEvent.ERROR, { message: 'invalid json' }));
          }
          await handleMessage(wss, socket, msg);
        })
        .catch((e) => {
          console.error('[ws] handler error:', e);
          send(socket, makeMessage(ServerEvent.ERROR, { message: '服务器内部错误' }));
        });
    });

    socket.on('close', () => {
      console.log(`[ws] disconnected: ${socket.openid}`);
      void handleDisconnect(wss, socket);
    });
  });

  return wss;
}

async function handleMessage(wss: WebSocketServer, socket: GameSocket, msg: Message): Promise<void> {
  switch (msg.type) {
    case ClientEvent.PING:
      return send(socket, makeMessage(ServerEvent.PONG, { ts: Date.now() }));

    case ClientEvent.CREATE_ROOM:
      return createRoom(wss, socket, msg.payload as CreateRoomPayload);

    case ClientEvent.JOIN_ROOM:
      return joinRoom(wss, socket, msg.payload as JoinRoomPayload);

    case ClientEvent.LEAVE_ROOM:
      return leaveRoom(wss, socket);

    case ClientEvent.UPDATE_CONFIG:
      return updateConfig(wss, socket, msg.payload as UpdateConfigPayload);

    case ClientEvent.TOGGLE_READY:
      return toggleReady(wss, socket);

    case ClientEvent.START_GAME:
      return startGame(wss, socket);

    case ClientEvent.DEBUG_FILL_BOTS:
      return debugFillBots(debugBotContext, wss, socket);

    case ClientEvent.DEBUG_SET_ROLES:
      return debugSetRoles(debugBotContext, wss, socket, msg.payload as DebugSetRolesPayload);

    case ClientEvent.PROPOSE_TEAM:
      return handlePropose(wss, socket, msg.payload as ProposeTeamPayload);

    case ClientEvent.VOTE:
      return handleVote(wss, socket, msg.payload as VotePayload);

    case ClientEvent.QUEST_ACTION:
      return handleQuestAction(wss, socket, msg.payload as QuestActionPayload);

    case ClientEvent.LADY_INSPECT:
      return handleLadyInspect(wss, socket, msg.payload as LadyInspectPayload);

    case ClientEvent.ASSASSINATE:
      return handleAssassinate(wss, socket, msg.payload as AssassinatePayload);

    default:
      send(socket, makeMessage(ServerEvent.ERROR, { message: `unhandled type: ${msg.type}` }));
  }
}

// ===== 各业务 =====

async function createRoom(wss: WebSocketServer, socket: GameSocket, payload: CreateRoomPayload): Promise<void> {
  const openid = socket.openid!;
  const config = normalizeConfig(payload?.config ?? {});
  const roomId = await generateUniqueCode(roomExists);
  const host = await makePlayer(openid, 0, true);
  host.isReady = true; // 房主默认已准备

  const room: Room = {
    roomId,
    hostOpenid: openid,
    players: [host],
    status: 'waiting',
    config,
    createdAt: Date.now(),
  };
  await saveRoom(room);
  socket.roomId = roomId;
  console.log(`[ws] ${openid} created room ${roomId}`);
  broadcastRoom(wss, room);
}

async function joinRoom(wss: WebSocketServer, socket: GameSocket, payload: JoinRoomPayload): Promise<void> {
  const roomId = payload?.roomId?.trim().toUpperCase();
  if (!roomId) return err(socket, '缺少房间号');

  const room = await getRoom(roomId);
  if (!room) return err(socket, '房间不存在');

  const openid = socket.openid!;
  const existing = room.players.find((p) => p.openid === openid);
  if (existing) {
    // 重连：标记回在线即可
    existing.connected = true;
  } else {
    if (room.status !== 'waiting') return err(socket, '游戏已经开始');
    if (room.players.length >= room.config.playerCount) return err(socket, '房间已满');
    room.players.push(await makePlayer(openid, room.players.length, false));
  }
  await saveRoom(room);
  socket.roomId = roomId;
  console.log(`[ws] ${openid} joined room ${roomId}`);
  broadcastRoom(wss, room);
  if (existing && room.status !== 'waiting' && existing.role && existing.team) {
    send(socket, makeMessage(ServerEvent.ROLE_INFO, { info: buildRoleInfo(room, openid) }));
  }
}

async function leaveRoom(wss: WebSocketServer, socket: GameSocket): Promise<void> {
    const room = await currentRoom(socket);
    socket.roomId = null;
    if (!room) return;
  
    const openid = socket.openid!;
  
    // 【核心改动】：区分大厅阶段和对局阶段的退出逻辑
    if (room.status === 'playing') {
      // 1. 游戏中途主动退出（点击了退出按钮）：不移出数组，仅标记离线
      const me = room.players.find((p) => p.openid === openid);
      if (me) me.connected = false;
  
      // 2. MVP策略：强行结束游戏
      room.status = 'finished';
      if (room.game) room.game.phase = 'over';
      
      await saveRoom(room);
  
      // 3. 全服广播：某人逃跑，游戏解散（按照惯例，好人逃跑判坏人赢，这里统一用 evil 代替）
      broadcastGameOver(wss, room, 'evil', `玩家 [${me?.nickname || '未知'}] 中途逃跑，游戏强制解散！`);
      
      // 4. 更新房间状态，让剩下的人看到他头像灰掉，且阶段变为结束
      broadcastRoom(wss, room);
  
    } else {
      // 大厅等待阶段 或 游戏已经正常结束：正常移除玩家
      removePlayer(room, openid);
  
      // 如果人都走光了，销毁房间
      if (room.players.length === 0) {
        await deleteRoom(room.roomId);
        return;
      }
      await saveRoom(room);
      broadcastRoom(wss, room);
    }
  }

async function updateConfig(wss: WebSocketServer, socket: GameSocket, payload: UpdateConfigPayload): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  if (room.hostOpenid !== socket.openid) return err(socket, '只有房主可以修改配置');

  // 人数不能小于当前已在房间的玩家数
  const floor = Math.max(MIN_PLAYERS, room.players.length);
  const next = normalizeConfig({ ...room.config, ...payload.config }, floor);
  if (payload.config.playerCount !== undefined && payload.config.playerCount < room.players.length) {
    return err(socket, `人数不能小于当前玩家数（${room.players.length}）`);
  }
  room.config = next;
  await saveRoom(room);
  broadcastRoom(wss, room);
}

async function toggleReady(wss: WebSocketServer, socket: GameSocket): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return;
  const me = room.players.find((p) => p.openid === socket.openid);
  if (!me || me.isHost) return; // 房主视为始终准备
  me.isReady = !me.isReady;
  await saveRoom(room);
  broadcastRoom(wss, room);
}


async function startGame(wss: WebSocketServer, socket: GameSocket): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  if (room.hostOpenid !== socket.openid) return err(socket, '只有房主可以开始游戏');
  if (room.status !== 'waiting') return err(socket, '游戏已经开始');
  if (room.players.length !== room.config.playerCount) {
    return err(socket, `需要 ${room.config.playerCount} 人，当前 ${room.players.length} 人`);
  }
  if (room.players.some((p) => !p.isReady)) return err(socket, '还有玩家未准备');

  const assignedRoles = config.mockLogin ? currentAssignedRoles(room) : null;
  const deal = assignedRoles
    ? { ok: true as const, deal: { roleInfoByOpenid: Object.fromEntries(room.players.map((p) => [p.openid, buildRoleInfo(room, p.openid)])) } }
    : dealRoles(room);
  if (!deal.ok) return err(socket, deal.error);
  initGame(room);
  await saveRoom(room);
  const g = room.game!;
  console.log(`[ws] room ${room.roomId} game started, leaderSeat=${g.leaderSeat}`);

  sendRoleInfo(wss, room.roomId, deal.deal.roleInfoByOpenid);
  broadcast(wss, room.roomId, makeMessage(ServerEvent.GAME_STARTED, {
    round: g.round,
    leaderSeat: g.leaderSeat,
  }));
  broadcastRoom(wss, room);
  await runDebugBots(debugBotContext, wss, room);
}

function makeGameOverPayload(room: Room, winner: 'good' | 'evil', reason: string) {
  return {
    winner,
    reason,
    revealedRoles: room.players
      .filter((p) => p.role && p.team)
      .map((p) => ({
        openid: p.openid,
        nickname: p.nickname,
        seat: p.seat,
        role: p.role!,
        team: p.team!,
      }))
      .sort((a, b) => a.seat - b.seat),
  };
}

function broadcastGameOver(wss: WebSocketServer, room: Room, winner: 'good' | 'evil', reason: string): void {
  broadcast(wss, room.roomId, makeMessage(ServerEvent.GAME_OVER, makeGameOverPayload(room, winner, reason)));
}

function broadcastVoteResult(wss: WebSocketServer, room: Room, tally: Extract<ReturnType<typeof castVote>, { ok: true }>['tally']): void {
  if (tally.status !== 'resolved') return;
  const g = room.game!;
  broadcast(wss, room.roomId, makeMessage(ServerEvent.VOTE_RESULT, {
    approved: tally.approved,
    votes: tally.votes,
    round: g.round,
    leaderSeat: g.leaderSeat,
    rejectCount: g.rejectCount,
  }));
  if (tally.gameOver) {
    broadcastGameOver(wss, room, tally.gameOver.winner, tally.gameOver.reason);
  }
}

function broadcastQuestResult(wss: WebSocketServer, room: Room, tally: Extract<ReturnType<typeof submitQuestAction>, { ok: true }>['tally']): void {
  if (tally.status !== 'resolved') return;
  broadcast(wss, room.roomId, makeMessage(ServerEvent.QUEST_RESULT, {
    round: tally.round,
    result: tally.result,
    failCount: tally.failCount,
    requiredFails: tally.requiredFails,
    successCount: tally.successCount,
    failResultCount: tally.failResultCount,
  }));
  if (tally.gameOver) {
    broadcastGameOver(wss, room, tally.gameOver.winner, tally.gameOver.reason);
  }
}

function refreshRoleInfo(wss: WebSocketServer, room: Room): void {
  sendRoleInfo(wss, room.roomId, Object.fromEntries(room.players.map((p) => [p.openid, buildRoleInfo(room, p.openid)])));
}

async function handlePropose(
  wss: WebSocketServer,
  socket: GameSocket,
  payload: ProposeTeamPayload,
): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  const seats = Array.isArray(payload?.seats) ? payload.seats : [];
  const res = proposeTeam(room, socket.openid!, seats);
  if (!res.ok) return err(socket, res.error);
  await saveRoom(room);
  // 广播：进入投票阶段、提名队伍可见
  broadcastRoom(wss, room);
  const g = room.game!;
  broadcast(wss, room.roomId, makeMessage(ServerEvent.PHASE_CHANGE, {
    phase: g.phase,
    round: g.round,
    leaderSeat: g.leaderSeat,
    proposedTeam: g.proposedTeam,
    rejectCount: g.rejectCount,
  }));
  await runDebugBots(debugBotContext, wss, room);
}

async function handleVote(
  wss: WebSocketServer,
  socket: GameSocket,
  payload: VotePayload,
): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  const res = castVote(room, socket.openid!, !!payload?.approve);
  if (!res.ok) return err(socket, res.error);
  await saveRoom(room);

  if (res.tally.status === 'pending') {
    // 只更新「已投票人数」，不泄露谁投了什么
    broadcastRoom(wss, room);
    await runDebugBots(debugBotContext, wss, room);
    return;
  }

  // 全部投完，揭晓
  broadcastVoteResult(wss, room, res.tally);
  broadcastRoom(wss, room);

  if (res.tally.gameOver) return;
  await runDebugBots(debugBotContext, wss, room);
}

async function handleQuestAction(
  wss: WebSocketServer,
  socket: GameSocket,
  payload: QuestActionPayload,
): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  const res = submitQuestAction(room, socket.openid!, !!payload?.fail);
  if (!res.ok) return err(socket, res.error);
  await saveRoom(room);

  if (res.tally.status === 'pending') {
    await runDebugBots(debugBotContext, wss, room);
    return;
  }

  if (res.tally.lancelotEvent) refreshRoleInfo(wss, room);
  broadcastQuestResult(wss, room, res.tally);
  broadcastRoom(wss, room);

  if (res.tally.gameOver) return;
  await runDebugBots(debugBotContext, wss, room);
}

async function handleLadyInspect(
  wss: WebSocketServer,
  socket: GameSocket,
  payload: LadyInspectPayload,
): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  const targetOpenid = typeof payload?.targetOpenid === 'string' ? payload.targetOpenid : '';
  const res = inspectLadyOfLake(room, socket.openid!, targetOpenid);
  if (!res.ok) return err(socket, res.error);
  await saveRoom(room);

  const target = room.players.find((p) => p.openid === res.result.targetOpenid);
  send(socket, makeMessage(ServerEvent.LADY_RESULT, {
    holderSeat: res.result.holderSeat,
    targetOpenid: res.result.targetOpenid,
    targetNickname: target?.nickname ?? '未知玩家',
    targetSeat: res.result.targetSeat,
    targetTeam: res.result.targetTeam,
    nextHolderSeat: res.result.nextHolderSeat,
  }));
  if (res.result.lancelotEvent) refreshRoleInfo(wss, room);
  broadcastRoom(wss, room);
  await runDebugBots(debugBotContext, wss, room);
}

async function handleAssassinate(
  wss: WebSocketServer,
  socket: GameSocket,
  payload: AssassinatePayload,
): Promise<void> {
  const room = await currentRoom(socket);
  if (!room) return err(socket, '你不在任何房间');
  const targetOpenid = typeof payload?.targetOpenid === 'string' ? payload.targetOpenid : '';
  const res = executeAssassination(room, socket.openid!, targetOpenid);
  if (!res.ok) return err(socket, res.error);
  await saveRoom(room);

  broadcastGameOver(wss, room, res.gameOver.winner, res.gameOver.reason);
  broadcastRoom(wss, room);
}

async function handleDisconnect(wss: WebSocketServer, socket: GameSocket): Promise<void> {
    const room = await currentRoom(socket);
    if (!room) return;
    const me = room.players.find((p) => p.openid === socket.openid);
    if (me) {
      // 意外断线（如进电梯、锁屏）：只标记离线，绝对不解散房间！
      // 这样等他重新打开小程序触发 joinRoom 时，就能无缝恢复状态。
      me.connected = false; 
      await saveRoom(room);
      broadcastRoom(wss, room);
    }
  }

// ===== 工具 =====

async function makePlayer(openid: string, seat: number, isHost: boolean): Promise<Player> {
  const profile = await getUser(openid);
  return {
    openid,
    nickname: profile?.nickname ?? '玩家',
    avatarUrl: profile?.avatarUrl ?? '',
    seat,
    isHost,
    isReady: false,
    connected: true,
  };
}

/** 移除玩家；若移走的是房主则把房主转给座位最靠前的人，并重排座位 */
function removePlayer(room: Room, openid: string): void {
  const wasHost = room.hostOpenid === openid;
  room.players = room.players.filter((p) => p.openid !== openid);
  if (room.players.length === 0) return;
  room.players.forEach((p, i) => {
    p.seat = i;
    p.isHost = p.openid === room.hostOpenid;
  });
  if (wasHost) {
    const newHost = room.players[0]!;
    newHost.isHost = true;
    newHost.isReady = true;
    room.hostOpenid = newHost.openid;
  }
}

async function currentRoom(socket: GameSocket): Promise<Room | null> {
  if (!socket.roomId) return null;
  return getRoom(socket.roomId);
}

function send(socket: WebSocket, msg: Message): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

/** 私密身份只按 openid 单独发送，绝不走房间广播。 */
function sendRoleInfo(wss: WebSocketServer, roomId: string, roleInfoByOpenid: Record<string, RoleInfo>): void {
  for (const client of wss.clients as Set<GameSocket>) {
    if (!client.openid || client.roomId !== roomId || client.readyState !== WebSocket.OPEN) continue;
    const info = roleInfoByOpenid[client.openid];
    if (info) send(client, makeMessage(ServerEvent.ROLE_INFO, { info }));
  }
}

function err(socket: WebSocket, message: string): void {
  send(socket, makeMessage(ServerEvent.ERROR, { message }));
}

/** 广播给某房间所有在线连接 */
function broadcast(wss: WebSocketServer, roomId: string, msg: Message): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients as Set<GameSocket>) {
    if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

/** 广播房间的公开视图（剥掉 role/team/votes） */
function broadcastRoom(wss: WebSocketServer, room: Room): void {
  broadcast(wss, room.roomId, makeMessage(ServerEvent.ROOM_UPDATE, { room: toPublicRoom(room) }));
}
