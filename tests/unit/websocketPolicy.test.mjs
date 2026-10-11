import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canQueueTerminalMessage,
  canSendTerminalMessage,
  parseTerminalWebSocketMessage,
  TERMINAL_WS_MAX_BUFFERED_BYTES,
  TERMINAL_WS_MAX_INPUT_BYTES,
  TERMINAL_WS_MAX_MESSAGE_BYTES,
  TERMINAL_WS_MAX_QUEUED_MESSAGES
} from '../../services/api/src/websocketPolicy.js'

test('accepts bounded terminal input, valid resize and keepalive messages', () => {
  assert.deepEqual(parseTerminalWebSocketMessage(
    JSON.stringify({ type: 'input', data: 'echo ok\n' })
  ), { type: 'input', data: 'echo ok\n' })
  assert.deepEqual(parseTerminalWebSocketMessage(
    JSON.stringify({ type: 'resize', cols: 80, rows: 24 })
  ), { type: 'resize', cols: 80, rows: 24 })
  assert.deepEqual(parseTerminalWebSocketMessage(
    JSON.stringify({ type: 'ping' })
  ), { type: 'ping' })
})

test('rejects large messages, oversized input, invalid JSON and unsupported message types', () => {
  assert.equal(parseTerminalWebSocketMessage('x'.repeat(TERMINAL_WS_MAX_MESSAGE_BYTES + 1)), null)
  assert.equal(parseTerminalWebSocketMessage(JSON.stringify({
    type: 'input',
    data: 'x'.repeat(TERMINAL_WS_MAX_INPUT_BYTES + 1)
  })), null)
  assert.equal(parseTerminalWebSocketMessage('{broken'), null)
  assert.equal(parseTerminalWebSocketMessage(JSON.stringify({ type: 'input', data: 4 })), null)
  assert.equal(parseTerminalWebSocketMessage(JSON.stringify({ type: 'run-shell', command: 'id' })), null)
  assert.equal(parseTerminalWebSocketMessage(JSON.stringify({ type: 'resize', cols: 0, rows: 2000 })), null)
})

test('bounds queued WebSocket messages by count and combined byte size', () => {
  assert.equal(canQueueTerminalMessage({ messageBytes: 100, queuedBytes: 200, queuedMessages: 2 }), true)
  assert.equal(canQueueTerminalMessage({ messageBytes: TERMINAL_WS_MAX_BUFFERED_BYTES, queuedBytes: 1, queuedMessages: 0 }), false)
  assert.equal(canQueueTerminalMessage({ messageBytes: 0, queuedBytes: 0, queuedMessages: TERMINAL_WS_MAX_QUEUED_MESSAGES }), false)
  assert.equal(canQueueTerminalMessage({ messageBytes: -1, queuedBytes: 0, queuedMessages: 0 }), false)
  assert.equal(TERMINAL_WS_MAX_BUFFERED_BYTES, 1_048_576)
})

test('bounds bytes buffered to slow WebSocket peers', () => {
  assert.equal(canSendTerminalMessage(0, TERMINAL_WS_MAX_BUFFERED_BYTES), true)
  assert.equal(canSendTerminalMessage(1, TERMINAL_WS_MAX_BUFFERED_BYTES), false)
  assert.equal(canSendTerminalMessage(-1, 10), false)
})
