export class RequestInputError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'RequestInputError'
    this.statusCode = statusCode
  }
}

export async function readJsonBody(request, maxBytes) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk)

    size += data.byteLength

    if (size > maxBytes) {
      throw new RequestInputError('request too large', 413)
    }

    chunks.push(data)
  }

  if (size === 0) {
    return {}
  }

  let payload

  try {
    payload = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
  } catch {
    throw new RequestInputError('invalid JSON body', 400)
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestInputError('request body must be a JSON object', 400)
  }

  return payload
}

export function getRequestInputStatus(error) {
  return error instanceof RequestInputError
    ? error.statusCode
    : null
}
