import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { config } from '../config';
import { signToken, verifyToken } from '../utils/token';

function signed(payload: unknown, header: unknown = { alg: 'HS256', typ: 'JWT' }): string {
  const data = [header, payload].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  return `${data}.${createHmac('sha256', config.jwtSecret).update(data).digest('base64url')}`;
}

test('token preserves identity and rejects tampering and malformed input', () => {
  const token = signToken('player-A');
  assert.equal(verifyToken(token)?.sub, 'player-A');
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ sub: 'player-B', exp: 9999999999 })).toString('base64url');
  assert.equal(verifyToken(parts.join('.')), null);
  for (const invalid of ['', 'abc', 'a.b.c', `${token}.extra`, `${token.slice(0, -2)}xx`]) {
    assert.equal(verifyToken(invalid), null);
  }
});

test('token expires at the exact expiry second', t => {
  t.mock.method(Date, 'now', () => 1700000000000);
  for (const exp of [1699999999, 1700000000]) {
    assert.equal(verifyToken(signed({ sub: 'player', iat: 1699999900, exp })), null);
  }
  assert.equal(verifyToken(signed({ sub: 'player', iat: 1699999900, exp: 1700000001 }))?.sub, 'player');
});

test('signed tokens still require valid identity, expiry, and HS256 header', () => {
  const valid = { sub: 'player', iat: 1700000000, exp: 9999999999 };
  for (const payload of [null, {}, { ...valid, sub: '' }, { ...valid, sub: 42 }, { ...valid, exp: '9999999999' }]) {
    assert.equal(verifyToken(signed(payload)), null);
  }
  for (const header of [null, {}, { alg: 'none', typ: 'JWT' }, { alg: 'HS512', typ: 'JWT' }]) {
    assert.equal(verifyToken(signed(valid, header)), null);
  }
});
