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

test('workspace claims transfer projects and terminal records while revoking old WebSocket tickets', async () => {
  const { buildWorkspaceClaimStatements } = await import('../../services/api/src/workspacePolicy.js')
  const statements = buildWorkspaceClaimStatements('workspace-m5abc123-abcdefgh', 'user-one', 12345)

  assert.equal(statements.length, 2)
  assert.equal(statements[0].sql, 'UPDATE projects SET owner_id = ? WHERE owner_id = ?')
  assert.deepEqual(statements[0].args, ['user-one', 'workspace-m5abc123-abcdefgh'])
  assert.match(statements[1].sql, /UPDATE terminal_sessions/)
  assert.match(statements[1].sql, /websocket_ticket_hash = ''/)
  assert.match(statements[1].sql, /ticket_expires_at = 0/)
  assert.match(statements[1].sql, /ticket_used = 1/)
  assert.deepEqual(statements[1].args, ['user-one', 12345, 'workspace-m5abc123-abcdefgh'])
  assert.throws(() => buildWorkspaceClaimStatements('user-one', 'user-one', 12345), /invalid workspace claim/)
  assert.throws(() => buildWorkspaceClaimStatements('', 'user-one', 12345), /invalid workspace claim/)
})
