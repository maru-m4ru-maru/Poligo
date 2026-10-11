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
    new TextEncoder().encode(value).byteLength > 240 ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[A-Za-z]:/.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value)
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

export function normalizeProjectFileMap(files, {
  maxFiles = 200,
  maxBytes = 5_000_000
} = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('プロジェクトのファイル一覧が不正です。')
  }

  const normalized = Object.create(null)
  let totalBytes = 0

  for (const [rawPath, content] of Object.entries(files)) {
    const path = normalizeProjectFilePath(rawPath)

    if (typeof content !== 'string') {
      throw new Error('ファイルの内容はテキストである必要があります。')
    }

    totalBytes += new TextEncoder().encode(content).byteLength

    if (totalBytes > maxBytes) {
      throw new Error('プロジェクトのファイルサイズ上限を超えています。')
    }

    normalized[path] = content
  }

  const paths = new Set(Object.keys(normalized))

  if (paths.size > maxFiles) {
    throw new Error('ファイル数の上限を超えています。')
  }

  for (const path of paths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (paths.has(parts.slice(0, index).join('/'))) {
        throw new Error('ファイル名とフォルダー名が競合しています。')
      }
    }
  }

  return normalized
}
