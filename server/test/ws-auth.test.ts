import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { setupWebSocket } from '../ws';

const server = createServer();
setupWebSocket(server);
let url: string;
before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

for (const query of ['', '?token=invalid.token.signature']) {
  test(`WebSocket denies unauthenticated connections: ${query || 'missing token'}`, { timeout: 3000 }, async t => {
    const ws = new WebSocket(url + query);
    t.after(() => ws.terminate());
    const messages: unknown[] = [];
    ws.on('message', raw => messages.push(JSON.parse(raw.toString())));
    const code = await new Promise<number>((resolve, reject) => {
      ws.on('close', resolve);
      ws.on('error', reject);
    });
    assert.equal(code, 4001);
    assert.equal(messages.length, 0);
  });
}
