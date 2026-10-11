export function normalizeRelativeFilePath(value, maxLength = 240) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > maxLength ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error('invalid file path')
  }

  const parts = value.split('/')

  if (
    parts.some(part =>
      !part ||
      part === '.' ||
      part === '..' ||
      ['__proto__', 'prototype', 'constructor'].includes(part)
    )
  ) {
    throw new Error('invalid file path')
  }

  return parts.join('/')
}

export function assertNoPathConflicts(paths, message = 'file path conflicts with a directory') {
  const pathSet = new Set(paths)

  for (const filePath of pathSet) {
    const parts = filePath.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (pathSet.has(parts.slice(0, index).join('/'))) {
        throw new Error(message)
      }
    }
  }
}
