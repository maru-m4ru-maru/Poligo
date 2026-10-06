import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'poligo:v1:'
const keyText = process.env.POLIGO_ENCRYPTION_KEY || ''

function getKey() {
  if (!/^[0-9a-fA-F]{64}$/.test(keyText)) {
    throw new Error('POLIGO_ENCRYPTION_KEY must be a 32-byte hex key')
  }

  return Buffer.from(keyText, 'hex')
}

export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptSecret(value) {
  if (typeof value !== 'string') {
    throw new Error('secret content must be text')
  }

  if (isEncryptedSecret(value)) {
    return value
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return [
    PREFIX,
    iv.toString('base64url'),
    ':',
    tag.toString('base64url'),
    ':',
    encrypted.toString('base64url')
  ].join('')
}

export function decryptSecret(value) {
  if (typeof value !== 'string') {
    throw new Error('secret content must be text')
  }

  if (!isEncryptedSecret(value)) {
    return value
  }

  const parts = value.split(':')

  if (parts.length !== 5 || parts[0] !== 'poligo' || parts[1] !== 'v1') {
    throw new Error('invalid encrypted secret format')
  }

  const iv = Buffer.from(parts[2], 'base64url')
  const tag = Buffer.from(parts[3], 'base64url')
  const encrypted = Buffer.from(parts[4], 'base64url')

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('invalid encrypted secret metadata')
  }

  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8')
}

export function encryptProjectSecrets(files) {
  const result = {}

  for (const [path, value] of Object.entries(files)) {
    const name = path.split('/').pop() || path
    const secret =
      name === '.env' ||
      (name.startsWith('.env.') && name !== '.env.example')

    result[path] = secret
      ? encryptSecret(value)
      : value
  }

  return result
}

export function decryptProjectSecrets(files) {
  const result = {}

  for (const [path, value] of Object.entries(files)) {
    const name = path.split('/').pop() || path
    const secret =
      name === '.env' ||
      (name.startsWith('.env.') && name !== '.env.example')

    result[path] = secret
      ? decryptSecret(value)
      : value
  }

  return result
}
