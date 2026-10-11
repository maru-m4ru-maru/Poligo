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
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /[\u0001-\u001f\u007f]/.test(value)
  ) {
    throw new Error('ファイルパスが不正です。')
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
    throw new Error('使用できないファイル名またはフォルダー名です。')
  }

  return parts.join('/')
}

export function hasProjectFilePathConflict(files, candidate, excludedPath = '') {
  const normalized = normalizeProjectFilePath(candidate)

  return Object.keys(files || {}).some(path => {
    if (path === excludedPath) {
      return false
    }

    return path === normalized ||
      path.startsWith(normalized + '/') ||
      normalized.startsWith(path + '/')
  })
}
