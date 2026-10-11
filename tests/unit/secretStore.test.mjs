import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = 'a5'.repeat(32)

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  isEncryptedSecret
} = await import('../../services/api/src/secretStore.js')

test('encrypts secrets with authenticated encryption and restores original UTF-8 text', () => {
  const value = 'API_KEY=secret-value\nUNICODE=日本語🔐\n'
  const encrypted = encryptSecret(value)

  assert.notEqual(encrypted, value)
  assert.doesNotMatch(encrypted, /secret-value/)
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), value)
  assert.equal(decryptSecret(value), value)
  assert.equal(encryptSecret(encrypted), encrypted)
})

test('uses a fresh nonce for each new encryption', () => {
  const first = encryptSecret('same')
  const second = encryptSecret('same')

  assert.notEqual(first, second)
  assert.equal(decryptSecret(first), 'same')
  assert.equal(decryptSecret(second), 'same')
})

test('rejects tampering and malformed encrypted metadata', () => {
  const encrypted = encryptSecret('secret')
  const parts = encrypted.split(':')
  parts[3] = 'A'.repeat(22)

  assert.throws(() => decryptSecret(parts.join(':')))
  assert.throws(() => decryptSecret('poligo:v1:not-base64:bad:broken'), /invalid encrypted secret metadata/)
})

test('encrypts nested environment files but leaves example and ordinary files unchanged', () => {
  const files = {
    '.env': 'TOP_SECRET=one',
    '.env.production': 'TOP_SECRET=two',
    '.env.example': 'API_KEY=',
    'src/.env.local': 'TOP_SECRET=three',
    'src/main.js': 'console.log("ordinary")'
  }
  const encrypted = encryptProjectSecrets(files)

  assert.equal(isEncryptedSecret(encrypted['.env']), true)
  assert.equal(isEncryptedSecret(encrypted['.env.production']), true)
  assert.equal(isEncryptedSecret(encrypted['src/.env.local']), true)
  assert.equal(encrypted['.env.example'], files['.env.example'])
  assert.equal(encrypted['src/main.js'], files['src/main.js'])
  assert.deepEqual(decryptProjectSecrets(encrypted), files)
})

test('rejects non-text secrets and malformed encryption keys', async () => {
  assert.throws(() => encryptSecret(null), /secret content must be text/)
  assert.throws(() => decryptSecret(null), /secret content must be text/)

  process.env.POLIGO_ENCRYPTION_KEY = 'not-a-key'
  const invalidKeyModule = await import(
    '../../services/api/src/secretStore.js?invalid-key-test'
  )
  assert.throws(
    () => invalidKeyModule.encryptSecret('secret'),
    /POLIGO_ENCRYPTION_KEY must be a 32-byte hex key/
  )
})
