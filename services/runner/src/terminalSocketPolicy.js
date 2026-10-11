export const DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES = 1_048_576

export function shouldDisconnectSlowTerminalSocket(
  bufferedBytes,
  maxBufferedBytes = DEFAULT_MAX_TERMINAL_SOCKET_BUFFER_BYTES
) {
  return !Number.isSafeInteger(bufferedBytes) ||
    bufferedBytes < 0 ||
    !Number.isSafeInteger(maxBufferedBytes) ||
    maxBufferedBytes < 1 ||
    bufferedBytes >= maxBufferedBytes
}
