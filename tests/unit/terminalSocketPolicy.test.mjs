import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES,
  shouldDisconnectSlowTerminalSocket
} from '../../services/runner/src/terminalSocketPolicy.js'

test('keeps terminal sockets below the output buffer limit', () => {
  assert.equal(shouldDisconnectSlowTerminalSocket(0), false)
  assert.equal(shouldDisconnectSlowTerminalSocket(1024), false)
  assert.equal(
    shouldDisconnectSlowTerminalSocket(DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES - 1),
    false
  )
})

test('disconnects slow sockets at or beyond the buffer limit', () => {
  assert.equal(
    shouldDisconnectSlowTerminalSocket(DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES),
    true
  )
  assert.equal(
    shouldDisconnectSlowTerminalSocket(DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES + 1),
    true
  )
})

test('fails closed for invalid buffer measurements and invalid limits', () => {
  assert.equal(shouldDisconnectSlowTerminalSocket(Number.NaN), true)
  assert.equal(shouldDisconnectSlowTerminalSocket(-1), false)
  assert.equal(shouldDisconnectSlowTerminalSocket(0, 0), true)
  assert.equal(shouldDisconnectSlowTerminalSocket(0, Number.NaN), true)
})
