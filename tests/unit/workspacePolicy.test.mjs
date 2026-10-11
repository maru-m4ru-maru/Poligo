import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedWorkspaceId } from '../../services/api/src/workspacePolicy.js'

test('accepts the current user id for their own account workspace', () => {
  assert.equal(isAllowedWorkspaceId('user-id-0123456789', 'user-id-0123456789'), true)
})

test('accepts randomUUID workspace ids and generated fallback workspace ids', () => {
  assert.equal(
    isAllowedWorkspaceId('6df80f7f-9be7-41a9-9a87-99beab73f1c7', 'account-1'),
    true
  )
  assert.equal(
    isAllowedWorkspaceId('workspace-m5abc123-abcdefgh', 'account-1'),
    true
  )
})

test('rejects arbitrary owner ids that are not legacy workspace tokens', () => {
  assert.equal(isAllowedWorkspaceId('another-account-id-012345', 'current-user'), false)
  assert.equal(isAllowedWorkspaceId('victim-account-1234567890', 'current-user'), false)
  assert.equal(isAllowedWorkspaceId('', 'current-user'), false)
  assert.equal(isAllowedWorkspaceId(null, 'current-user'), false)
})

test('never treats a value that belongs to a different account as a workspace token', () => {
  const accountId = '3df80f7f-9be7-41a9-9a87-99beab73f1c7'

  assert.equal(isAllowedWorkspaceId(accountId, 'current-user', [accountId]), false)
})

test('allows an authenticated account to keep using its own id when it is in the account list', () => {
  const accountId = '3df80f7f-9be7-41a9-9a87-99beab73f1c7'

  assert.equal(isAllowedWorkspaceId(accountId, accountId, [accountId]), true)
})
