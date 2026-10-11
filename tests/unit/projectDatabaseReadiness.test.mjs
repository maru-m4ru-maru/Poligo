import assert from 'node:assert/strict'
import test from 'node:test'
import { requiresProjectDatabase } from '../../services/api/src/projectDatabaseReadiness.js'

test('requires project database readiness for dashboard and project operations', () => {
  assert.equal(requiresProjectDatabase('GET', '/api/dashboard'), true)
  assert.equal(requiresProjectDatabase('GET', '/api/projects'), true)
  assert.equal(requiresProjectDatabase('POST', '/api/projects'), true)
  assert.equal(requiresProjectDatabase('PUT', '/api/projects/abc'), true)
  assert.equal(requiresProjectDatabase('DELETE', '/api/projects/abc'), true)
  assert.equal(requiresProjectDatabase('GET', '/api/projects/abc/commits'), true)
})

test('requires project database readiness for terminal lifecycle and execution creation', () => {
  assert.equal(requiresProjectDatabase('POST', '/api/workspace/claim'), true)
  assert.equal(requiresProjectDatabase('POST', '/api/terminal/sessions'), true)
  assert.equal(requiresProjectDatabase('POST', '/api/terminal/sessions/id/reconnect'), true)
  assert.equal(requiresProjectDatabase('POST', '/api/terminal/sessions/id/sync'), true)
  assert.equal(requiresProjectDatabase('DELETE', '/api/terminal/sessions/id'), true)
  assert.equal(requiresProjectDatabase('POST', '/api/executions'), true)
})

test('keeps auth, health, announcements, AI, and existing execution-status reads available', () => {
  assert.equal(requiresProjectDatabase('GET', '/api/health'), false)
  assert.equal(requiresProjectDatabase('POST', '/api/auth/sign-in/email'), false)
  assert.equal(requiresProjectDatabase('GET', '/api/announcements'), false)
  assert.equal(requiresProjectDatabase('POST', '/api/ai/assist'), false)
  assert.equal(requiresProjectDatabase('GET', '/api/executions/id'), false)
})

test('does not match unrelated routes or accept malformed path inputs', () => {
  assert.equal(requiresProjectDatabase('GET', '/api/project-settings'), false)
  assert.equal(requiresProjectDatabase('GET', '/api/projects-extra'), false)
  assert.equal(requiresProjectDatabase('OPTIONS', '/api/projects'), true)
  assert.equal(requiresProjectDatabase(null, '/api/projects'), false)
  assert.equal(requiresProjectDatabase('GET', null), false)
})
