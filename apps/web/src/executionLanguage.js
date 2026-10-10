export function getExecutionLanguage(files, activeFile, editorLanguage) {
  const extension = activeFile.includes('.')
    ? activeFile.slice(activeFile.lastIndexOf('.') + 1).toLowerCase()
    : ''

  if (!['js', 'mjs', 'cjs'].includes(extension)) {
    return editorLanguage
  }

  let manifest

  try {
    manifest = JSON.parse(files?.['package.json'] || '{}')
  } catch {
    return editorLanguage
  }

  return manifest?.poligo?.runtime === 'node'
    ? 'node'
    : editorLanguage
}
