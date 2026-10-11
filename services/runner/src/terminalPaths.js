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

export function normalizeTerminalFilePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 240 ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /[\u0001-\u001f\u007f]/.test(value)
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

export function normalizeTerminalFiles(files, limits = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('terminal files must be an object')
  }

  const maxFiles = limits.maxFiles ?? 200
  const maxBytes = limits.maxBytes ?? 5_000_000
  const entries = Object.entries(files)

  if (entries.length > maxFiles) {
    throw new Error('too many terminal files')
  }

  const normalized = Object.create(null)
  const paths = new Set()
  let totalBytes = 0

  for (const [name, content] of entries) {
    const safePath = normalizeTerminalFilePath(name)

    if (typeof content !== 'string') {
      throw new Error('terminal file content must be text')
    }

    totalBytes += Buffer.byteLength(content, 'utf8')

    if (totalBytes > maxBytes) {
      throw new Error('terminal workspace is too large')
    }

    paths.add(safePath)
    normalized[safePath] = content
  }

  for (const name of paths) {
    const parts = name.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (paths.has(parts.slice(0, index).join('/'))) {
        throw new Error('terminal file path conflicts with a directory')
      }
    }
  }

  return normalized
}
