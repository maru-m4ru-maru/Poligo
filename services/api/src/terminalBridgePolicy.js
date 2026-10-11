export const MAX_TERMINAL_BRIDGE_BUFFER_BYTES = 1_048_576
export const MAX_TERMINAL_BRIDGE_QUEUE_MESSAGES = 128

export function canQueueTerminalBridgeMessage({
  queuedMessages,
  queuedBytes,
  messageBytes,
  maxMessages = MAX_TERMINAL_BRIDGE_QUEUE_MESSAGES,
  maxBytes = MAX_TERMINAL_BRIDGE_BUFFER_BYTES
}) {
  return Number.isSafeInteger(queuedMessages) &&
    Number.isSafeInteger(queuedBytes) &&
    Number.isSafeInteger(messageBytes) &&
    Number.isSafeInteger(maxMessages) &&
    Number.isSafeInteger(maxBytes) &&
    queuedMessages >= 0 &&
    queuedBytes >= 0 &&
    messageBytes >= 0 &&
    maxMessages > 0 &&
    maxBytes > 0 &&
    queuedMessages < maxMessages &&
    queuedBytes + messageBytes <= maxBytes
}

export function shouldCloseTerminalBridgeSocket(
  bufferedBytes,
  maxBufferedBytes = MAX_TERMINAL_BRIDGE_BUFFER_BYTES
) {
  return !Number.isSafeInteger(bufferedBytes) ||
    !Number.isSafeInteger(maxBufferedBytes) ||
    maxBufferedBytes < 1 ||
    bufferedBytes >= maxBufferedBytes
}
