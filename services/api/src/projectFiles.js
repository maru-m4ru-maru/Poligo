export function normalizeProjectFileMap(files, {
  maxFiles = 200,
  maxBytes = 5_000_000
} = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('project files must be an object')
  }

  const normalized = {}
  let totalBytes = 0

  for (const [path, value] of Object.entries(files)) {
    if (
      !path ||
      path.length > 240 ||
      path === '__proto__' ||
      path.includes('\\') ||
      path.includes('\0') ||
      path.startsWith('/') ||
      path.split('/').some(part => !part || part === '..' || part === '.')
    ) {
      throw new Error('invalid project file path')
    }

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

  for (const path of paths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (paths.has(parts.slice(0, index).join('/'))) {
        throw new Error('project file path conflicts with a directory')
      }
    }
  }

  if (paths.size > maxFiles) {
    throw new Error('too many project files')
  }

  return normalized
}
