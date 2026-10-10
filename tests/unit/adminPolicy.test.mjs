import assert from 'node:assert/strict'
import test from 'node:test'
import { isConfiguredAdmin } from '../../services/api/src/adminPolicy.js'

const adminUserIds = new Set(['fixed-user-id'])
const adminEmails = new Set(['admin@example.com'])

test('configured user IDs grant admin access without relying on email verification', () => {
  assert.equal(
    isConfiguredAdmin({
      id: 'fixed-user-id',
      email: 'admin@example.com',
      emailVerified: false
    }, adminUserIds, adminEmails),
    true
  )
})

test('configured emails grant admin access only when verified', () => {
  assert.equal(
    isConfiguredAdmin({
      id: 'email-user',
      email: 'admin@example.com',
      emailVerified: true
    }, adminUserIds, adminEmails),
    true
  )
  assert.equal(
    isConfiguredAdmin({
      id: 'email-user',
      email: 'admin@example.com',
      emailVerified: false
    }, adminUserIds, adminEmails),
    false
  )
  assert.equal(
    isConfiguredAdmin({
      id: 'email-user',
      email: 'admin@example.com',
      emailVerified: 0
    }, adminUserIds, adminEmails),
    false
  )
  assert.equal(
    isConfiguredAdmin({
      id: 'email-user',
      email: 'admin@example.com',
      emailVerified: 1
    }, adminUserIds, adminEmails),
    true
  )
})

test('configured email matching is case-insensitive but still requires verification', () => {
  assert.equal(
    isConfiguredAdmin({
      id: 'email-user',
      email: ' ADMIN@EXAMPLE.COM ',
      emailVerified: true
    }, adminUserIds, adminEmails),
    true
  )
})

test('missing IDs and unrelated emails do not grant admin access', () => {
  assert.equal(
    isConfiguredAdmin({
      email: 'admin@example.com',
      emailVerified: true
    }, adminUserIds, adminEmails),
    false
  )
  assert.equal(
    isConfiguredAdmin({
      id: 'normal-user',
      email: 'normal@example.com',
      emailVerified: true
    }, adminUserIds, adminEmails),
    false
  )
})
