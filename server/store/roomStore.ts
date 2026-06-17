/**
 * 房间存储。
 *
 * 按仓库选型说明：10 天单服务器 MVP 先用内存 Map，Redis 留口子。
 * 对外只暴露 async 的 get/save/delete/exists，内部用 Map 还是 Redis 对上层透明，
 * 将来换 Redis 只改这一个文件，ws / store 调用方零改动。
 */

import type { Room } from '@avalon/shared'

const rooms = new Map<string, Room>()

// 房间空闲过期时间：超过这个时长没有任何更新就回收（防死房间堆积）
const ROOM_TTL_MS = 2 * 60 * 60 * 1000 // 2 小时
const timers = new Map<string, NodeJS.Timeout>()

function touchExpiry(roomId: string): void {
  const old = timers.get(roomId)
  if (old) clearTimeout(old)
  const t = setTimeout(() => {
    rooms.delete(roomId)
    timers.delete(roomId)
  }, ROOM_TTL_MS)
  // 别让这个定时器阻止进程退出
  if (typeof t.unref === 'function') t.unref()
  timers.set(roomId, t)
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return rooms.get(roomId) ?? null
}

export async function saveRoom(room: Room): Promise<void> {
  rooms.set(room.roomId, room)
  touchExpiry(room.roomId)
}

export async function deleteRoom(roomId: string): Promise<void> {
  rooms.delete(roomId)
  const t = timers.get(roomId)
  if (t) clearTimeout(t)
  timers.delete(roomId)
}

export async function roomExists(roomId: string): Promise<boolean> {
  return rooms.has(roomId)
}

/** 仅供测试使用：清空所有房间 */
export async function _clearAllRooms(): Promise<void> {
  for (const t of timers.values()) clearTimeout(t)
  rooms.clear()
  timers.clear()
}
