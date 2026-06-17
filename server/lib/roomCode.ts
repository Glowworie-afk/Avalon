/**
 * 房间码生成。
 * - 4 位，去掉容易看错的 0/O/1/I/L 等字符。
 * - 通过传入的 exists() 校验避重，撞了就重生成。
 */

// 去歧义字符集：没有 0 O 1 I L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LEN = 4

/** 生成一个 4 位房间码（不保证唯一，唯一性由 generateUniqueCode 负责） */
export function genCode(): string {
  let s = ''
  for (let i = 0; i < CODE_LEN; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return s
}

/**
 * 生成一个当前不存在的房间码。
 * @param exists 判断某码是否已被占用（异步，便于将来对接 Redis）
 * @param maxTries 最多尝试次数，避免极端情况下死循环
 */
export async function generateUniqueCode(
  exists: (code: string) => Promise<boolean>,
  maxTries = 50,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const code = genCode()
    if (!(await exists(code))) return code
  }
  throw new Error('生成房间码失败：重试次数耗尽')
}
