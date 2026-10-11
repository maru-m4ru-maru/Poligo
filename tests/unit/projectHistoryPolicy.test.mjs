import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canCreateProjectCommit,
  MAX_PROJECT_COMMITS
} from '../../services/api/src/projectHistoryPolicy.js'

test('allows commit creation until the configured limit', () => {
  assert.equal(canCreateProjectCommit(0), true)
  assert.equal(canCreateProjectCommit(MAX_PROJECT_COMMITS - 1), true)
  assert.equal(canCreateProjectCommit(MAX_PROJECT_COMMITS), false)
})

test('rejects invalid commit counters instead of accidentally granting capacity', () => {
  for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null]) {
    assert.equal(canCreateProjectCommit(value), false)
  }
})
