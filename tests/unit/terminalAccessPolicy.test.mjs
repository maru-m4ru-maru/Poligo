import assert from 'node:assert/strict'
import test from 'node:test'
import { canAcceptTerminalUpgrade } from '../../services/api/src/terminalAccessPolicy.js'

function request(overrides = {}) {
  return canAcceptTerminalUpgrade({
    owner: { userId: 'user-1', expiresAt: 10_000, revoked: false },
    now: 1000,
    originAllowed: true,
    runnerConfigured: true,
    ticketPresent: true,
    banned: false,
    ...overrides
  })
}

test('accepts an active owner with a permitted origin and an issued ticket', () => {
  assert.equal(request(), true)
})

test('rejects banned and locally revoked terminal owners', () => {
  assert.equal(request({ banned: true }), false)
  assert.equal(request({ owner: { userId: 'user-1', expiresAt: 10_000, revoked: true } }), false)
})

test('rejects missing owners, expired records, untrusted origins and missing runner or ticket', () => {
  assert.equal(request({ owner: null }), false)
  assert.equal(request({ owner: { userId: 'user-1', expiresAt: 1000 } }), false)
  assert.equal(request({ originAllowed: false }), false)
  assert.equal(request({ runnerConfigured: false }), false)
  assert.equal(request({ ticketPresent: false }), false)
})
