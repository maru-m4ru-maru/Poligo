const PROJECT_DATABASE_EXACT_ROUTES = new Set([
  'GET /api/dashboard',
  'POST /api/workspace/claim',
  'POST /api/executions'
])

export function requiresProjectDatabase(method, pathname) {
  if (typeof method !== 'string' || typeof pathname !== 'string') {
    return false
  }

  const normalizedMethod = method.toUpperCase()

  if (normalizedMethod === 'OPTIONS') {
    return false
  }

  if (PROJECT_DATABASE_EXACT_ROUTES.has(normalizedMethod + ' ' + pathname)) {
    return true
  }

  if (
    pathname === '/api/projects' ||
    pathname.startsWith('/api/projects/')
  ) {
    return true
  }

  if (
    (normalizedMethod === 'POST' && pathname === '/api/terminal/sessions') ||
    pathname.startsWith('/api/terminal/sessions/')
  ) {
    return true
  }

  return false
}
