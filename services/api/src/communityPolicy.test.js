import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectLanguage,
  isSecretPath,
  normalizeCommunityVisibility,
  parseCommunityFeedLimit
} from './communityPolicy.js'

test('secret environment files are recognized in nested and mixed-case paths', () => {
  assert.equal(isSecretPath('.env'), true)
  assert.equal(isSecretPath('config/.env.production'), true)
  assert.equal(isSecretPath('config\\.ENV.local'), true)
  assert.equal(isSecretPath('.env.example'), false)
  assert.equal(isSecretPath('src/main.py'), false)
})

test('language detection identifies common project languages', () => {
  assert.equal(detectLanguage({ 'main.py': 'print(1)' }), 'Python')
  assert.equal(detectLanguage({ 'src/app.tsx': 'export {}' }), 'TypeScript')
  assert.equal(detectLanguage({ 'Main.kt': 'fun main() {}' }), 'Kotlin')
  assert.equal(detectLanguage({ 'index.html': '<main />' }), 'HTML/CSS')
  assert.equal(detectLanguage({ 'README.md': 'project' }), 'Other')
})

test('visibility accepts only the explicit public and private values', () => {
  assert.equal(normalizeCommunityVisibility('public'), 'public')
  assert.equal(normalizeCommunityVisibility('private'), 'private')
  assert.equal(normalizeCommunityVisibility('PUBLIC'), '')
  assert.equal(normalizeCommunityVisibility(undefined), '')
})

test('community feed page size is bounded and malformed values fall back safely', () => {
  assert.equal(parseCommunityFeedLimit(undefined), 30)
  assert.equal(parseCommunityFeedLimit(''), 30)
  assert.equal(parseCommunityFeedLimit('10'), 10)
  assert.equal(parseCommunityFeedLimit('3.9'), 3)
  assert.equal(parseCommunityFeedLimit('0'), 1)
  assert.equal(parseCommunityFeedLimit('500'), 50)
  assert.equal(parseCommunityFeedLimit('NaN'), 30)
})
