const MAX_FILES = 200
const MAX_PROJECT_BYTES = 5_000_000
const MAX_PROJECT_NAME_LENGTH = 120
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

export function normalizeProjectFilePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 240 ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    /[\u0001-\u001f\u007f]/.test(value)
  ) {
    throw new Error('invalid project file path')
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
    throw new Error('invalid project file path')
  }

  return value
}

export function normalizeProjectFileMap(files, limits = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('project files must be an object')
  }

  const maxFiles = limits.maxFiles ?? MAX_FILES
  const maxBytes = limits.maxBytes ?? MAX_PROJECT_BYTES
  const entries = Object.entries(files)

  if (entries.length > maxFiles) {
    throw new Error('too many project files')
  }

  const paths = new Set()
  let totalBytes = 0

  for (const [path, content] of entries) {
    normalizeProjectFilePath(path)

    if (typeof content !== 'string') {
      throw new Error('project file content must be text')
    }

    totalBytes += Buffer.byteLength(content, 'utf8')

    if (totalBytes > maxBytes) {
      throw new Error('project is too large')
    }

    paths.add(path)
  }

  for (const path of paths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (paths.has(parts.slice(0, index).join('/'))) {
        throw new Error('invalid project file path: file/directory conflict')
      }
    }
  }

  const normalized = Object.create(null)

  for (const [path, content] of entries) {
    normalized[path] = content
  }

  return normalized
}

export function normalizeProjectPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('invalid project payload')
  }

  const name = typeof payload.name === 'string'
    ? payload.name.trim()
    : ''

  if (
    !name ||
    name.length > MAX_PROJECT_NAME_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new Error('invalid project name: must be 1 to 120 characters')
  }

  return {
    name,
    files: normalizeProjectFileMap(payload.files)
  }
}
