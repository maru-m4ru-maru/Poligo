import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRejectBannedSession } from '../../services/api/src/sessionPolicy.js'

test('rejects existing sessions for banned users', () => {
  assert.equal(
    shouldRejectBannedSession({ user: { id: 'banned-user' } }, new Set(['banned-user'])),
    true
  )
})

test('preserves sessions for users who are not banned', () => {
  assert.equal(
    shouldRejectBannedSession({ user: { id: 'active-user' } }, new Set(['banned-user'])),
    false
  )
})

test('does not treat missing sessions or missing user IDs as banned identities', () => {
  assert.equal(shouldRejectBannedSession(null, new Set(['banned-user'])), false)
  assert.equal(shouldRejectBannedSession({ user: {} }, new Set(['banned-user'])), false)
})
