import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isProductionEnvironment,
  resolveAllowedOrigin,
  resolveTrustedOrigins
} from '../../services/api/src/originPolicy.js'

test('production auth origins use the configured web origin without trusting localhost', () => {
  const environment = {
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://poligo.example.com'
  }

  assert.equal(isProductionEnvironment(environment), true)
  assert.equal(resolveAllowedOrigin(environment), 'https://poligo.example.com')
  assert.deepEqual(resolveTrustedOrigins(environment), ['https://poligo.example.com'])
})

test('Render is treated as production even if NODE_ENV is omitted', () => {
  const environment = { RENDER_SERVICE_ID: 'srv-example' }

  assert.equal(isProductionEnvironment(environment), true)
  assert.equal(resolveAllowedOrigin(environment), 'https://poligo-web-2n2l.onrender.com')
  assert.deepEqual(resolveTrustedOrigins(environment), ['https://poligo-web-2n2l.onrender.com'])
})

test('wildcard, comma-separated and malformed CORS settings fall back safely', () => {
  for (const CORS_ORIGIN of [
    '*',
    'https://one.example.com,https://two.example.com',
    'javascript:alert(1)',
    'https://example.com/path'
  ]) {
    assert.equal(
      resolveAllowedOrigin({ NODE_ENV: 'production', CORS_ORIGIN }),
      'https://poligo-web-2n2l.onrender.com'
    )
  }
})

test('development retains localhost origins while preserving a configured origin', () => {
  const environment = {
    NODE_ENV: 'development',
    CORS_ORIGIN: 'http://localhost:5174'
  }

  assert.equal(resolveAllowedOrigin(environment), 'http://localhost:5174')
  assert.deepEqual(resolveTrustedOrigins(environment), [
    'http://localhost:5174',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ])
})
