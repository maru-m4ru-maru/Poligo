export async function readJsonBody(request, { maxBytes = 8_000_000 } = {}) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk)

    size += buffer.length

    if (size > maxBytes) {
      throw new Error('request too large')
    }

    chunks.push(buffer)
  }

  if (!size) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
}
