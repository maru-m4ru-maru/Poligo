const MAX_FILES = 200
const MAX_PROJECT_BYTES = 5_000_000

export function normalizeProjectPayload(payload) {
  const name = typeof payload.name === 'string'
    ? payload.name.trim().slice(0, 120)
    : ''

  if (!name) {
    throw new Error('project name is required')
  }

  if (!payload.files || typeof payload.files !== 'object' || Array.isArray(payload.files)) {
    throw new Error('project files must be an object')
  }

  const files = {}
  let totalBytes = 0

  for (const [path, value] of Object.entries(payload.files)) {
    if (
      typeof path !== 'string' ||
      path.length === 0 ||
      path.length > 240 ||
      path.split('').some(character => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      }) ||
      path.includes(String.fromCharCode(92)) ||
      path.startsWith('/') ||
      path.split('/').some(part => !part || part === '..' || part === '.')
    ) {
      throw new Error('invalid project file path')
    }

    if (typeof value !== 'string') {
      throw new Error('project file content must be text')
    }

    totalBytes += Buffer.byteLength(value, 'utf8')

    if (totalBytes > MAX_PROJECT_BYTES) {
      throw new Error('project is too large')
    }

    files[path] = value
  }

  const filePaths = new Set(Object.keys(files))

  for (const path of filePaths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (filePaths.has(parts.slice(0, index).join('/'))) {
        throw new Error('project file path conflicts with a directory')
      }
    }
  }

  if (Object.keys(files).length > MAX_FILES) {
    throw new Error('too many project files')
  }

  return {
    name,
    files
  }
}

