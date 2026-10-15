import pg from 'pg'
import { randomBytes } from 'node:crypto'
import { readJsonBody } from '../../../packages/protocol/src/requestBody.js'
import { getDatabase } from './turso.js'
import { decryptProjectSecrets } from './secretStore.js'
import { auth } from './auth.js'
import { fromNodeHeaders } from 'better-auth/node'

const { Pool } = pg
const connectionString = process.env.COCKROACH_DATABASE_URL || ''
const pool = connectionString
  ? new Pool({
      connectionString,
      ...(process.env.COCKROACH_SSL === 'disable' ? { ssl: false } : {}),
      max: Number(process.env.COMMUNITY_DB_POOL_SIZE || 5),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    })
  : null

let initialized = false

export function getCommunityDatabaseStatus() {
  return { configured: Boolean(pool), ready: initialized }
}

export async function initializeCommunityDatabase() {
  if (!pool) return false
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_project_id STRING NOT NULL UNIQUE,
      owner_id STRING NOT NULL,
      name STRING NOT NULL,
      description STRING NOT NULL DEFAULT '',
      language STRING NOT NULL DEFAULT 'Other',
      published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      featured BOOLEAN NOT NULL DEFAULT false,
      featured_at TIMESTAMPTZ,
      stars INT8 NOT NULL DEFAULT 0,
      forks INT8 NOT NULL DEFAULT 0,
      CONSTRAINT community_projects_name_length CHECK (length(name) BETWEEN 1 AND 120),
      CONSTRAINT community_projects_description_length CHECK (length(description) <= 500)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_stars (
      project_id UUID NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
      user_id STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_favorites (
      project_id UUID NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
      user_id STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,
      author_id STRING NOT NULL,
      body STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT community_comments_body_length CHECK (length(body) BETWEEN 1 AND 2000)
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_projects_feed ON community_projects (featured DESC, published_at DESC)')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_user_codes (
      user_id STRING PRIMARY KEY,
      invite_code STRING NOT NULL UNIQUE,
      display_name STRING NOT NULL DEFAULT 'Poligoユーザー',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id STRING NOT NULL,
      actor_id STRING,
      actor_name STRING NOT NULL DEFAULT 'Poligo',
      kind STRING NOT NULL,
      title STRING NOT NULL,
      body STRING NOT NULL DEFAULT '',
      resource_type STRING NOT NULL DEFAULT '',
      resource_id STRING NOT NULL DEFAULT '',
      is_read BOOLEAN NOT NULL DEFAULT false,
      is_hidden BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name STRING NOT NULL,
      description STRING NOT NULL DEFAULT '',
      visibility STRING NOT NULL DEFAULT 'public',
      join_policy STRING NOT NULL DEFAULT 'manual',
      owner_id STRING NOT NULL,
      owner_name STRING NOT NULL DEFAULT 'Poligoユーザー',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT community_teams_name_length CHECK (length(name) BETWEEN 1 AND 80),
      CONSTRAINT community_teams_description_length CHECK (length(description) <= 500),
      CONSTRAINT community_teams_visibility CHECK (visibility IN ('public', 'private')),
      CONSTRAINT community_teams_join_policy CHECK (join_policy IN ('auto', 'manual'))
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_team_members (
      team_id UUID NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
      user_id STRING NOT NULL,
      display_name STRING NOT NULL DEFAULT 'Poligoユーザー',
      role STRING NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (team_id, user_id),
      CONSTRAINT community_team_member_role CHECK (role IN ('owner', 'admin', 'member'))
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_team_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
      inviter_id STRING NOT NULL,
      inviter_name STRING NOT NULL,
      invitee_id STRING NOT NULL,
      invitee_name STRING NOT NULL,
      status STRING NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ,
      CONSTRAINT community_team_invite_status CHECK (status IN ('pending', 'accepted', 'declined'))
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_team_join_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
      user_id STRING NOT NULL,
      display_name STRING NOT NULL,
      status STRING NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ,
      CONSTRAINT community_team_request_status CHECK (status IN ('pending', 'approved', 'rejected')),
      UNIQUE (team_id, user_id, status)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_team_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES community_teams(id) ON DELETE CASCADE,
      sender_id STRING NOT NULL,
      sender_name STRING NOT NULL,
      kind STRING NOT NULL DEFAULT 'message',
      recipient_id STRING,
      recipient_name STRING NOT NULL DEFAULT '',
      body STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT community_team_message_kind CHECK (kind IN ('message', 'announcement', 'dm')),
      CONSTRAINT community_team_message_length CHECK (length(body) BETWEEN 1 AND 3000)
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_notifications_user_date ON community_notifications (user_id, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_members_user ON community_team_members (user_id, joined_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_teams_discovery ON community_teams (visibility, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_invites_user_status ON community_team_invites (invitee_id, status, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_requests_team_status ON community_team_join_requests (team_id, status, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_messages_feed ON community_team_messages (team_id, created_at DESC)')

  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_projects_stars ON community_projects (stars DESC, published_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_comments_project ON community_comments (project_id, created_at DESC)')
  initialized = true
  return true
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function sessionFor(request) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  return session?.user?.id ? session : null
}

function normalizeDescription(value) {
  return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function isSecretPath(path) {
  const name = String(path).split('/').pop() || String(path)
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
}

function detectLanguage(files) {
  const extensions = Object.keys(files).map(path => path.split('.').pop()?.toLowerCase())
  const pairs = [
    ['Python', ['py']], ['TypeScript', ['ts', 'tsx']], ['JavaScript', ['js', 'jsx', 'mjs', 'cjs']],
    ['Rust', ['rs']], ['Go', ['go']], ['Java', ['java']], ['Kotlin', ['kt', 'kts']],
    ['PHP', ['php']], ['Ruby', ['rb']], ['C++', ['cpp', 'cc', 'cxx', 'hpp']],
    ['C#', ['cs']], ['C', ['c', 'h']], ['HTML/CSS', ['html', 'css']]
  ]
  return pairs.find(([, exts]) => extensions.some(ext => exts.includes(ext)))?.[0] || 'Other'
}

async function getOwnedProject(projectId, ownerId) {
  const database = getDatabase()
  const result = await (await database.prepare(
    'SELECT id, owner_id, name, created_at, updated_at FROM projects WHERE id = ? AND owner_id = ?'
  )).all([projectId, ownerId])
  const project = result[0]
  if (!project) return null
  const rows = await (await database.prepare(
    'SELECT path, content FROM project_files WHERE project_id = ? ORDER BY path'
  )).all([projectId])
  const rawFiles = Object.create(null)
  for (const row of rows) rawFiles[row.path] = row.content
  return { ...project, files: decryptProjectSecrets(rawFiles) }
}

function userDisplayName(session) {
  return String(session?.user?.name || session?.user?.username || 'Poligoユーザー').trim().slice(0, 80) || 'Poligoユーザー'
}

function createInvitationCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return [...randomBytes(5)].map(value => alphabet[value % alphabet.length]).join('')
}

async function ensureInvitationCode(userId, displayName) {
  const existing = await pool.query(
    'SELECT invite_code FROM community_user_codes WHERE user_id = $1',
    [userId]
  )

  if (existing.rows[0]) {
    await pool.query(
      'UPDATE community_user_codes SET display_name = $1, updated_at = now() WHERE user_id = $2',
      [displayName, userId]
    )
    return existing.rows[0].invite_code
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const inviteCode = createInvitationCode()
    const inserted = await pool.query(
      'INSERT INTO community_user_codes (user_id, invite_code, display_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING invite_code',
      [userId, inviteCode, displayName]
    )

    if (inserted.rows[0]) return inserted.rows[0].invite_code

    const raced = await pool.query(
      'SELECT invite_code FROM community_user_codes WHERE user_id = $1',
      [userId]
    )
    if (raced.rows[0]) return raced.rows[0].invite_code
  }

  throw new Error('invitation code could not be generated')
}

async function createCommunityNotification(db, notification) {
  if (!notification.userId) return null
  const result = await db.query(
    'INSERT INTO community_notifications (user_id, actor_id, actor_name, kind, title, body, resource_type, resource_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, user_id, actor_id, actor_name, kind, title, body, resource_type, resource_id, is_read, is_hidden, created_at',
    [
      notification.userId,
      notification.actorId || null,
      String(notification.actorName || 'Poligo').slice(0, 80),
      String(notification.kind || 'community_activity').slice(0, 40),
      String(notification.title || 'Poligoからのお知らせ').slice(0, 160),
      String(notification.body || '').slice(0, 3000),
      String(notification.resourceType || '').slice(0, 40),
      String(notification.resourceId || '').slice(0, 100)
    ]
  )
  return result.rows[0] || null
}

async function withCommunityTransaction(action) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await action(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function getTeamRole(teamId, userId, db = pool) {
  if (!userId) return ''
  const result = await db.query(
    'SELECT role FROM community_team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  )
  return result.rows[0]?.role || ''
}

function canManageTeam(role) {
  return role === 'owner' || role === 'admin'
}

async function addTeamMember(db, teamId, userId, displayName, role = 'member') {
  await db.query(
    'INSERT INTO community_team_members (team_id, user_id, display_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (team_id, user_id) DO NOTHING',
    [teamId, userId, displayName, role]
  )
}

async function getTeamManagerIds(teamId, db = pool) {
  const result = await db.query(
    "SELECT user_id, display_name FROM community_team_members WHERE team_id = $1 AND role IN ('owner', 'admin')",
    [teamId]
  )
  return result.rows
}

async function notifyTeamMembers(teamId, actorId, actorName, kind, title, body, resourceType = 'team') {
  const members = await pool.query(
    'SELECT user_id FROM community_team_members WHERE team_id = $1 AND user_id != $2',
    [teamId, actorId]
  )
  for (const member of members.rows) {
    await createCommunityNotification(pool, {
      userId: member.user_id,
      actorId,
      actorName,
      kind,
      title,
      body,
      resourceType,
      resourceId: teamId
    })
  }
}

async function requireTeamManager(teamId, userId, response) {
  const role = await getTeamRole(teamId, userId)
  if (!canManageTeam(role)) {
    send(response, 403, { error: 'team owner or administrator access required' })
    return ''
  }
  return role
}

async function handleCommunityRequest(request, response, { createProject } = {}) {
  const url = new URL(request.url || '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  const session = await sessionFor(request)
  const userId = session?.user?.id || ''
  const requireUser = () => {
    if (!userId) {
      send(response, 401, { error: 'authentication required' })
      return false
    }
    return true
  }

  if (!pool || !initialized) {
    send(response, 503, { error: 'Community database is not configured. Set COCKROACH_DATABASE_URL on the API service.' })
    return
  }

  if (request.method === 'GET' && parts.length === 3 && parts[2] === 'projects') {
    const sourceProjectId = (url.searchParams.get('sourceProjectId') || '').trim().slice(0, 80)

    if (sourceProjectId) {
      if (!requireUser()) return

      const ownedProject = await pool.query(
        'SELECT id, source_project_id, owner_id, name, description, language, published_at, featured, stars, forks FROM community_projects WHERE source_project_id = $1 AND owner_id = $2 LIMIT 1',
        [sourceProjectId, userId]
      )

      send(response, 200, { projects: ownedProject.rows })
      return
    }

    const sort = url.searchParams.get('sort') === 'stars' ? 'stars DESC, published_at DESC' : 'featured DESC, published_at DESC'
    const search = (url.searchParams.get('q') || '').trim().slice(0, 80)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 30)))
    const result = await pool.query(
      `SELECT p.id, p.source_project_id, p.owner_id, p.name, p.description, p.language,
              p.published_at, p.featured, p.stars, p.forks,
              (s.user_id IS NOT NULL) AS starred,
              (f.user_id IS NOT NULL) AS favorited,
              (SELECT count(*) FROM community_comments c WHERE c.project_id = p.id) AS comment_count
       FROM community_projects p
       LEFT JOIN community_stars s ON s.project_id = p.id AND s.user_id = $1
       LEFT JOIN community_favorites f ON f.project_id = p.id AND f.user_id = $1
       WHERE ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.description ILIKE '%' || $2 || '%' OR p.language ILIKE '%' || $2 || '%')
       ORDER BY ${sort} LIMIT $3`,
      [userId || null, search, limit]
    )
    send(response, 200, { projects: result.rows })
    return
  }

  if (parts.length < 3 || parts[0] !== 'api' || parts[1] !== 'community') {
    send(response, 404, { error: 'not found' })
    return
  }

  if (parts[2] === 'projects' && parts.length >= 4 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[3])) {
    send(response, 400, { error: 'invalid community project id' })
    return
  }

  if (parts[2] === 'projects' && parts.length === 3 && request.method === 'POST') {
    if (!requireUser()) return
    const payload = await readJsonBody(request, { maxBytes: 16_000 })
    const projectId = typeof payload.projectId === 'string' ? payload.projectId.slice(0, 80) : ''
    if (!projectId) {
      send(response, 400, { error: 'projectId is required' })
      return
    }
    const project = await getOwnedProject(projectId, userId)
    if (!project) {
      send(response, 404, { error: 'project not found' })
      return
    }
    if (Object.keys(project.files).some(isSecretPath)) {
      send(response, 400, { error: 'Remove secret environment files before publishing this project.' })
      return
    }
    const name = String(payload.name || project.name).trim().slice(0, 120)
    const description = normalizeDescription(payload.description)
    if (!name) {
      send(response, 400, { error: 'project name is required' })
      return
    }
    const language = detectLanguage(project.files)
    const result = await pool.query(
      `INSERT INTO community_projects (source_project_id, owner_id, name, description, language)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_project_id) DO UPDATE SET
         name = excluded.name, description = excluded.description, language = excluded.language, updated_at = now()
       WHERE community_projects.owner_id = excluded.owner_id
       RETURNING id, source_project_id, owner_id, name, description, language, published_at, featured, stars, forks`,
      [projectId, userId, name, description, language]
    )
    if (!result.rows[0]) {
      send(response, 409, { error: 'project publication ownership conflict' })
      return
    }
    send(response, 201, { project: result.rows[0] })
    return
  }

  if (parts[2] === 'projects' && parts.length === 4 && request.method === 'DELETE') {
    if (!requireUser()) return
    const result = await pool.query(
      'DELETE FROM community_projects WHERE id = $1 AND owner_id = $2 RETURNING id',
      [parts[3], userId]
    )
    send(response, result.rowCount ? 200 : 404, result.rowCount ? { ok: true } : { error: 'project not found' })
    return
  }

  if (parts[2] === 'projects' && parts.length === 4 && request.method === 'GET') {
    const result = await pool.query(
      `SELECT p.id, p.source_project_id, p.owner_id, p.name, p.description, p.language,
              p.published_at, p.featured, p.stars, p.forks,
              (s.user_id IS NOT NULL) AS starred, (f.user_id IS NOT NULL) AS favorited
       FROM community_projects p
       LEFT JOIN community_stars s ON s.project_id = p.id AND s.user_id = $1
       LEFT JOIN community_favorites f ON f.project_id = p.id AND f.user_id = $1
       WHERE p.id = $2`,
      [userId || null, parts[3]]
    )
    const communityProject = result.rows[0]
    if (!communityProject) {
      send(response, 404, { error: 'project not found' })
      return
    }
    const project = await getOwnedProject(communityProject.source_project_id, communityProject.owner_id)
    if (!project) {
      send(response, 410, { error: 'source project is no longer available' })
      return
    }
    const files = Object.fromEntries(Object.entries(project.files).filter(([path]) => !isSecretPath(path)))
    const comments = await pool.query(
      `SELECT id, author_id, body, created_at FROM community_comments
       WHERE project_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [parts[3]]
    )
    send(response, 200, {
      project: { ...communityProject, files },
      comments: comments.rows.map(comment => ({
        id: comment.id, authorId: comment.author_id, body: comment.body,
        createdAt: comment.created_at, own: comment.author_id === userId
      }))
    })
    return
  }

  if (parts[2] === 'projects' && parts.length === 5 && ['star', 'favorite'].includes(parts[4]) && request.method === 'POST') {
    if (!requireUser()) return
    const table = parts[4] === 'star' ? 'community_stars' : 'community_favorites'
    const column = parts[4] === 'star' ? 'stars' : null
    const exists = await pool.query('SELECT id FROM community_projects WHERE id = $1', [parts[3]])
    if (!exists.rows[0]) {
      send(response, 404, { error: 'project not found' })
      return
    }
    const removed = await pool.query(
      `DELETE FROM ${table} WHERE project_id = $1 AND user_id = $2 RETURNING project_id`,
      [parts[3], userId]
    )
    if (removed.rowCount) {
      if (column) await pool.query('UPDATE community_projects SET stars = greatest(stars - 1, 0) WHERE id = $1', [parts[3]])
      send(response, 200, { active: false })
    } else {
      const added = await pool.query(
        `INSERT INTO ${table} (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING project_id`,
        [parts[3], userId]
      )
      if (column && added.rowCount) await pool.query('UPDATE community_projects SET stars = stars + 1 WHERE id = $1', [parts[3]])
      send(response, 200, { active: true })
    }
    return
  }

  if (parts[2] === 'projects' && parts.length === 5 && parts[4] === 'comments' && request.method === 'POST') {
    if (!requireUser()) return
    const payload = await request.json().catch(() => ({}))
    const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, 2000) : ''
    if (!body) {
      send(response, 400, { error: 'comment body is required' })
      return
    }
    const exists = await pool.query('SELECT id FROM community_projects WHERE id = $1', [parts[3]])
    if (!exists.rows[0]) {
      send(response, 404, { error: 'project not found' })
      return
    }
    const result = await pool.query(
      'INSERT INTO community_comments (project_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, author_id, body, created_at',
      [parts[3], userId, body]
    )
    send(response, 201, { comment: { ...result.rows[0], authorId: userId, createdAt: result.rows[0].created_at } })
    return
  }

  if (parts[2] === 'favorites' && parts.length === 3 && request.method === 'GET') {
    if (!requireUser()) return
    const result = await pool.query(
      `SELECT p.id, p.source_project_id, p.owner_id, p.name, p.description, p.language,
              p.published_at, p.featured, p.stars, p.forks, true AS favorited
       FROM community_favorites f JOIN community_projects p ON p.id = f.project_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT 100`,
      [userId]
    )
    send(response, 200, { projects: result.rows })
    return
  }

  if (parts[2] === 'projects' && parts.length === 5 && parts[4] === 'fork' && request.method === 'POST') {
    if (!requireUser()) return
    const result = await pool.query(
      'SELECT source_project_id, owner_id FROM community_projects WHERE id = $1',
      [parts[3]]
    )
    const source = result.rows[0]
    if (!source) {
      send(response, 404, { error: 'project not found' })
      return
    }
    const project = await getOwnedProject(source.source_project_id, source.owner_id)
    if (!project) {
      send(response, 410, { error: 'source project is no longer available' })
      return
    }
    const files = Object.fromEntries(Object.entries(project.files).filter(([path]) => !isSecretPath(path)))
    if (typeof createProject !== 'function') {
      send(response, 503, { error: 'project creation is unavailable' })
      return
    }
    const forkName = ('Fork of ' + project.name).slice(0, 120)
    const fork = await createProject(userId, { name: forkName, files })
    await pool.query('UPDATE community_projects SET forks = forks + 1 WHERE id = $1', [parts[3]])
    send(response, 201, { project: { id: newId, name: forkName, files } })
    return
  }

  if (parts[2] === 'featured' && parts.length === 3 && request.method === 'GET') {
    const result = await pool.query(
      `SELECT p.id, p.source_project_id, p.owner_id, p.name, p.description, p.language, p.published_at, p.stars, p.forks
       FROM community_projects p WHERE p.featured = true ORDER BY p.featured_at DESC NULLS LAST LIMIT 12`
    )
    send(response, 200, { projects: result.rows })
    return
  }

  if (parts[2] === 'projects' && parts.length === 5 && parts[4] === 'feature' && request.method === 'POST') {
    if (!requireUser()) return
    const adminEmails = (process.env.POLIGO_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
    const adminIds = (process.env.POLIGO_ADMIN_USER_IDS || '').split(',').map(value => value.trim()).filter(Boolean)
    const isAdmin = adminIds.includes(userId) || adminEmails.includes(String(session.user.email || '').toLowerCase())
    if (!isAdmin) {
      send(response, 403, { error: 'administrator access required' })
      return
    }
    const payload = await request.json().catch(() => ({}))
    const featured = payload.featured === true
    const result = await pool.query(
      'UPDATE community_projects SET featured = $1, featured_at = CASE WHEN $1 THEN now() ELSE NULL END WHERE id = $2 RETURNING id, featured',
      [featured, parts[3]]
    )
    send(response, result.rowCount ? 200 : 404, result.rowCount ? { project: result.rows[0] } : { error: 'project not found' })
    return
  }

  send(response, 404, { error: 'not found' })
}

export async function routeCommunityRequest(request, response, dependencies = {}) {
  try {
    await handleCommunityRequest(request, response, dependencies)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'community request failed'
    const status = message === 'authentication required'
      ? 401
      : message.includes('storage limit exceeded')
        ? 409
        : message === 'request too large' || message.includes('required') || message.includes('invalid')
          ? 400
          : 500
    if (status === 500) console.error('Community API request failed', error)
    send(response, status, { error: status === 500 ? 'community request failed' : message })
  }
}
