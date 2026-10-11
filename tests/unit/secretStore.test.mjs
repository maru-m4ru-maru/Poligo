import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  isEncryptedSecret
} = await import('../../services/api/src/secretStore.js')

test('encrypts and decrypts plain secret content', () => {
  const plaintext = 'API_KEY=secret-value\n'
  const encrypted = encryptSecret(plaintext)

  assert.notEqual(encrypted, plaintext)
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), plaintext)
})

test('plaintext that imitates the version prefix is encrypted instead of bypassing storage encryption', () => {
  const plaintext = 'poligo:v1:this-is-user-content'
  const encrypted = encryptSecret(plaintext)

  assert.notEqual(encrypted, plaintext)
  assert.equal(isEncryptedSecret(plaintext), false)
  assert.equal(isEncryptedSecret(encrypted), true)
  assert.equal(decryptSecret(encrypted), plaintext)
})

test('encrypted project secrets round-trip while example env files remain readable', () => {
  const files = {
    '.env': 'SECRET=1',
    'nested/.env.production': 'PASSWORD=two',
    '.env.example': 'API_KEY=replace-me',
    'src/main.js': 'console.log("ok")'
  }
  const encrypted = encryptProjectSecrets(files)

  assert.equal(isEncryptedSecret(encrypted['.env']), true)
  assert.equal(isEncryptedSecret(encrypted['nested/.env.production']), true)
  assert.equal(encrypted['.env.example'], files['.env.example'])
  assert.deepEqual(decryptProjectSecrets(encrypted), files)
})

test('rejects ciphertext that is modified or uses an invalid authentication tag', () => {
  const encrypted = encryptSecret('TOKEN=valid')
  const tampered = encrypted.slice(0, -1) + (encrypted.endsWith('a') ? 'b' : 'a')

  assert.equal(isEncryptedSecret(tampered), false)
  assert.throws(() => decryptSecret(tampered), /invalid encrypted secret/)
})

test('does not treat a malformed prefix as valid ciphertext', () => {
  assert.equal(isEncryptedSecret('poligo:v1:not-an-envelope'), false)
})
