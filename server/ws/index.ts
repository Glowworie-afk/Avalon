import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../utils/token';

/**
 * WebSocket 链路（对应 Day 1 目标）：
 *   客户端发消息 → 服务端用 token 认出是谁 → 广播给同房间的人。
 *
 * 关键概念：每条连接都要和「玩家 openid」「房间 roomId」绑定。
 * 这里直接把这两个字段挂在 ws 对象上（最简单的做法）。
 */

// 给 ws 连接对象扩展我们要挂的字段
interface GameSocket extends WebSocket {
  openid?: string;
  roomId?: string | null;
}

// 客户端 → 服务端 的消息类型
type ClientMessage =
  | { type: 'PING' }
  | { type: 'JOIN'; roomId: string }
  | { type: 'CHAT'; text: string };

/** 从握手请求的 URL 里解析出 token（客户端通过 ?token=xxx 传） */
function parseToken(url: string | undefined): string {
  if (!url) return '';
  // url 形如 "/?token=xxx"，用一个占位 base 拼成完整 URL 再解析
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get('token') ?? '';
}

export function setupWebSocket(server: HttpServer): WebSocketServer {
  // 复用 Express 的同一个 http 端口，不另开端口
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: GameSocket, req) => {
    // —— 握手即鉴权：没有有效 token 直接踢掉 ——
    const token = parseToken(req.url);
    const payload = verifyToken(token);
    if (!payload) {
      socket.close(4001, 'unauthorized');
      return;
    }
    socket.openid = payload.sub;
    socket.roomId = null;
    console.log(`[ws] connected: ${socket.openid}`);

    // 连上先回个欢迎，方便客户端确认握手成功
    send(socket, { type: 'WELCOME', openid: socket.openid });

    socket.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(socket, { type: 'ERROR', error: 'invalid json' });
      }

      switch (msg.type) {
        case 'PING':
          send(socket, { type: 'PONG', ts: Date.now() });
          break;

        case 'JOIN':
          socket.roomId = msg.roomId;
          console.log(`[ws] ${socket.openid} joined room ${msg.roomId}`);
          // 通知同房间所有人「有人加入了」
          broadcast(wss, msg.roomId, {
            type: 'SYSTEM',
            event: 'join',
            openid: socket.openid,
          });
          break;

        case 'CHAT':
          // 广播给同房间的人；没进房间就只回给自己
          if (socket.roomId) {
            broadcast(wss, socket.roomId, {
              type: 'CHAT',
              from: socket.openid,
              text: msg.text,
            });
          } else {
            send(socket, { type: 'ERROR', error: 'join a room first' });
          }
          break;

        default:
          send(socket, { type: 'ERROR', error: 'unknown type' });
      }
    });

    socket.on('close', () => {
      console.log(`[ws] disconnected: ${socket.openid}`);
      // 断线重连、房主迁移等放到 Day 9 处理，这里先只打日志
    });
  });

  return wss;
}

/** 给单条连接发消息 */
function send(socket: WebSocket, msg: object): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

/** 广播给某个房间里的所有连接 */
function broadcast(wss: WebSocketServer, roomId: string, msg: object): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients as Set<GameSocket>) {
    if (client.roomId === roomId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
