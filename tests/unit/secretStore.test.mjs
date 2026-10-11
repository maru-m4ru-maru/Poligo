import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = 'ab'.repeat(32)

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  isEncryptedSecret
} = await import('../../services/api/src/secretStore.js')

test('encrypts and decrypts secrets with authenticated encryption', () => {
  const value = 'API_TOKEN=not-a-real-token'
  const encrypted = encryptSecret(value)

  assert.notEqual(encrypted, value)
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), value)
  assert.equal(encryptSecret(encrypted), encrypted)
})

test('a plaintext value that resembles an encrypted marker is still encrypted', () => {
  for (const value of [
    'poligo:v1:not-a-ciphertext',
    'poligo:v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA:fake',
    'poligo:v1:looks-like-a-secret'
  ]) {
    const encrypted = encryptSecret(value)

    assert.notEqual(encrypted, value)
    assert.equal(isEncryptedSecret(encrypted), true)
    assert.equal(decryptSecret(encrypted), value)
    assert.equal(isEncryptedSecret(value), false)
  }
})

test('only environment secret files are encrypted in project payloads', () => {
  const files = {
    '.env': 'TOKEN=secret',
    '.env.production': 'TOKEN=production-secret',
    'config/.env.staging': 'TOKEN=staging-secret',
    '.env.example': 'TOKEN=replace-me',
    'main.js': 'console.log("hello")'
  }

  const encrypted = encryptProjectSecrets(files)

  assert.equal(isEncryptedSecret(encrypted['.env']), true)
  assert.equal(isEncryptedSecret(encrypted['.env.production']), true)
  assert.equal(isEncryptedSecret(encrypted['config/.env.staging']), true)
  assert.equal(encrypted['.env.example'], files['.env.example'])
  assert.equal(encrypted['main.js'], files['main.js'])
  assert.deepEqual(decryptProjectSecrets(encrypted), files)
})
