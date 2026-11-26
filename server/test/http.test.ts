import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import loginRouter from '../http/login';
import profileRouter from '../http/profile';
import { config } from '../config';
import { signToken, verifyToken } from '../utils/token';
import { _clearAllUsers } from '../store/userStore';

const app = express();
app.use(express.json());
app.use('/api', loginRouter, profileRouter);
const server = createServer(app);
const localFetch = globalThis.fetch;
let origin: string;

before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => _clearAllUsers());

async function request(path: string, method = 'GET', body?: unknown, token?: string) {
  const response = await localFetch(`${origin}/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(3000),
  });
  return { status: response.status, body: await response.json() };
}

test('login rejects missing codes and mock login returns a verifiable identity', async () => {
  assert.equal(config.mockLogin, true);
  assert.equal((await request('login', 'POST', {})).status, 400);
  const result = await request('login', 'POST', { code: 'alice' });
  assert.equal(result.status, 200);
  assert.equal(result.body.openid, 'mock_alice');
  assert.equal(verifyToken(result.body.token)?.sub, 'mock_alice');
});

test('profile endpoints reject missing and invalid bearer tokens', async () => {
  for (const method of ['GET', 'POST']) {
    for (const token of [undefined, 'invalid.token.signature']) {
      const result = await request('profile', method, method === 'POST' ? { nickname: 'Alice' } : undefined, token);
      assert.equal(result.status, 401);
    }
  }
});

test('profiles validate input, normalize values, and isolate authenticated identities', async () => {
  const alice = signToken('alice');
  const bob = signToken('bob');
  assert.deepEqual((await request('profile', 'GET', undefined, alice)).body, { profile: null });
  for (const nickname of ['', '   ', 42, null]) {
    assert.equal((await request('profile', 'POST', { nickname }, alice)).status, 400);
  }
  const saved = await request('profile', 'POST', { nickname: `  ${'a'.repeat(25)}  `, avatarUrl: 42, openid: 'bob' }, alice);
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.profile, { nickname: 'a'.repeat(20), avatarUrl: '' });
  assert.deepEqual((await request('profile', 'GET', undefined, alice)).body.profile, saved.body.profile);
  assert.equal((await request('profile', 'GET', undefined, bob)).body.profile, null);
  assert.equal((await request('profile', 'POST', { nickname: '' }, alice)).status, 400);
  assert.deepEqual((await request('profile', 'GET', undefined, alice)).body.profile, saved.body.profile);
});

test('WeChat login handles success, rejection, and upstream errors without live credentials', async t => {
  const previous = config.mockLogin;
  Object.assign(config, { mockLogin: false });
  try {
    const upstream = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ openid: 'wx-alice', session_key: 'private-key' })));
    const success = await request('login', 'POST', { code: 'test-code' });
    assert.equal(success.status, 200);
    assert.equal(verifyToken(success.body.token)?.sub, 'wx-alice');
    assert.equal(success.body.session_key, undefined);
    upstream.mock.mockImplementation(async () => new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' })));
    assert.equal((await request('login', 'POST', { code: 'bad-code' })).status, 401);
    t.mock.method(console, 'error', () => {});
    upstream.mock.mockImplementation(async () => { throw new Error('upstream unavailable'); });
    assert.equal((await request('login', 'POST', { code: 'test-code' })).status, 500);
  } finally {
    Object.assign(config, { mockLogin: previous });
  }
});
