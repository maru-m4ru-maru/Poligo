const RESERVED_PATH_PARTS = new Set([
  '.git',
  'node_modules',
  '.terminal-cache',
  '.tmp',
  '.cache',
  '__proto__',
  'prototype',
  'constructor'
])

export function normalizeRunnerFilePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 240 ||
    value.includes('\0') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
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
      RESERVED_PATH_PARTS.has(part)
    )
  ) {
    throw new Error('invalid file path')
  }

  return parts.join('/')
}

export function assertNoFileDirectoryConflicts(paths) {
  const filePaths = new Set(paths)

  for (const filePath of filePaths) {
    const parts = filePath.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (filePaths.has(parts.slice(0, index).join('/'))) {
        throw new Error('file path conflicts with a directory')
      }
    }
  }
}
