const MAX_MESSAGE_LENGTH = 4_096
const MAX_STACK_LENGTH = 20_000

export function isTrustedPreviewMessage(event, expectedSource) {
  if (!expectedSource || event?.source !== expectedSource) {
    return false
  }

  const data = event.data

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    data.source !== 'poligo-preview' ||
    data.type !== 'error' ||
    typeof data.message !== 'string' ||
    data.message.length > MAX_MESSAGE_LENGTH
  ) {
    return false
  }

  if (
    data.stack !== undefined &&
    (typeof data.stack !== 'string' || data.stack.length > MAX_STACK_LENGTH)
  ) {
    return false
  }

  return true
}
