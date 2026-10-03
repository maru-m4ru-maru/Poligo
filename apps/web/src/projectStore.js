const DB_NAME = 'poligo-workspace'
const STORE_NAME = 'projects'
const DB_VERSION = 1

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return 'project-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: 'id'
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('failed to open project database'))
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('project database request failed'))
  })
}

export async function listProjects() {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).getAll()
    const projects = await requestResult(request)

    return projects.sort((a, b) => b.updatedAt - a.updatedAt)
  } finally {
    database.close()
  }
}

export async function getProject(id) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(id)

    return await requestResult(request)
  } finally {
    database.close()
  }
}

export async function saveProject(project) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put({
      id: project.id,
      name: project.name,
      files: project.files,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt || Date.now()
    })

    await requestResult(request)
    localStorage.setItem('poligo-current-project', project.id)
  } finally {
    database.close()
  }
}

export async function createProject(name, files) {
  const now = Date.now()
  const project = {
    id: createId(),
    name: name?.trim() || 'Untitled Project',
    files: { ...files },
    createdAt: now,
    updatedAt: now
  }

  await saveProject(project)

  return project
}

export async function deleteProject(id) {
  const database = await openDatabase()

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).delete(id)

    await requestResult(request)

    const currentProjectId = localStorage.getItem('poligo-current-project')

    if (currentProjectId === id) {
      localStorage.removeItem('poligo-current-project')
    }
  } finally {
    database.close()
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

  const savedCurrentId = localStorage.getItem('poligo-current-project')
  const currentProject =
    projects.find(project => project.id === savedCurrentId) ||
    projects[0]

  localStorage.setItem('poligo-current-project', currentProject.id)

  return {
    projects,
    currentProject
  }
}
