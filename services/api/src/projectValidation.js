export function isValidProjectFilePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 240 ||
    ['__proto__', 'prototype', 'constructor'].includes(value) ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return false
  }

  const parts = value.split('/')

  return parts.every(part =>
    part &&
    part !== '.' &&
    part !== '..'
  )
}

export function assertNoFileDirectoryConflicts(paths, message = 'project file path conflicts with a directory') {
  const pathSet = new Set(paths)

  for (const filePath of pathSet) {
    const parts = filePath.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      const parentPath = parts.slice(0, index).join('/')

      if (pathSet.has(parentPath)) {
        throw new Error(message)
      }
    }
  }
}
