export const TERMINAL_WS_MAX_MESSAGE_BYTES = 131_072
export const TERMINAL_WS_MAX_INPUT_BYTES = 65_536
export const TERMINAL_WS_MAX_BUFFERED_BYTES = 1_048_576
export const TERMINAL_WS_MAX_QUEUED_MESSAGES = 128

export function parseTerminalWebSocketMessage(value) {
  const text = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : typeof value === 'string'
      ? value
      : ''

  if (Buffer.byteLength(text, 'utf8') > TERMINAL_WS_MAX_MESSAGE_BYTES) {
    return null
  }

  let payload

  try {
    payload = JSON.parse(text)
  } catch {
    return null
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  if (payload.type === 'input') {
    if (
      typeof payload.data !== 'string' ||
      Buffer.byteLength(payload.data, 'utf8') > TERMINAL_WS_MAX_INPUT_BYTES
    ) {
      return null
    }
  } else if (payload.type === 'resize') {
    const cols = Number(payload.cols)
    const rows = Number(payload.rows)

    if (
      !Number.isInteger(cols) ||
      !Number.isInteger(rows) ||
      cols < 20 ||
      cols > 240 ||
      rows < 5 ||
      rows > 100
    ) {
      return null
    }
  } else if (payload.type !== 'ping') {
    return null
  }

  return payload
}

export function canQueueTerminalMessage({
  messageBytes,
  queuedBytes,
  queuedMessages
}) {
  return Number.isSafeInteger(messageBytes) &&
    Number.isSafeInteger(queuedBytes) &&
    Number.isSafeInteger(queuedMessages) &&
    messageBytes >= 0 &&
    queuedBytes >= 0 &&
    queuedMessages >= 0 &&
    queuedMessages < TERMINAL_WS_MAX_QUEUED_MESSAGES &&
    queuedBytes + messageBytes <= TERMINAL_WS_MAX_BUFFERED_BYTES
}

export function canSendTerminalMessage(bufferedBytes, messageBytes) {
  return Number.isSafeInteger(bufferedBytes) &&
    Number.isSafeInteger(messageBytes) &&
    bufferedBytes >= 0 &&
    messageBytes >= 0 &&
    bufferedBytes + messageBytes <= TERMINAL_WS_MAX_BUFFERED_BYTES
}
