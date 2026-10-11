import assert from 'node:assert/strict'
import test from 'node:test'
import { isWorkspaceClaimAllowed } from '../../services/api/src/workspacePolicy.js'

test('keeps a user's existing account workspace attached to that same user', () => {
  assert.equal(isWorkspaceClaimAllowed('user-123456789012', 'user-123456789012', true), true)
})

test('allows importing an unregistered legacy workspace', () => {
  assert.equal(isWorkspaceClaimAllowed('workspace-123456789', 'user-1234567890', false), true)
})

test('denies taking over a workspace whose ID belongs to another registered account', () => {
  assert.equal(isWorkspaceClaimAllowed('victim-user-123456', 'attacker-user-123', true), false)
})

test('denies claims without a valid workspace ID or authenticated user ID', () => {
  assert.equal(isWorkspaceClaimAllowed('', 'user-1234567890', false), false)
  assert.equal(isWorkspaceClaimAllowed('workspace-123456', '', false), false)
  assert.equal(isWorkspaceClaimAllowed(null, 'user-1234567890', false), false)
})
