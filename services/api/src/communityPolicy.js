export function isSecretPath(path) {
  const normalizedPath = String(path).replaceAll('\\\\', '/')
  const name = (normalizedPath.split('/').pop() || normalizedPath).toLowerCase()
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
}

export function detectLanguage(files) {
  const extensions = Object.keys(files).map(path => path.split('.').pop()?.toLowerCase())
  const pairs = [
    ['Python', ['py']], ['TypeScript', ['ts', 'tsx']], ['JavaScript', ['js', 'jsx', 'mjs', 'cjs']],
    ['Rust', ['rs']], ['Go', ['go']], ['Java', ['java']], ['Kotlin', ['kt', 'kts']],
    ['PHP', ['php']], ['Ruby', ['rb']], ['C++', ['cpp', 'cc', 'cxx', 'hpp']],
    ['C#', ['cs']], ['C', ['c', 'h']], ['HTML/CSS', ['html', 'css']]
  ]
  return pairs.find(([, exts]) => extensions.some(ext => exts.includes(ext)))?.[0] || 'Other'
}

export function normalizeCommunityVisibility(value) {
  return value === 'public' || value === 'private' ? value : ''
}

export function parseCommunityFeedLimit(value) {
  if (value == null || String(value).trim() === '') return 30
  const requested = Number(value)
  return Number.isFinite(requested)
    ? Math.min(50, Math.max(1, Math.trunc(requested)))
    : 30
}
