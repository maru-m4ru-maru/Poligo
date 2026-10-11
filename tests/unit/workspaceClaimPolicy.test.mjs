import assert from 'node:assert/strict'
import test from 'node:test'
import { getWorkspaceClaimDecision } from '../../services/api/src/workspaceClaimPolicy.js'

test('does not move projects when the workspace already belongs to the current account', () => {
  assert.equal(
    getWorkspaceClaimDecision('user-a', 'user-a', true),
    'same-account'
  )
})

test('rejects claiming the workspace identifier of another registered account', () => {
  assert.equal(
    getWorkspaceClaimDecision('victim-user-id', 'attacker-user-id', true),
    'owned-by-another-account'
  )
})

test('permits migration only for workspace IDs that are not registered account IDs', () => {
  assert.equal(
    getWorkspaceClaimDecision('legacy-workspace-identifier', 'user-a', false),
    'legacy-workspace'
  )
})

test('rejects missing workspace or session identities', () => {
  assert.equal(getWorkspaceClaimDecision('', 'user-a', false), 'invalid')
  assert.equal(getWorkspaceClaimDecision('workspace-id', '', false), 'invalid')
  assert.equal(getWorkspaceClaimDecision(null, 'user-a', false), 'invalid')
})
