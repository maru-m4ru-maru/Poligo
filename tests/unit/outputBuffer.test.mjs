import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendUtf8Tail,
  keepUtf8Tail
} from '../../services/runner/src/outputBuffer.js'

test('keeps output within a UTF-8 byte limit without splitting multi-byte characters', () => {
  const value = 'ab日本語'
  const result = keepUtf8Tail(value, 8)

  assert.equal(result, '本語')
  assert.ok(Buffer.byteLength(result, 'utf8') <= 8)
})

test('keeps the newest bytes from output and safely handles zero and empty limits', () => {
  assert.equal(keepUtf8Tail('abcdef', 3), 'def')
  assert.equal(keepUtf8Tail('abcdef', 0), '')
  assert.equal(keepUtf8Tail('', 10), '')
})

test('appends stream chunks while keeping a valid UTF-8 tail', () => {
  const first = appendUtf8Tail('', 'output-日本', 9)
  const result = appendUtf8Tail(first, '語xyz', 9)

  assert.ok(Buffer.byteLength(result, 'utf8') <= 9)
  assert.equal(Buffer.from(result).toString('utf8'), result)
})

test('rejects invalid output limits', () => {
  assert.throws(() => keepUtf8Tail('data', -1), /non-negative/)
  assert.throws(() => keepUtf8Tail('data', 1.5), /non-negative/)
})
