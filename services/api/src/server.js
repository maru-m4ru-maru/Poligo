import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { authenticateRequest, getAuthStatus } from './auth.js'
import { getDatabase, getDatabaseStatus, initializeDatabase } from './turso.js'

const port = Number(process.env.PORT || 10000)
const runnerUrl = process.env.RUNNER_URL || ''
const runnerToken = process.env.RUNNER_TOKEN || ''
const allowedOrigin = process.env.CORS_ORIGIN || '*'
const MAX_FILES = 200
const MAX_PROJECT_BYTES = 5_000_000
const WORKSPACE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Poligo-Workspace',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''

  for await (const chunk of request) {
    body += chunk

    if (body.length > 6_000_000) {
      throw new Error('request too large')
    }
  }

  return body ? JSON.parse(body) : {}
}

async function getAuthenticatedUser(request) {
  return authenticateRequest(request)
}

function getWorkspaceId(request) {
  const workspaceId = request.headers['x-poligo-workspace']

  if (typeof workspaceId !== 'string' || !WORKSPACE_PATTERN.test(workspaceId)) {
    throw new Error('invalid workspace id')
  }

  return workspaceId
}

function normalizeProjectPayload(payload) {
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
      path.includes('\\') ||
      path.startsWith('/') ||
      path.split('/').includes('..')
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

  if (Object.keys(files).length > MAX_FILES) {
    throw new Error('too many project files')
  }

  return {
    name,
    files
  }
}

function serializeProject(row, files) {
  return {
    id: row.id,
    name: row.name,
    files,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  }
}

async function getProjectById(projectId, ownerId) {
  const database = getDatabase()
  const projectResult = await database.prepare(
    'SELECT id, name, created_at, updated_at FROM projects WHERE id = ? AND owner_id = ?'
  ).all([projectId, ownerId])

  const row = projectResult[0]

  if (!row) {
    return null
  }

  const fileRows = await database.prepare(
    'SELECT path, content FROM project_files WHERE project_id = ? ORDER BY path'
  ).all([projectId])

  const files = {}

  for (const file of fileRows) {
    files[file.path] = file.content
  }

  return serializeProject(row, files)
}

async function listProjects(ownerId) {
  const database = getDatabase()
  const result = await database.prepare(
    'SELECT id, name, created_at, updated_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC'
  ).all([ownerId])

  return result.map(row => ({
    id: row.id,
    name: row.name,
    files: {},
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  }))
}

async function createProject(ownerId, payload) {
  const database = getDatabase()
  const id = randomUUID()
  const now = Date.now()
  const statements = [
    {
      sql: 'INSERT INTO projects (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, ownerId, payload.name, now, now]
    }
  ]

  for (const [path, content] of Object.entries(payload.files)) {
    statements.push({
      sql: 'INSERT INTO project_files (project_id, path, content) VALUES (?, ?, ?)',
      args: [id, path, content]
    })
  }

  await database.batch(statements, 'immediate')

  return {
    id,
    name: payload.name,
    files: payload.files,
    createdAt: now,
    updatedAt: now
  }
}

async function updateProject(projectId, ownerId, payload) {
  const database = getDatabase()
  const current = await getProjectById(projectId, ownerId)

  if (!current) {
    return null
  }

  const now = Date.now()
  const statements = [
    {
      sql: 'UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND owner_id = ?',
      args: [payload.name, now, projectId, ownerId]
    },
    {
      sql: 'DELETE FROM project_files WHERE project_id = ?',
      args: [projectId]
    }
  ]

  for (const [path, content] of Object.entries(payload.files)) {
    statements.push({
      sql: 'INSERT INTO project_files (project_id, path, content) VALUES (?, ?, ?)',
      args: [projectId, path, content]
    })
  }

  await database.batch(statements, 'immediate')

  return {
    id: projectId,
    name: payload.name,
    files: payload.files,
    createdAt: current.createdAt,
    updatedAt: now
  }
}

async function deleteProject(projectId, ownerId) {
  const database = getDatabase()
  const current = await getProjectById(projectId, ownerId)

  if (!current) {
    return false
  }

  await database.batch([
    {
      sql: 'DELETE FROM project_files WHERE project_id = ?',
      args: [projectId]
    },
    {
      sql: 'DELETE FROM projects WHERE id = ? AND owner_id = ?',
      args: [projectId, ownerId]
    }
  ], 'immediate')

  return true
}

async function handleClaimWorkspace(request, response) {
  const user = await getAuthenticatedUser(request)
  const workspaceId = getWorkspaceId(request)
  const database = getDatabase()
  const result = await database.prepare(
    'UPDATE projects SET owner_id = ? WHERE owner_id = ?'
  ).run([user.id, workspaceId])

  send(response, 200, {
    claimed: Number(result.rowsAffected || 0)
  })
}

async function handleProjectRequest(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  const user = await getAuthenticatedUser(request)
  const ownerId = user.id

  if (parts[1] !== 'projects') {
    send(response, 404, {
      error: 'not found'
    })
    return
  }

  const projectId = parts[2]

  if (request.method === 'GET' && !projectId) {
    send(response, 200, await listProjects(ownerId))
    return
  }

  if (request.method === 'POST' && !projectId) {
    const payload = normalizeProjectPayload(await readJson(request))
    send(response, 201, await createProject(ownerId, payload))
    return
  }

  if (!projectId || parts.length !== 3) {
    send(response, 400, {
      error: 'invalid project route'
    })
    return
  }

  if (request.method === 'GET') {
    const project = await getProjectById(projectId, ownerId)

    if (!project) {
      send(response, 404, {
        error: 'project not found'
      })
      return
    }

    send(response, 200, project)
    return
  }

  if (request.method === 'PUT') {
    const payload = normalizeProjectPayload(await readJson(request))
    const project = await updateProject(projectId, ownerId, payload)

    if (!project) {
      send(response, 404, {
        error: 'project not found'
      })
      return
    }

    send(response, 200, project)
    return
  }

  if (request.method === 'DELETE') {
    const deleted = await deleteProject(projectId, ownerId)

    if (!deleted) {
      send(response, 404, {
        error: 'project not found'
      })
      return
    }

    send(response, 200, { ok: true })
  }
}

function runnerHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (runnerToken) {
    headers.Authorization = 'Bearer ' + runnerToken
  }

  return headers
}

async function handleExecution(request, response) {
  await getAuthenticatedUser(request)
  const payload = await readJson(request)

  if (!runnerUrl) {
    send(response, 503, {
      error: 'runner is not configured'
    })
    return
  }

  const id = randomUUID()

  const runnerResponse = await fetch(
    runnerUrl.replace(/\/$/, '') + '/v1/run',
    {
      method: 'POST',
      headers: runnerHeaders(),
      body: JSON.stringify({
        id,
        language: payload.language || 'plaintext',
        entrypoint: payload.entrypoint || null,
        files: payload.files || {}
      })
    }
  )

  let result

  try {
    result = await runnerResponse.json()
  } catch {
    result = {
      error: 'runner returned invalid JSON'
    }
  }

  send(response, runnerResponse.ok ? 202 : 502, {
    id,
    ...result
  })
}

async function handleExecutionStatus(request, response, id) {
  await getAuthenticatedUser(request)

  if (!runnerUrl) {
    send(response, 503, {
      error: 'runner is not configured'
    })
    return
  }

  const runnerResponse = await fetch(
    runnerUrl.replace(/\/$/, '') + '/v1/runs/' + encodeURIComponent(id),
    {
      method: 'GET',
      headers: runnerHeaders()
    }
  )

  let result

  try {
    result = await runnerResponse.json()
  } catch {
    result = {
      error: 'runner returned invalid JSON'
    }
  }

  send(response, runnerResponse.ok ? 200 : 502, result)
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, {})
    return
  }

  if (request.method === 'GET' && request.url === '/api/health') {
    send(response, 200, {
      status: 'ok',
      service: 'api',
      runner: Boolean(runnerUrl),
      database: getDatabaseStatus(),
      auth: getAuthStatus()
    })
    return
  }

  if (request.method === 'POST' && request.url === '/api/projects/claim') {
    try {
      await handleClaimWorkspace(request, response)
    } catch (error) {
      send(response, error.statusCode || 500, {
        error: error instanceof Error ? error.message : 'workspace claim failed'
      })
    }
    return
  }

  if (
    (request.method === 'GET' || request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') &&
    (request.url === '/api/projects' || request.url.startsWith('/api/projects/'))
  ) {
    try {
      await handleProjectRequest(request, response)
    } catch (error) {
      const status = error.statusCode || (error.message === 'invalid workspace id' ? 400 : 500)

      send(response, status, {
        error: error instanceof Error ? error.message : 'project request failed'
      })
    }
    return
  }

  if (request.method === 'POST' && request.url === '/api/projects') {
    try {
      await handleProjectRequest(request, response)
    } catch (error) {
      const status =
        error.statusCode ||
        (
          error.message === 'invalid workspace id' ||
          error.message.includes('required') ||
          error.message.includes('invalid project') ||
          error.message.includes('project files') ||
          error.message.includes('project is too large') ||
          error.message.includes('too many project files')
            ? 400
            : 500
        )

      send(response, status, {
        error: error instanceof Error ? error.message : 'project request failed'
      })
    }
    return
  }

  if (
    request.method === 'PUT' &&
    request.url.startsWith('/api/projects/')
  ) {
    try {
      await handleProjectRequest(request, response)
    } catch (error) {
      send(response, 500, {
        error: error instanceof Error ? error.message : 'project request failed'
      })
    }
    return
  }

  if (
    request.method === 'DELETE' &&
    request.url.startsWith('/api/projects/')
  ) {
    try {
      await handleProjectRequest(request, response)
    } catch (error) {
      send(response, 500, {
        error: error instanceof Error ? error.message : 'project request failed'
      })
    }
    return
  }

  if (request.method === 'POST' && request.url === '/api/executions') {
    try {
      await handleExecution(request, response)
    } catch (error) {
      send(response, error.statusCode || 502, {
        error: error instanceof Error ? error.message : 'runner request failed'
      })
    }
    return
  }

  if (request.method === 'GET' && request.url.startsWith('/api/executions/')) {
    const id = request.url.slice('/api/executions/'.length)

    if (!id || id.includes('/')) {
      send(response, 400, {
        error: 'invalid execution id'
      })
      return
    }

    try {
      await handleExecutionStatus(request, response, id)
    } catch (error) {
      send(response, 502, {
        error: error instanceof Error ? error.message : 'runner request failed'
      })
    }
    return
  }

  send(response, 404, {
    error: 'not found'
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log('Poligo API listening on ' + port)

  initializeDatabase()
    .then(initialized => {
      console.log('Poligo database ' + (initialized ? 'ready' : 'not configured'))
    })
    .catch(error => {
      console.error(
        'Poligo database initialization failed: ' +
        (error instanceof Error ? error.message : String(error))
      )
    })
})
