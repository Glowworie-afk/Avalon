import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genCode, generateUniqueCode } from '../lib/roomCode';

test('genCode 生成 4 位、且只含去歧义字符', () => {
  for (let i = 0; i < 200; i++) {
    const code = genCode();
    assert.equal(code.length, 4);
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    // 不含易混字符
    assert.ok(!/[01OIL]/.test(code), `不应包含易混字符: ${code}`);
  }
});

test('generateUniqueCode 跳过已占用的码', async () => {
  // 模拟前几次都撞，最后才放行
  const taken = new Set<string>();
  let calls = 0;
  const exists = async (code: string) => {
    calls++;
    if (calls <= 3) {
      taken.add(code);
      return true; // 前 3 次都说"已存在"
    }
    return false;
  };
  const code = await generateUniqueCode(exists);
  assert.equal(code.length, 4);
  assert.ok(!taken.has(code));
  assert.ok(calls >= 4);
});

test('generateUniqueCode 重试耗尽时抛错', async () => {
  await assert.rejects(
    () => generateUniqueCode(async () => true, 5),
    /重试次数耗尽/,
  );
});
