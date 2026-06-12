import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../utils/token';
import {
  ClientEvent,
  ServerEvent,
  makeMessage,
  type Message,
  type JoinRoomPayload,
  type PublicPlayer,
  type PublicRoom,
} from '@avalon/shared';

/**
 * WebSocket 链路。所有消息都走 @avalon/shared 里定义的统一信封：
 *   { type: ClientEvent | ServerEvent, payload: ... }
 *
 * Day 1 范围：握手鉴权、PING/PONG、JOIN_ROOM 后按房间广播 ROOM_UPDATE（公开视图）。
 * 真正的房间持久化、发牌、可见性计算在 Day 2–5。
 */

interface GameSocket extends WebSocket {
  openid?: string;
  roomId?: string | null;
}

/** 从握手 URL 解析 token（客户端通过 ?token=xxx 传） */
function parseToken(url: string | undefined): string {
  if (!url) return '';
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get('token') ?? '';
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: GameSocket, req) => {
    // —— 握手即鉴权 ——
    const payload = verifyToken(parseToken(req.url));
    if (!payload) {
      socket.close(4001, 'unauthorized');
      return;
    }
    socket.openid = payload.sub;
    socket.roomId = null;
    console.log(`[ws] connected: ${socket.openid}`);

    sendMessage(socket, makeMessage(ServerEvent.WELCOME, { openid: socket.openid }));

    socket.on('message', (raw) => {
      let msg: Message;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return sendMessage(socket, makeMessage(ServerEvent.ERROR, { message: 'invalid json' }));
      }

      switch (msg.type) {
        case ClientEvent.PING:
          sendMessage(socket, makeMessage(ServerEvent.PONG, { ts: Date.now() }));
          break;

        case ClientEvent.JOIN_ROOM: {
          const { roomId } = msg.payload as JoinRoomPayload;
          if (!roomId) {
            return sendMessage(socket, makeMessage(ServerEvent.ERROR, { message: 'missing roomId' }));
          }
          socket.roomId = roomId;
          console.log(`[ws] ${socket.openid} joined room ${roomId}`);
          // 广播公开房间视图给同房间所有人（Day 1 骨架，Day 2 换成 Redis 里的真实房间）
          broadcast(wss, roomId, makeMessage(ServerEvent.ROOM_UPDATE, { room: buildRoomSkeleton(wss, roomId) }));
          break;
        }

        default:
          sendMessage(socket, makeMessage(ServerEvent.ERROR, { message: `unhandled type: ${msg.type}` }));
      }
    });

    socket.on('close', () => {
      console.log(`[ws] disconnected: ${socket.openid}`);
      const roomId = socket.roomId;
      // 离开后也广播一次，让房间里其他人看到人数变化（重连/房主迁移留到 Day 9）
      if (roomId) {
        broadcast(wss, roomId, makeMessage(ServerEvent.ROOM_UPDATE, { room: buildRoomSkeleton(wss, roomId) }));
      }
    });
  });

  return wss;
}

/** 给单条连接发一条信封消息 */
function sendMessage(socket: WebSocket, msg: Message): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

/** 广播给某房间的所有连接 */
function broadcast(wss: WebSocketServer, roomId: string, msg: Message): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients as Set<GameSocket>) {
    if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

/**
 * Day 1 临时：直接从当前在线连接拼出一个公开房间视图。
 * Day 2 起房间状态落到 Redis，这里会换成读真实 Room 再 toPublicRoom()。
 */
function buildRoomSkeleton(wss: WebSocketServer, roomId: string): PublicRoom {
  const members = [...(wss.clients as Set<GameSocket>)].filter(
    (c) => c.roomId === roomId && c.readyState === WebSocket.OPEN,
  );
  const players: PublicPlayer[] = members.map((c, i) => ({
    openid: c.openid ?? '',
    nickname: c.openid ?? '', // 还没接用户昵称，先用 openid 占位
    seat: i,
    isHost: i === 0,
    isReady: false,
    connected: true,
  }));
  return {
    roomId,
    hostOpenid: players[0]?.openid ?? '',
    players,
    status: 'waiting',
    config: { useLancelot: false, useLadyOfLake: false },
    createdAt: Date.now(),
  };
}
