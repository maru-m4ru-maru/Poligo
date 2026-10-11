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

export function normalizeProjectFilePath(path) {
  if (
    typeof path !== 'string' ||
    !path ||
    Buffer.byteLength(path, 'utf8') > 240 ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new Error('invalid project file path')
  }

  const parts = path.split('/')

  if (
    parts.some(part =>
      !part ||
      part === '.' ||
      part === '..' ||
      RESERVED_PATH_PARTS.has(part)
    )
  ) {
    throw new Error('invalid project file path')
  }

  return parts.join('/')
}

export function normalizeProjectFileMap(files, {
  maxFiles = 200,
  maxBytes = 5_000_000
} = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('project files must be an object')
  }

  const normalized = Object.create(null)
  let totalBytes = 0

  for (const [rawPath, value] of Object.entries(files)) {
    const path = normalizeProjectFilePath(rawPath)

    if (typeof value !== 'string') {
      throw new Error('project file content must be text')
    }

    totalBytes += Buffer.byteLength(value, 'utf8')

    if (totalBytes > maxBytes) {
      throw new Error('project is too large')
    }

    normalized[path] = value
  }

  const paths = new Set(Object.keys(normalized))

  if (paths.size > maxFiles) {
    throw new Error('too many project files')
  }

  for (const path of paths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (paths.has(parts.slice(0, index).join('/'))) {
        throw new Error('project file path conflicts with a directory')
      }
    }
  }

  return normalized
}
