export function decodeDockerLogs(value) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : Buffer.from(String(value ?? ''), 'utf8')

  if (!buffer.length) {
    return {
      stdout: '',
      stderr: ''
    }
  }

  let offset = 0
  let hasFrames = false
  const stdout = []
  const stderr = []

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) {
      return {
        stdout: buffer.toString('utf8'),
        stderr: ''
      }
    }

    const streamType = buffer[offset]
    const reservedBytesAreZero =
      buffer[offset + 1] === 0 &&
      buffer[offset + 2] === 0 &&
      buffer[offset + 3] === 0

    if (
      !reservedBytesAreZero ||
      (streamType !== 1 && streamType !== 2)
    ) {
      return {
        stdout: buffer.toString('utf8'),
        stderr: ''
      }
    }

    const length = buffer.readUInt32BE(offset + 4)
    const start = offset + 8
    const end = start + length

    if (end > buffer.length) {
      return {
        stdout: buffer.toString('utf8'),
        stderr: ''
      }
    }

    const chunk = buffer.subarray(start, end).toString('utf8')

    if (streamType === 1) {
      stdout.push(chunk)
    } else {
      stderr.push(chunk)
    }

    hasFrames = true
    offset = end
  }

  if (!hasFrames) {
    return {
      stdout: buffer.toString('utf8'),
      stderr: ''
    }
  }

  return {
    stdout: stdout.join(''),
    stderr: stderr.join('')
  }
}
