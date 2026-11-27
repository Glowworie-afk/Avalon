import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visiblePlayers } from '../../client/src/components/RoleVision/visiblePlayers'

test('private role views cover Merlin, Percival, evil allies, and roles without information', () => {
  assert.deepEqual(visiblePlayers({ role: 'merlin', team: 'good', knownEvil: ['a'] }), [{ openid: 'a', label: '梅林视野' }])
  assert.deepEqual(visiblePlayers({ role: 'percival', team: 'good', merlinCandidates: ['a', 'b'] }).map(p => p.openid), ['a', 'b'])
  assert.deepEqual(visiblePlayers({ role: 'assassin', team: 'evil', fellowEvil: ['b'] }), [{ openid: 'b', label: '邪恶同伙' }])
  assert.deepEqual(visiblePlayers({ role: 'oberon', team: 'evil' }), [])
  assert.deepEqual(visiblePlayers(null), [])
})
