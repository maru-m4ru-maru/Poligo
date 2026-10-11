import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_TERMINAL_BRIDGE_BUFFER_BYTES,
  MAX_TERMINAL_BRIDGE_QUEUE_MESSAGES,
  canQueueTerminalBridgeMessage,
  shouldCloseTerminalBridgeSocket
} from '../../services/api/src/terminalBridgePolicy.js'

test('queues messages while both count and byte budgets remain available', () => {
  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: 0,
    queuedBytes: 0,
    messageBytes: 20
  }), true)

  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: MAX_TERMINAL_BRIDGE_QUEUE_MESSAGES - 1,
    queuedBytes: 0,
    messageBytes: 1
  }), true)

  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: 0,
    queuedBytes: MAX_TERMINAL_BRIDGE_BUFFER_BYTES - 10,
    messageBytes: 10
  }), true)
})

test('rejects queue additions that would exceed message count or byte budgets', () => {
  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: MAX_TERMINAL_BRIDGE_QUEUE_MESSAGES,
    queuedBytes: 0,
    messageBytes: 1
  }), false)

  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: 0,
    queuedBytes: MAX_TERMINAL_BRIDGE_BUFFER_BYTES,
    messageBytes: 1
  }), false)

  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: 0,
    queuedBytes: 0,
    messageBytes: MAX_TERMINAL_BRIDGE_BUFFER_BYTES + 1
  }), false)
})

test('rejects malformed queue measurements and enforces bridge socket backpressure', () => {
  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: -1,
    queuedBytes: 0,
    messageBytes: 1
  }), false)

  assert.equal(canQueueTerminalBridgeMessage({
    queuedMessages: 0,
    queuedBytes: Number.NaN,
    messageBytes: 1
  }), false)

  assert.equal(shouldCloseTerminalBridgeSocket(0), false)
  assert.equal(shouldCloseTerminalBridgeSocket(MAX_TERMINAL_BRIDGE_BUFFER_BYTES - 1), false)
  assert.equal(shouldCloseTerminalBridgeSocket(MAX_TERMINAL_BRIDGE_BUFFER_BYTES), true)
  assert.equal(shouldCloseTerminalBridgeSocket(Number.NaN), true)
})
