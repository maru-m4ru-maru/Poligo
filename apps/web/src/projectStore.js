const API_URL = import.meta.env.VITE_API_URL || ''
const WORKSPACE_KEY = 'poligo-workspace-id'
const CURRENT_PROJECT_KEY = 'poligo-current-project'

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function getWorkspaceId() {
  let workspaceId = localStorage.getItem(WORKSPACE_KEY)

  if (!workspaceId) {
    workspaceId = createId('workspace')
    localStorage.setItem(WORKSPACE_KEY, workspaceId)
  }

  return workspaceId
}

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Poligo-Workspace': getWorkspaceId(),
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    let message = response.status + ' ' + response.statusText

    try {
      const body = await response.json()

      if (body.error) {
        message = body.error
      }
    } catch {}

    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export async function claimWorkspace() {
  return request('/api/workspace/claim', {
    method: 'POST'
  })
}

export async function listProjects() {
  return request('/api/projects')
}

export async function getProject(id) {
  return request('/api/projects/' + encodeURIComponent(id))
}

export async function saveProject(project) {
  const saved = await request(
    '/api/projects/' + encodeURIComponent(project.id),
    {
      method: 'PUT',
      body: JSON.stringify({
        name: project.name,
        files: project.files
      })
    }
  )

  localStorage.setItem(CURRENT_PROJECT_KEY, project.id)

  return saved
}

export async function createProject(name, files) {
  const project = await request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: name?.trim() || 'Untitled Project',
      files: { ...files }
    })
  })

  localStorage.setItem(CURRENT_PROJECT_KEY, project.id)

  return project
}

export async function deleteProject(id) {
  await request(
    '/api/projects/' + encodeURIComponent(id),
    {
      method: 'DELETE'
    }
  )

  if (localStorage.getItem(CURRENT_PROJECT_KEY) === id) {
    localStorage.removeItem(CURRENT_PROJECT_KEY)
  }
}

export async function duplicateProject(project) {
  return createProject(
    project.name.trim() + ' Copy',
    project.files
  )
}

export async function initializeWorkspace(defaultFiles) {
  let projects = await listProjects()

  if (!projects.length) {
    let legacyFiles = null

    try {
      const stored = localStorage.getItem('poligo-files')

      if (stored) {
        const parsed = JSON.parse(stored)

        if (parsed && typeof parsed === 'object') {
          legacyFiles = parsed
        }
      }
    } catch {}

    const project = await createProject(
      'Untitled Project',
      {
        ...defaultFiles,
        ...(legacyFiles || {})
      }
    )

    projects = [project]
  }

  const savedCurrentId = localStorage.getItem(CURRENT_PROJECT_KEY)
  const currentProject =
    projects.find(project => project.id === savedCurrentId) ||
    projects[0]

  const fullCurrentProject = await getProject(currentProject.id)

  if (!fullCurrentProject) {
    throw new Error('current project could not be loaded')
  }

  localStorage.setItem(CURRENT_PROJECT_KEY, fullCurrentProject.id)

  return {
    projects,
    currentProject: fullCurrentProject
  }
}


export async function listCommits(projectId) {
  return request(
    '/api/projects/' + encodeURIComponent(projectId) + '/commits'
  )
}

export async function getCommitDiff(projectId, commitId) {
  return request(
    '/api/projects/' +
      encodeURIComponent(projectId) +
      '/commits/' +
      encodeURIComponent(commitId) +
      '/diff'
  )
}

export async function getCommit(projectId, commitId) {
  return request(
    '/api/projects/' +
      encodeURIComponent(projectId) +
      '/commits/' +
      encodeURIComponent(commitId)
  )
}

export async function createCommit(projectId, message) {
  return request(
    '/api/projects/' +
      encodeURIComponent(projectId) +
      '/commits',
    {
      method: 'POST',
      body: JSON.stringify({
        message
      })
    }
  )
}

export async function restoreCommit(projectId, commitId) {
  return request(
    '/api/projects/' +
      encodeURIComponent(projectId) +
      '/commits/' +
      encodeURIComponent(commitId) +
      '/restore',
    {
      method: 'POST'
    }
  )
}
