const JAVASCRIPT_EXTENSIONS = new Set(['js', 'mjs', 'cjs'])

function extensionOf(path) {
  if (typeof path !== 'string') {
    return ''
  }

  const name = path.split('/').pop() || ''
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function isJavaScriptFile(path, files) {
  return JAVASCRIPT_EXTENSIONS.has(extensionOf(path)) &&
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
  if (isJavaScriptFile(activeFile, files)) {
    return activeFile
  }

  const declaredMain = typeof manifest.main === 'string'
    ? manifest.main.trim()
    : ''

  if (declaredMain && isJavaScriptFile(declaredMain, files)) {
    return declaredMain
  }

  for (const candidate of ['main.js', 'index.js', 'src/index.js']) {
    if (isJavaScriptFile(candidate, files)) {
      return candidate
    }
  }

  return Object.keys(files || {})
    .filter(path => isJavaScriptFile(path, files))
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
