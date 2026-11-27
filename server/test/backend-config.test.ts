import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backendEndpoints } from '../../client/config/backend'

test('backend origins share a host, require production TLS, and reject unsafe configuration', () => {
  assert.deepEqual(backendEndpoints(undefined, false), { http: 'http://localhost:3000', ws: 'ws://localhost:3000' })
  assert.deepEqual(backendEndpoints('https://game.example.com/', true), { http: 'https://game.example.com', ws: 'wss://game.example.com' })
  for (const input of [undefined, 'http://game.example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com/?token=x', 'ftp://example.com']) {
    assert.throws(() => backendEndpoints(input, true))
  }
})
