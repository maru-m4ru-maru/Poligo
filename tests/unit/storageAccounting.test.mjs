import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateStorageBytes } from '../../services/api/src/storageAccounting.js'

test('adds current project files and source history toward the same account quota', () => {
  assert.equal(calculateStorageBytes(100, 50), 150)
  assert.equal(calculateStorageBytes(0, 0), 0)
  assert.equal(calculateStorageBytes('100', '50'), 150)
})

test('rejects invalid or unsafe byte totals', () => {
  for (const values of [
    [-1, 0],
    [0, -1],
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
    [1.5, 1],
    [Number.MAX_SAFE_INTEGER, 1]
  ]) {
    assert.throws(() => calculateStorageBytes(...values), /storage byte count/)
  }
})
