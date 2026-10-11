import assert from 'node:assert/strict'
import test from 'node:test'

process.env.POLIGO_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const {
  decryptProjectSecrets,
  decryptSecret,
  encryptProjectSecrets,
  encryptSecret,
  hasEncryptedSecretEnvelope,
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
  const parts = encrypted.split(':')
  parts[3] = (parts[3][0] === 'a' ? 'b' : 'a') + parts[3].slice(1)
  const tampered = parts.join(':')

  assert.equal(isEncryptedSecret(tampered), false)
  assert.throws(() => decryptSecret(tampered), /invalid encrypted secret/)
})

test('does not treat a malformed prefix as valid ciphertext', () => {
  assert.equal(isEncryptedSecret('poligo:v1:not-an-envelope'), false)
})

test('does not re-encrypt authenticated-envelope data when the encryption key is wrong', async () => {
  const originalKey = process.env.POLIGO_ENCRYPTION_KEY
  const encrypted = encryptSecret('API_PASSWORD=preserve-me')
  const parts = encrypted.split(':')
  const markerLikePlaintext = 'poligo:v1:not-an-envelope'

  assert.equal(hasEncryptedSecretEnvelope(encrypted), true)
  assert.equal(encryptSecret(encrypted), encrypted)
  assert.equal(hasEncryptedSecretEnvelope(markerLikePlaintext), false)
  assert.equal(decryptSecret(markerLikePlaintext), markerLikePlaintext)

  try {
    process.env.POLIGO_ENCRYPTION_KEY = 'ab'.repeat(32)
    const wrongKeyModule = await import('../../services/api/src/secretStore.js?wrong-key-test')

    assert.equal(wrongKeyModule.isEncryptedSecret(encrypted), false)
    assert.throws(
      () => wrongKeyModule.encryptSecret(encrypted),
      /could not be authenticated/
    )
    assert.throws(
      () => wrongKeyModule.decryptSecret(encrypted),
      /authentication|Unsupported state|authenticate/i
    )

    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)
    const tampered = parts.join(':')
    assert.equal(wrongKeyModule.hasEncryptedSecretEnvelope(tampered), true)
    assert.equal(wrongKeyModule.isEncryptedSecret(tampered), false)
    assert.throws(
      () => wrongKeyModule.encryptSecret(tampered),
      /could not be authenticated/
    )
  } finally {
    process.env.POLIGO_ENCRYPTION_KEY = originalKey
  }
})

test('encrypted project secret helpers reject invalid authenticated envelopes', () => {
  const encrypted = encryptSecret('TOKEN=keep-safe')
  const parts = encrypted.split(':')
  parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)

  assert.throws(
    () => encryptProjectSecrets({ '.env': parts.join(':') }),
    /could not be authenticated/
  )
  assert.throws(
    () => decryptProjectSecrets({ '.env': parts.join(':') }),
    /Unsupported state|authentication|authenticate/i
  )
})
