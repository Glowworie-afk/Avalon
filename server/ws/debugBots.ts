import { WebSocket, WebSocketServer } from 'ws';
import {
  ServerEvent,
  ROLE_META,
  buildRoleList,
  makeMessage,
  teamSize,
  type DebugSetRolesPayload,
  type Message,
  type Player,
  type Role,
  type Room,
} from '@avalon/shared';
import { config } from '../config';
import { saveRoom } from '../store/roomStore';
import {
  castVote,
  executeAssassination,
  inspectLadyOfLake,
  proposeTeam,
  submitQuestAction,
} from '../game/engine';
import type { GameSocket } from './index';

const DEBUG_BOT_PREFIX = 'debug-bot-';

type VoteTally = Extract<ReturnType<typeof castVote>, { ok: true }>['tally'];
type QuestTally = Extract<ReturnType<typeof submitQuestAction>, { ok: true }>['tally'];

export interface DebugBotContext {
  currentRoom(socket: GameSocket): Promise<Room | null>;
  err(socket: WebSocket, message: string): void;
  broadcast(wss: WebSocketServer, roomId: string, msg: Message): void;
  broadcastRoom(wss: WebSocketServer, room: Room): void;
  broadcastVoteResult(wss: WebSocketServer, room: Room, tally: VoteTally): void;
  broadcastQuestResult(wss: WebSocketServer, room: Room, tally: QuestTally): void;
  refreshRoleInfo(wss: WebSocketServer, room: Room): void;
  broadcastGameOver(wss: WebSocketServer, room: Room, winner: 'good' | 'evil', reason: string): void;
}

export async function debugFillBots(
  ctx: DebugBotContext,
  wss: WebSocketServer,
  socket: GameSocket,
): Promise<void> {
  if (!config.mockLogin) return ctx.err(socket, '测试玩家只能在 MOCK_LOGIN=true 时使用');

  const room = await ctx.currentRoom(socket);
  if (!room) return ctx.err(socket, '你不在任何房间');
  if (room.hostOpenid !== socket.openid) return ctx.err(socket, '只有房主可以补齐测试玩家');
  if (room.status !== 'waiting') return ctx.err(socket, '游戏已经开始');

  while (room.players.length < room.config.playerCount) {
    const seat = room.players.length;
    room.players.push({
      openid: 'debug-bot-' + room.roomId + '-' + seat,
      nickname: '测试骑士' + (seat + 1),
      avatarUrl: '',
      seat,
      isHost: false,
      isReady: true,
      connected: true,
    });
  }

  await saveRoom(room);
  ctx.broadcastRoom(wss, room);
}

function sameRoleMultiset(a: Role[], b: Role[]): boolean {
  if (a.length !== b.length) return false;
  const key = (roles: Role[]) => [...roles].sort().join('|');
  return key(a) === key(b);
}

export function currentAssignedRoles(room: Room): Role[] | null {
  const roles = room.players.map((p) => p.role);
  return roles.every(Boolean) ? (roles as Role[]) : null;
}

export async function debugSetRoles(
  ctx: DebugBotContext,
  wss: WebSocketServer,
  socket: GameSocket,
  payload: DebugSetRolesPayload,
): Promise<void> {
  if (!config.mockLogin) return ctx.err(socket, '测试身份只能在 MOCK_LOGIN=true 时使用');

  const room = await ctx.currentRoom(socket);
  if (!room) return ctx.err(socket, '你不在任何房间');
  if (room.hostOpenid !== socket.openid) return ctx.err(socket, '只有房主可以指定测试身份');
  if (room.status !== 'waiting') return ctx.err(socket, '游戏已经开始');
  if (room.players.length !== room.config.playerCount) {
    return ctx.err(socket, `需要先补齐到 ${room.config.playerCount} 人`);
  }

  const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
  const byOpenid = new Map(assignments.map((item) => [item.openid, item.role]));
  const roles = room.players.map((p) => byOpenid.get(p.openid));
  if (!roles.every(Boolean)) return ctx.err(socket, '测试身份配置不完整');

  const assignedRoles = roles as Role[];
  const expectedRoles = buildRoleList(room.config.playerCount, room.config);
  if (!sameRoleMultiset(assignedRoles, expectedRoles)) {
    return ctx.err(socket, '测试身份必须和当前人数/扩展的角色池一致');
  }

  room.players.forEach((player, index) => {
    const role = assignedRoles[index]!;
    player.role = role;
    player.team = ROLE_META[role].team;
  });

  await saveRoom(room);
  ctx.broadcastRoom(wss, room);
}

function isDebugBot(player: Player): boolean {
  return player.openid.startsWith(DEBUG_BOT_PREFIX);
}

function selectDebugTeam(room: Room): number[] {
  const g = room.game!;
  const need = teamSize(room.config.playerCount, g.round);
  const leaderSeat = g.leaderSeat;
  return [
    leaderSeat,
    ...room.players
      .map((p) => p.seat)
      .filter((seat) => seat !== leaderSeat)
      .sort((a, b) => a - b),
  ].slice(0, need);
}

export async function runDebugBots(
  ctx: DebugBotContext,
  wss: WebSocketServer,
  room: Room,
): Promise<void> {
  if (!config.mockLogin || room.status !== 'playing' || !room.game) return;

  for (let guard = 0; guard < 20; guard += 1) {
    const g = room.game;
    if (!g || room.status !== 'playing') return;

    if (g.phase === 'team_building') {
      const leader = room.players.find((p) => p.seat === g.leaderSeat);
      if (!leader || !isDebugBot(leader)) return;

      const res = proposeTeam(room, leader.openid, selectDebugTeam(room));
      if (!res.ok) {
        console.warn('[debug-bot] propose failed:', res.error);
        return;
      }
      await saveRoom(room);
      ctx.broadcastRoom(wss, room);
      ctx.broadcast(wss, room.roomId, makeMessage(ServerEvent.PHASE_CHANGE, {
        phase: g.phase,
        round: g.round,
        leaderSeat: g.leaderSeat,
        proposedTeam: g.proposedTeam,
        rejectCount: g.rejectCount,
      }));
      continue;
    }

    if (g.phase === 'voting') {
      let acted = false;
      let resolved: VoteTally | null = null;
      for (const bot of room.players.filter(isDebugBot)) {
        if (g.votes[bot.openid] !== undefined) continue;
        const res = castVote(room, bot.openid, bot.team === 'good');
        if (!res.ok) {
          console.warn('[debug-bot] vote failed:', res.error);
          continue;
        }
        acted = true;
        resolved = res.tally;
        if (res.tally.status === 'resolved') break;
      }
      if (!acted) return;
      await saveRoom(room);
      if (resolved?.status === 'resolved') {
        ctx.broadcastVoteResult(wss, room, resolved);
        ctx.broadcastRoom(wss, room);
        if (resolved.gameOver) return;
        continue;
      }
      ctx.broadcastRoom(wss, room);
      return;
    }

    if (g.phase === 'quest') {
      let acted = false;
      let resolved: QuestTally | null = null;
      for (const bot of room.players.filter((p) => isDebugBot(p) && g.proposedTeam.includes(p.seat))) {
        if (g.questActions[bot.openid] !== undefined) continue;
        const res = submitQuestAction(room, bot.openid, bot.team === 'evil');
        if (!res.ok) {
          console.warn('[debug-bot] quest failed:', res.error);
          continue;
        }
        acted = true;
        resolved = res.tally;
        if (res.tally.status === 'resolved') break;
      }
      if (!acted) return;
      await saveRoom(room);
      if (resolved?.status === 'resolved') {
        if (resolved.lancelotEvent) ctx.refreshRoleInfo(wss, room);
        ctx.broadcastQuestResult(wss, room, resolved);
        ctx.broadcastRoom(wss, room);
        if (resolved.gameOver) return;
        continue;
      }
      return;
    }

    if (g.phase === 'lady') {
      const holder = room.players.find((p) => p.seat === g.ladyOfLakeHolder);
      if (!holder || !isDebugBot(holder)) return;
      const target = room.players.find((p) => p.seat !== holder.seat && !g.ladyHistory.includes(p.seat));
      if (!target) return;
      const res = inspectLadyOfLake(room, holder.openid, target.openid);
      if (!res.ok) return;
      await saveRoom(room);
      if (res.result.lancelotEvent) ctx.refreshRoleInfo(wss, room);
      ctx.broadcastRoom(wss, room);
      continue;
    }

    if (g.phase === 'assassin') {
      const assassin = room.players.find((p) => isDebugBot(p) && p.role === 'assassin');
      const merlin = room.players.find((p) => p.role === 'merlin');
      if (!assassin || !merlin) return;
      const res = executeAssassination(room, assassin.openid, merlin.openid);
      if (!res.ok) return;
      await saveRoom(room);
      ctx.broadcastGameOver(wss, room, res.gameOver.winner, res.gameOver.reason);
      ctx.broadcastRoom(wss, room);
      return;
    }

    return;
  }
}
