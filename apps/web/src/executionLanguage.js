const NODE_EXECUTABLE_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'])

function extensionOf(path) {
  if (typeof path !== 'string') {
    return ''
  }

  const name = path.split('/').pop() || ''
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function isNodeExecutableFile(path, files) {
  return NODE_EXECUTABLE_EXTENSIONS.has(extensionOf(path)) &&
    typeof files?.[path] === 'string'
}

function parseManifest(files) {
  try {
    const value = JSON.parse(files?.['package.json'] || '{}')
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {}
  } catch {
    return {}
  }
}

function findNodeEntrypoint(files, activeFile, manifest) {
  if (isNodeExecutableFile(activeFile, files)) {
    return activeFile
  }

  const declaredMain = typeof manifest.main === 'string'
    ? manifest.main.trim()
    : ''

  if (declaredMain && isNodeExecutableFile(declaredMain, files)) {
    return declaredMain
  }

  for (const candidate of ['main.js', 'index.js', 'src/index.js']) {
    if (isNodeExecutableFile(candidate, files)) {
      return candidate
    }
  }

  return Object.keys(files || {})
    .filter(path => isNodeExecutableFile(path, files))
    .sort()[0] || ''
}

export function getExecutionTarget(files, activeFile, editorLanguage) {
  const manifest = parseManifest(files)
  const isNodeProject = manifest?.poligo?.runtime === 'node'

  if (!isNodeProject) {
    return {
      language: editorLanguage,
      entrypoint: activeFile
    }
  }

  return {
    language: 'node',
    entrypoint: findNodeEntrypoint(files, activeFile, manifest)
  }
}

export function getExecutionLanguage(files, activeFile, editorLanguage) {
  return getExecutionTarget(files, activeFile, editorLanguage).language
}
