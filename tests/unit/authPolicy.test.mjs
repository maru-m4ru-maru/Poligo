import assert from 'node:assert/strict'
import test from 'node:test'
import { getTrustedOrigins } from '../../services/api/src/authPolicy.js'

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
