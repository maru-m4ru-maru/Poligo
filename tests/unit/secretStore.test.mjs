import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = 'a'.repeat(64)

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  isEncryptedSecret
} = await import('../../services/api/src/secretStore.js')

test('encrypts and decrypts secrets with authenticated encryption', () => {
  const encrypted = encryptSecret('API_KEY=secret-value')

  assert.notEqual(encrypted, 'API_KEY=secret-value')
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), 'API_KEY=secret-value')
  assert.equal(encryptSecret(encrypted), encrypted)
})

test('does not mistake attacker-controlled prefix text for ciphertext', () => {
  const plaintext = 'poligo:v1:attacker-controlled-secret'

  assert.equal(isEncryptedSecret(plaintext), false)

  const encrypted = encryptSecret(plaintext)
  assert.notEqual(encrypted, plaintext)
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), plaintext)
})

test('rejects ciphertext tampering and malformed payloads', () => {
  const encrypted = encryptSecret('SECRET=value')
  const parts = encrypted.split(':')
  parts[4] = (parts[4].startsWith('A') ? 'B' : 'A') + parts[4].slice(1)
  const tampered = parts.join(':')

  assert.equal(isEncryptedSecret(tampered), false)
  assert.throws(() => decryptSecret(tampered))
  assert.equal(isEncryptedSecret('poligo:v1:invalid'), false)
  assert.throws(() => decryptSecret('poligo:v1:invalid'))
})

test('encrypts project .env files while leaving examples and ordinary files untouched', () => {
  const files = {
    '.env': 'KEY=top-secret',
    'config/.env.production': 'TOKEN=production',
    '.env.example': 'KEY=replace-me',
    'src/main.js': 'console.log("safe")'
  }
  const encrypted = encryptProjectSecrets(files)

  assert.equal(encrypted['.env'] === files['.env'], false)
  assert.equal(encrypted['config/.env.production'] === files['config/.env.production'], false)
  assert.equal(encrypted['.env.example'], files['.env.example'])
  assert.equal(encrypted['src/main.js'], files['src/main.js'])
  assert.deepEqual(decryptProjectSecrets(encrypted), files)
})

test('rejects non-text secret values', () => {
  assert.throws(() => encryptSecret(123), /must be text/)
  assert.throws(() => decryptSecret(null), /must be text/)
})
