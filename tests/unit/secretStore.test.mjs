import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = 'ab'.repeat(32)

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  hasEncryptedSecretEnvelope,
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

test('malformed marker-like plaintext is encrypted as ordinary text', () => {
  for (const value of [
    'poligo:v1:not-a-ciphertext',
    'poligo:v1:looks-like-a-secret'
  ]) {
    const encrypted = encryptSecret(value)

    assert.notEqual(encrypted, value)
    assert.equal(isEncryptedSecret(encrypted), true)
    assert.equal(decryptSecret(encrypted), value)
    assert.equal(isEncryptedSecret(value), false)
    assert.equal(hasEncryptedSecretEnvelope(value), false)
  }
})

test('ciphertext-shaped values with invalid authentication are rejected', () => {
  const value = 'poligo:v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA:fake'

  assert.equal(hasEncryptedSecretEnvelope(value), true)
  assert.equal(isEncryptedSecret(value), false)
  assert.throws(
    () => decryptSecret(value),
    /authenticate|authentication|Unsupported state/
  )
  assert.throws(
    () => encryptSecret(value),
    /could not be authenticated/
  )
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
