export function keepUtf8Tail(value, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('maximum output size must be a non-negative safe integer')
  }

  const buffer = Buffer.from(String(value ?? ''), 'utf8')

  if (buffer.length <= maxBytes) {
    return buffer.toString('utf8')
  }

  if (maxBytes === 0) {
    return ''
  }

  let start = buffer.length - maxBytes

  while (
    start < buffer.length &&
    (buffer[start] & 0xc0) === 0x80
  ) {
    start += 1
  }

  return buffer.subarray(start).toString('utf8')
}

export function appendUtf8Tail(existing, chunk, maxBytes) {
  return keepUtf8Tail(String(existing ?? '') + String(chunk ?? ''), maxBytes)
}
