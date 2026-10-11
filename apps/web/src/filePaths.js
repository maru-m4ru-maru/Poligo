export function isSafeProjectFilePath(path) {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.length > 240 ||
    path.startsWith('/') ||
    path.includes(String.fromCharCode(92)) ||
    path.split('').some(character => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    })
  ) {
    return false
  }

  return !path.split('/').some(part =>
    !part || part === '.' || part === '..'
  )
}

export function areValidProjectPaths(paths) {
  if (!Array.isArray(paths)) {
    return false
  }

  const uniquePaths = new Set(paths)

  if (uniquePaths.size !== paths.length) {
    return false
  }

  for (const path of uniquePaths) {
    if (!isSafeProjectFilePath(path)) {
      return false
    }
  }

  for (const path of uniquePaths) {
    const parts = path.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      if (uniquePaths.has(parts.slice(0, index).join('/'))) {
        return false
      }
    }
  }

  return true
}
