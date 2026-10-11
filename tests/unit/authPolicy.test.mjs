import assert from 'node:assert/strict'
import test from 'node:test'
import { getOriginPolicy, getTrustedOrigins, selectCorsOrigin } from '../../services/api/src/authPolicy.js'

test('production trusts only explicitly configured HTTP origins', () => {
  assert.deepEqual(
    getTrustedOrigins('https://poligo.example', 'production'),
    ['https://poligo.example']
  )
})

test('development includes localhost origins for the local IDE', () => {
  assert.deepEqual(
    getTrustedOrigins('http://localhost:5173', 'development'),
    ['http://localhost:5173', 'http://127.0.0.1:5173']
  )
})

test('filters wildcard, malformed origins and non-HTTP schemes', () => {
  assert.deepEqual(
    getTrustedOrigins('*,javascript:alert(1),not a URL,https://poligo.example/path', 'production'),
    []
  )
})

test('deduplicates configured origins and strips no unexpected path', () => {
  assert.deepEqual(
    getTrustedOrigins('https://poligo.example,https://poligo.example', 'production'),
    ['https://poligo.example']
  )
  assert.deepEqual(
    getTrustedOrigins('https://poligo.example/', 'production'),
    []
  )
})

test('uses a safe single production origin when configured origin is missing or wildcard', () => {
  assert.deepEqual(
    getOriginPolicy('', 'production'),
    {
      allowedOrigins: ['https://poligo-web-2n2l.onrender.com'],
      corsOrigin: 'https://poligo-web-2n2l.onrender.com'
    }
  )
  assert.deepEqual(
    getOriginPolicy('*', 'production'),
    {
      allowedOrigins: ['https://poligo-web-2n2l.onrender.com'],
      corsOrigin: 'https://poligo-web-2n2l.onrender.com'
    }
  )
})

test('supports an explicit allowlist while keeping CORS header value singular', () => {
  assert.deepEqual(
    getOriginPolicy('https://poligo.example,https://preview.poligo.example', 'production'),
    {
      allowedOrigins: ['https://poligo.example', 'https://preview.poligo.example'],
      corsOrigin: 'https://poligo.example'
    }
  )
})

test('selects each explicitly allowed request origin for CORS responses', () => {
  const allowed = [
    'https://poligo.example',
    'https://preview.poligo.example'
  ]

  assert.equal(
    selectCorsOrigin('https://poligo.example', allowed, allowed[0]),
    allowed[0]
  )
  assert.equal(
    selectCorsOrigin('https://preview.poligo.example', allowed, allowed[0]),
    allowed[1]
  )
})

test('uses a safe fallback origin for missing or untrusted CORS origins', () => {
  const allowed = ['https://poligo.example']

  assert.equal(selectCorsOrigin('', allowed, allowed[0]), allowed[0])
  assert.equal(selectCorsOrigin('https://attacker.example', allowed, allowed[0]), allowed[0])
  assert.equal(selectCorsOrigin('null', allowed, allowed[0]), allowed[0])
})
