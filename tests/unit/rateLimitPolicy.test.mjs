import assert from 'node:assert/strict'
import test from 'node:test'
import {
  consumeUserQuota,
  pruneUserQuotaState
} from '../../services/api/src/rateLimitPolicy.js'

test('allows up to the configured per-user quota', () => {
  const state = new Map()

  assert.equal(consumeUserQuota(state, 'alice', 1_000, 300_000, 2), 0)
  assert.equal(consumeUserQuota(state, 'alice', 2_000, 300_000, 2), 0)
  assert.equal(state.get('alice').length, 2)
})

test('blocks the next request and returns a positive Retry-After value', () => {
  const state = new Map()

  assert.equal(consumeUserQuota(state, 'alice', 1_000, 300_000, 1), 0)
  assert.equal(consumeUserQuota(state, 'alice', 2_000, 300_000, 1), 299)
  assert.equal(state.get('alice').length, 1)
})

test('quotas are isolated per user and expired events are pruned', () => {
  const state = new Map()

  assert.equal(consumeUserQuota(state, 'alice', 1_000, 10_000, 1), 0)
  assert.equal(consumeUserQuota(state, 'bob', 1_000, 10_000, 1), 0)
  assert.equal(consumeUserQuota(state, 'alice', 2_000, 10_000, 1), 9)

  assert.equal(consumeUserQuota(state, 'alice', 11_000, 10_000, 1), 0)
  pruneUserQuotaState(state, 11_000, 10_000)
  assert.deepEqual(state.get('alice'), [11_000])
  assert.equal(state.has('bob'), false)
})

test('rejects malformed quota configuration instead of failing open', () => {
  assert.throws(() => consumeUserQuota(null, 'alice', 1, 100, 1), /invalid user quota/)
  assert.throws(() => consumeUserQuota(new Map(), '', 1, 100, 1), /invalid user quota/)
  assert.throws(() => consumeUserQuota(new Map(), 'alice', 1, 0, 1), /invalid user quota/)
  assert.throws(() => consumeUserQuota(new Map(), 'alice', 1, 100, 0), /invalid user quota/)
  assert.throws(() => pruneUserQuotaState(new Map(), 1, 0), /invalid user quota cleanup/)
})
