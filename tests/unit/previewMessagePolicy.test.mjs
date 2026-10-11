import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedPreviewMessage } from '../../apps/web/src/previewMessagePolicy.js'

const previewWindow = {}

function event(source, data) {
  return { source, data }
}

test('accepts an error message from the active preview frame', () => {
  assert.equal(isTrustedPreviewMessage(event(previewWindow, {
    source: 'poligo-preview',
    type: 'error',
    message: 'TypeError',
    stack: 'at app.js:1'
  }), previewWindow), true)
})

test('rejects messages from another window or a missing preview frame', () => {
  assert.equal(isTrustedPreviewMessage(event({}, {
    source: 'poligo-preview',
    type: 'error',
    message: 'forged'
  }), previewWindow), false)
  assert.equal(isTrustedPreviewMessage(event(previewWindow, {
    source: 'poligo-preview',
    type: 'error',
    message: 'no target'
  }), null), false)
})

test('rejects malformed messages and unrecognized event types', () => {
  for (const data of [
    null,
    [],
    'poligo-preview',
    { source: 'other', type: 'error', message: 'no' },
    { source: 'poligo-preview', type: 'message', message: 'no' },
    { source: 'poligo-preview', type: 'error', message: 123 },
    { source: 'poligo-preview', type: 'error' },
    { source: 'poligo-preview', type: 'error', message: 'ok', stack: 123 }
  ]) {
    assert.equal(isTrustedPreviewMessage(event(previewWindow, data), previewWindow), false)
  }
})

test('rejects oversized preview errors to prevent UI and memory abuse', () => {
  assert.equal(isTrustedPreviewMessage(event(previewWindow, {
    source: 'poligo-preview',
    type: 'error',
    message: 'x'.repeat(4097)
  }), previewWindow), false)
  assert.equal(isTrustedPreviewMessage(event(previewWindow, {
    source: 'poligo-preview',
    type: 'error',
    message: 'error',
    stack: 'x'.repeat(20_001)
  }), previewWindow), false)
})
