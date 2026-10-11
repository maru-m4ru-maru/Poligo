export function parseSourceControlRoute(method, pathname) {
  if (typeof method !== 'string' || typeof pathname !== 'string') {
    return null
  }

  const parts = pathname.split('/').filter(Boolean)

  if (
    parts[0] !== 'api' ||
    parts[1] !== 'projects' ||
    !parts[2] ||
    parts[3] !== 'commits'
  ) {
    return null
  }

  if (parts.length === 4) {
    if (method === 'GET') {
      return {
        operation: 'list',
        projectId: parts[2],
        commitId: ''
      }
    }

    if (method === 'POST') {
      return {
        operation: 'create',
        projectId: parts[2],
        commitId: ''
      }
    }

    return null
  }

  if (parts.length === 5 && parts[4] && method === 'GET') {
    return {
      operation: 'get',
      projectId: parts[2],
      commitId: parts[4]
    }
  }

  if (parts.length === 6 && parts[4]) {
    if (parts[5] === 'diff' && method === 'GET') {
      return {
        operation: 'diff',
        projectId: parts[2],
        commitId: parts[4]
      }
    }

    if (parts[5] === 'restore' && method === 'POST') {
      return {
        operation: 'restore',
        projectId: parts[2],
        commitId: parts[4]
      }
    }
  }

  return null
}
