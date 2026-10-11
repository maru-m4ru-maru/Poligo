import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedPreviewMessage } from '../../apps/web/src/previewMessagePolicy.js'

const expectedWindow = {}
const otherWindow = {}

test('accepts runtime diagnostics only from the active preview frame', () => {
  assert.equal(isTrustedPreviewMessage({
    source: expectedWindow,
    data: {
      source: 'poligo-preview',
      message: 'runtime error'
    }
  }, expectedWindow), true)
})

test('rejects diagnostics spoofed by another window or malformed message', () => {
  for (const event of [
    { source: otherWindow, data: { source: 'poligo-preview' } },
    { source: expectedWindow, data: { source: 'other' } },
    { source: expectedWindow, data: null },
    null
  ]) {
    assert.equal(isTrustedPreviewMessage(event, expectedWindow), false)
  }

  assert.equal(isTrustedPreviewMessage({
    source: expectedWindow,
    data: { source: 'poligo-preview' }
  }, null), false)
})
