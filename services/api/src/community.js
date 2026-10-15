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
  console.log('Poligo community schema initialization started')
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
  console.log('Poligo community schema core tables ready; initializing teams and notifications')
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
      CONSTRAINT community_team_request_status CHECK (status IN ('pending', 'approved', 'rejected'))
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
  console.log('Poligo community schema team tables ready; creating indexes')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_notifications_user_date ON community_notifications (user_id, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_members_user ON community_team_members (user_id, joined_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_teams_discovery ON community_teams (visibility, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_invites_user_status ON community_team_invites (invitee_id, status, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_requests_team_status ON community_team_join_requests (team_id, status, created_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_team_messages_feed ON community_team_messages (team_id, created_at DESC)')

  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_projects_stars ON community_projects (stars DESC, published_at DESC)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_community_comments_project ON community_comments (project_id, created_at DESC)')
  console.log('Poligo community schema indexes ready')
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
  await pool.query(
    'INSERT INTO community_notifications (user_id, actor_id, actor_name, kind, title, body, resource_type, resource_id) SELECT user_id, $2, $3, $4, $5, $6, $7, $1 FROM community_team_members WHERE team_id = $1 AND user_id != $2',
    [
      teamId,
      actorId,
      String(actorName || 'Poligo').slice(0, 80),
      String(kind || 'team_activity').slice(0, 40),
      String(title || 'チームの活動').slice(0, 160),
      String(body || '').slice(0, 3000),
      String(resourceType || 'team').slice(0, 40)
    ]
  )
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

  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (parts[2] === 'invitation-code' && parts.length === 3 && request.method === 'GET') {
    if (!requireUser()) return
    const inviteCode = await ensureInvitationCode(userId, userDisplayName(session))
    send(response, 200, { inviteCode: '#' + inviteCode })
    return
  }

  if (parts[2] === 'notifications' && parts.length === 3 && request.method === 'GET') {
    if (!requireUser()) return
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
    const result = await pool.query(
      'SELECT id, actor_id, actor_name, kind, title, body, resource_type, resource_id, is_read, created_at FROM community_notifications WHERE user_id = $1 AND is_hidden = false AND ($2 = false OR is_read = false) ORDER BY created_at DESC LIMIT 100',
      [userId, unreadOnly]
    )
    const count = await pool.query(
      'SELECT count(*) AS unread_count FROM community_notifications WHERE user_id = $1 AND is_hidden = false AND is_read = false',
      [userId]
    )
    send(response, 200, { notifications: result.rows, unreadCount: Number(count.rows[0]?.unread_count || 0) })
    return
  }

  if (parts[2] === 'notifications' && parts.length === 5 && validUuid.test(parts[3]) && ['read', 'hide'].includes(parts[4]) && request.method === 'POST') {
    if (!requireUser()) return
    const result = await pool.query(
      parts[4] === 'read'
        ? 'UPDATE community_notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id'
        : 'UPDATE community_notifications SET is_read = true, is_hidden = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [parts[3], userId]
    )
    send(response, result.rowCount ? 200 : 404, result.rowCount ? { ok: true } : { error: 'notification not found' })
    return
  }

  if (parts[2] === 'invites' && parts.length === 5 && validUuid.test(parts[3]) && ['accept', 'decline'].includes(parts[4]) && request.method === 'POST') {
    if (!requireUser()) return
    const action = parts[4]
    const result = await withCommunityTransaction(async client => {
      const inviteResult = await client.query(
        "SELECT i.id, i.team_id, i.inviter_id, i.inviter_name, i.invitee_id, i.status, t.name AS team_name FROM community_team_invites i JOIN community_teams t ON t.id = i.team_id WHERE i.id = $1 AND i.invitee_id = $2 AND i.status = 'pending'",
        [parts[3], userId]
      )
      const invite = inviteResult.rows[0]
      if (!invite) return { status: 404, error: 'pending team invite not found' }

      if (action === 'accept') {
        await addTeamMember(client, invite.team_id, userId, userDisplayName(session))
      }
      await client.query(
        'UPDATE community_team_invites SET status = $1, decided_at = now() WHERE id = $2 AND invitee_id = $3',
        [action === 'accept' ? 'accepted' : 'declined', invite.id, userId]
      )
      await client.query(
        'UPDATE community_notifications SET is_read = true WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3',
        [userId, 'team_invite', invite.id]
      )

      const title = action === 'accept' ? 'チーム招待が承認されました' : 'チーム招待が辞退されました'
      const body = action === 'accept'
        ? userDisplayName(session) + ' が「' + invite.team_name + '」に参加しました。'
        : userDisplayName(session) + ' が「' + invite.team_name + '」への招待を辞退しました。'
      await createCommunityNotification(client, {
        userId: invite.inviter_id,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'team_activity',
        title,
        body,
        resourceType: 'team',
        resourceId: invite.team_id
      })
      if (action === 'accept') {
        const members = await client.query(
          'SELECT user_id FROM community_team_members WHERE team_id = $1 AND user_id != $2',
          [invite.team_id, userId]
        )
        for (const member of members.rows) {
          if (member.user_id === invite.inviter_id) continue
          await createCommunityNotification(client, {
            userId: member.user_id,
            actorId: userId,
            actorName: userDisplayName(session),
            kind: 'team_activity',
            title: '新しいメンバーが参加しました',
            body: userDisplayName(session) + ' が「' + invite.team_name + '」に参加しました。',
            resourceType: 'team',
            resourceId: invite.team_id
          })
        }
      }
      return { status: 200, ok: true, action, teamId: invite.team_id }
    })
    send(response, result.status || 200, result)
    return
  }

  if (parts[2] === 'teams' && parts.length === 3 && request.method === 'GET') {
    const search = (url.searchParams.get('q') || '').trim().slice(0, 80)
    const result = await pool.query(
      "SELECT t.id, t.name, t.description, t.visibility, t.join_policy, t.owner_id, t.owner_name, t.created_at, (SELECT count(*) FROM community_team_members m WHERE m.team_id = t.id) AS member_count, mine.role AS my_role, (SELECT r.status FROM community_team_join_requests r WHERE r.team_id = t.id AND r.user_id = $1 ORDER BY r.created_at DESC LIMIT 1) AS my_request_status FROM community_teams t LEFT JOIN community_team_members mine ON mine.team_id = t.id AND mine.user_id = $1 WHERE (t.visibility = 'public' OR mine.user_id IS NOT NULL) AND ($2 = '' OR t.name ILIKE '%' || $2 || '%' OR t.description ILIKE '%' || $2 || '%') ORDER BY t.created_at DESC LIMIT 60",
      [userId || null, search]
    )
    send(response, 200, { teams: result.rows })
    return
  }

  if (parts[2] === 'teams' && parts.length === 3 && request.method === 'POST') {
    if (!requireUser()) return
    const payload = await readJsonBody(request, { maxBytes: 20_000 })
    const name = String(payload.name || '').trim().slice(0, 80)
    const description = normalizeDescription(payload.description)
    const visibility = payload.visibility === 'private' ? 'private' : 'public'
    const joinPolicy = visibility === 'private' ? 'manual' : payload.joinPolicy === 'auto' ? 'auto' : 'manual'
    if (!name) {
      send(response, 400, { error: 'team name is required' })
      return
    }
    const team = await withCommunityTransaction(async client => {
      const created = await client.query(
        'INSERT INTO community_teams (name, description, visibility, join_policy, owner_id, owner_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, description, visibility, join_policy, owner_id, owner_name, created_at',
        [name, description, visibility, joinPolicy, userId, userDisplayName(session)]
      )
      const row = created.rows[0]
      await addTeamMember(client, row.id, userId, userDisplayName(session), 'owner')
      return row
    })
    send(response, 201, { team: { ...team, my_role: 'owner', member_count: 1 } })
    return
  }

  if (parts[2] === 'teams' && parts.length >= 4 && !validUuid.test(parts[3])) {
    send(response, 400, { error: 'invalid team id' })
    return
  }

  if (parts[2] === 'teams' && parts.length === 4 && request.method === 'GET') {
    const result = await pool.query(
      'SELECT id, name, description, visibility, join_policy, owner_id, owner_name, created_at, updated_at, (SELECT count(*) FROM community_team_members m WHERE m.team_id = community_teams.id) AS member_count FROM community_teams WHERE id = $1',
      [parts[3]]
    )
    const team = result.rows[0]
    if (!team) {
      send(response, 404, { error: 'team not found' })
      return
    }
    const role = await getTeamRole(team.id, userId)
    if (team.visibility === 'private' && !role) {
      send(response, 404, { error: 'team not found' })
      return
    }
    const pending = userId
      ? await pool.query("SELECT status FROM community_team_join_requests WHERE team_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1", [team.id, userId])
      : { rows: [] }
    const members = await pool.query(
      'SELECT user_id, display_name, role, joined_at FROM community_team_members WHERE team_id = $1 ORDER BY CASE role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, joined_at ASC',
      [team.id]
    )
    const responseBody = {
      team: { ...team, my_role: role, is_member: Boolean(role), my_request_status: pending.rows[0]?.status || '' },
      members: members.rows
    }
    if (canManageTeam(role)) {
      const requests = await pool.query(
        "SELECT id, user_id, display_name, status, created_at FROM community_team_join_requests WHERE team_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 100",
        [team.id]
      )
      responseBody.requests = requests.rows
    } else {
      responseBody.requests = []
    }
    send(response, 200, responseBody)
    return
  }

  if (parts[2] === 'teams' && parts.length === 4 && request.method === 'PATCH') {
    if (!requireUser()) return
    const role = await requireTeamManager(parts[3], userId, response)
    if (!role) return
    const payload = await readJsonBody(request, { maxBytes: 20_000 })
    const name = String(payload.name || '').trim().slice(0, 80)
    const description = normalizeDescription(payload.description)
    const visibility = payload.visibility === 'private' ? 'private' : 'public'
    const joinPolicy = visibility === 'private' ? 'manual' : payload.joinPolicy === 'auto' ? 'auto' : 'manual'
    if (!name) {
      send(response, 400, { error: 'team name is required' })
      return
    }
    const updated = await pool.query(
      'UPDATE community_teams SET name = $1, description = $2, visibility = $3, join_policy = $4, updated_at = now() WHERE id = $5 RETURNING id, name, description, visibility, join_policy, owner_id, owner_name, created_at, updated_at',
      [name, description, visibility, joinPolicy, parts[3]]
    )
    send(response, updated.rowCount ? 200 : 404, updated.rowCount ? { team: updated.rows[0] } : { error: 'team not found' })
    return
  }

  if (parts[2] === 'teams' && parts.length === 4 && request.method === 'DELETE') {
    if (!requireUser()) return
    const role = await getTeamRole(parts[3], userId)
    if (role !== 'owner') {
      send(response, 403, { error: 'only the team owner can delete a team' })
      return
    }
    const team = await pool.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
    const members = await pool.query('SELECT user_id FROM community_team_members WHERE team_id = $1 AND user_id != $2', [parts[3], userId])
    for (const member of members.rows) {
      await createCommunityNotification(pool, {
        userId: member.user_id,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'team_activity',
        title: 'チームが削除されました',
        body: '「' + (team.rows[0]?.name || 'チーム') + '」はオーナーによって削除されました。',
        resourceType: 'team',
        resourceId: parts[3]
      })
    }
    await pool.query('DELETE FROM community_teams WHERE id = $1', [parts[3]])
    send(response, 200, { ok: true })
    return
  }

  if (parts[2] === 'teams' && parts.length === 5 && parts[4] === 'join' && request.method === 'POST') {
    if (!requireUser()) return
    const result = await pool.query('SELECT id, name, description, visibility, join_policy, owner_id FROM community_teams WHERE id = $1', [parts[3]])
    const team = result.rows[0]
    if (!team || team.visibility !== 'public') {
      send(response, 404, { error: 'public team not found' })
      return
    }
    const role = await getTeamRole(team.id, userId)
    if (role) {
      send(response, 200, { joined: true, teamId: team.id })
      return
    }
    const previous = await pool.query(
      "SELECT id FROM community_team_join_requests WHERE team_id = $1 AND user_id = $2 AND status = 'pending' LIMIT 1",
      [team.id, userId]
    )
    if (previous.rows[0]) {
      send(response, 200, { pending: true, teamId: team.id })
      return
    }
    if (team.join_policy === 'auto') {
      await withCommunityTransaction(async client => {
        await addTeamMember(client, team.id, userId, userDisplayName(session))
      })
      await notifyTeamMembers(team.id, userId, userDisplayName(session), 'team_activity', '新しいメンバーが参加しました', userDisplayName(session) + ' が「' + team.name + '」に参加しました。')
      send(response, 201, { joined: true, teamId: team.id })
      return
    }
    await withCommunityTransaction(async client => {
      await client.query(
        "INSERT INTO community_team_join_requests (team_id, user_id, display_name, status) VALUES ($1, $2, $3, 'pending')",
        [team.id, userId, userDisplayName(session)]
      )
      const managers = await getTeamManagerIds(team.id, client)
      for (const manager of managers) {
        await createCommunityNotification(client, {
          userId: manager.user_id,
          actorId: userId,
          actorName: userDisplayName(session),
          kind: 'team_join_request',
          title: 'チームへの参加申請',
          body: userDisplayName(session) + ' が「' + team.name + '」への参加を申請しました。',
          resourceType: 'team',
          resourceId: team.id
        })
      }
    })
    send(response, 201, { pending: true, teamId: team.id })
    return
  }

  if (parts[2] === 'teams' && parts.length === 5 && parts[4] === 'invites' && request.method === 'POST') {
    if (!requireUser()) return
    const role = await requireTeamManager(parts[3], userId, response)
    if (!role) return
    const payload = await readJsonBody(request, { maxBytes: 8_000 })
    const inviteCode = String(payload.inviteCode || '').trim().replace(/^#/, '').toUpperCase().slice(0, 5)
    if (!inviteCode) {
      send(response, 400, { error: 'invitation ID is required' })
      return
    }
    const targetResult = await pool.query('SELECT user_id, display_name FROM community_user_codes WHERE invite_code = $1', [inviteCode])
    const target = targetResult.rows[0]
    if (!target) {
      send(response, 404, { error: 'invitation ID not found' })
      return
    }
    if (target.user_id === userId) {
      send(response, 400, { error: 'you cannot invite yourself' })
      return
    }
    if (await getTeamRole(parts[3], target.user_id)) {
      send(response, 409, { error: 'that user is already a team member' })
      return
    }
    const pendingInvite = await pool.query(
      "SELECT id FROM community_team_invites WHERE team_id = $1 AND invitee_id = $2 AND status = 'pending' LIMIT 1",
      [parts[3], target.user_id]
    )
    if (pendingInvite.rows[0]) {
      send(response, 409, { error: 'a pending invite already exists for that user' })
      return
    }
    const teamResult = await pool.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
    if (!teamResult.rows[0]) {
      send(response, 404, { error: 'team not found' })
      return
    }
    const invite = await withCommunityTransaction(async client => {
      const created = await client.query(
        "INSERT INTO community_team_invites (team_id, inviter_id, inviter_name, invitee_id, invitee_name, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, team_id, invitee_id, status, created_at",
        [parts[3], userId, userDisplayName(session), target.user_id, target.display_name]
      )
      const row = created.rows[0]
      await createCommunityNotification(client, {
        userId: target.user_id,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'team_invite',
        title: 'チームへの招待が届きました',
        body: userDisplayName(session) + ' が「' + teamResult.rows[0].name + '」に招待しました。',
        resourceType: 'team_invite',
        resourceId: row.id
      })
      return row
    })
    send(response, 201, { invite })
    return
  }

  if (parts[2] === 'teams' && parts.length === 6 && parts[4] === 'requests' && validUuid.test(parts[5]) && request.method === 'PATCH') {
    if (!requireUser()) return
    const role = await requireTeamManager(parts[3], userId, response)
    if (!role) return
    const payload = await readJsonBody(request, { maxBytes: 4_000 })
    const action = payload.action
    if (!['approve', 'reject'].includes(action)) {
      send(response, 400, { error: 'action must be approve or reject' })
      return
    }
    const outcome = await withCommunityTransaction(async client => {
      const requestResult = await client.query(
        "SELECT id, user_id, display_name FROM community_team_join_requests WHERE id = $1 AND team_id = $2 AND status = 'pending'",
        [parts[5], parts[3]]
      )
      const joinRequest = requestResult.rows[0]
      if (!joinRequest) return { status: 404, error: 'pending join request not found' }
      const updated = await client.query(
        'UPDATE community_team_join_requests SET status = $1, decided_at = now() WHERE id = $2 RETURNING id',
        [action === 'approve' ? 'approved' : 'rejected', joinRequest.id]
      )
      if (!updated.rowCount) return { status: 404, error: 'pending join request not found' }
      let teamName = 'チーム'
      const teamResult = await client.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
      if (teamResult.rows[0]) teamName = teamResult.rows[0].name
      if (action === 'approve') await addTeamMember(client, parts[3], joinRequest.user_id, joinRequest.display_name)
      await createCommunityNotification(client, {
        userId: joinRequest.user_id,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'team_activity',
        title: action === 'approve' ? 'チームへの参加が承認されました' : 'チームへの参加申請が拒否されました',
        body: action === 'approve' ? '「' + teamName + '」への参加が承認されました。' : '「' + teamName + '」への参加申請は承認されませんでした。',
        resourceType: 'team',
        resourceId: parts[3]
      })
      return { status: 200, ok: true, action, userId: joinRequest.user_id }
    })
    send(response, outcome.status || 200, outcome)
    return
  }

  if (parts[2] === 'teams' && parts.length === 5 && parts[4] === 'leave' && request.method === 'POST') {
    if (!requireUser()) return
    const role = await getTeamRole(parts[3], userId)
    if (!role) {
      send(response, 404, { error: 'team membership not found' })
      return
    }
    if (role === 'owner') {
      send(response, 409, { error: 'the owner must transfer ownership or delete the team before leaving' })
      return
    }
    const team = await pool.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
    await pool.query('DELETE FROM community_team_members WHERE team_id = $1 AND user_id = $2', [parts[3], userId])
    await notifyTeamMembers(parts[3], userId, userDisplayName(session), 'team_activity', 'メンバーがチームを退出しました', userDisplayName(session) + ' が「' + (team.rows[0]?.name || 'チーム') + '」を退出しました。')
    send(response, 200, { ok: true })
    return
  }

  if (parts[2] === 'teams' && parts.length === 6 && parts[4] === 'members' && request.method === 'PATCH') {
    if (!requireUser()) return
    const role = await getTeamRole(parts[3], userId)
    if (role !== 'owner') {
      send(response, 403, { error: 'only the team owner can change member roles' })
      return
    }
    const payload = await readJsonBody(request, { maxBytes: 4_000 })
    const newRole = payload.role
    if (!['admin', 'member'].includes(newRole)) {
      send(response, 400, { error: 'role must be admin or member' })
      return
    }
    if (parts[5] === userId) {
      send(response, 400, { error: 'the owner role cannot be changed here' })
      return
    }
    const member = await pool.query(
      'UPDATE community_team_members SET role = $1 WHERE team_id = $2 AND user_id = $3 AND role != $4 RETURNING user_id, display_name, role',
      [newRole, parts[3], parts[5], 'owner']
    )
    if (!member.rows[0]) {
      send(response, 404, { error: 'team member not found' })
      return
    }
    const team = await pool.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
    await createCommunityNotification(pool, {
      userId: parts[5],
      actorId: userId,
      actorName: userDisplayName(session),
      kind: 'team_activity',
      title: newRole === 'admin' ? 'チーム管理者に任命されました' : 'チーム管理者の権限が変更されました',
      body: '「' + (team.rows[0]?.name || 'チーム') + '」での役割が「' + (newRole === 'admin' ? '管理者' : 'メンバー') + '」に変更されました。',
      resourceType: 'team',
      resourceId: parts[3]
    })
    send(response, 200, { member: member.rows[0] })
    return
  }

  if (parts[2] === 'teams' && parts.length === 6 && parts[4] === 'members' && request.method === 'DELETE') {
    if (!requireUser()) return
    const role = await requireTeamManager(parts[3], userId, response)
    if (!role) return
    if (parts[5] === userId) {
      send(response, 400, { error: 'use the leave action to remove yourself' })
      return
    }
    const targetRole = await getTeamRole(parts[3], parts[5])
    if (!targetRole || targetRole === 'owner' || (targetRole === 'admin' && role !== 'owner')) {
      send(response, 403, { error: 'that member cannot be removed by your role' })
      return
    }
    await pool.query('DELETE FROM community_team_members WHERE team_id = $1 AND user_id = $2', [parts[3], parts[5]])
    await createCommunityNotification(pool, {
      userId: parts[5],
      actorId: userId,
      actorName: userDisplayName(session),
      kind: 'team_activity',
      title: 'チームメンバーから外されました',
      body: '管理者によってチームから外されました。',
      resourceType: 'team',
      resourceId: parts[3]
    })
    send(response, 200, { ok: true })
    return
  }

  if (parts[2] === 'teams' && parts.length === 5 && parts[4] === 'messages' && request.method === 'GET') {
    if (!requireUser()) return
    const role = await getTeamRole(parts[3], userId)
    if (!role) {
      send(response, 403, { error: 'team membership required' })
      return
    }
    const recipientId = (url.searchParams.get('recipientId') || '').trim().slice(0, 128)
    let result
    if (recipientId) {
      if (!(await getTeamRole(parts[3], recipientId))) {
        send(response, 404, { error: 'team member not found' })
        return
      }
      result = await pool.query(
        'SELECT id, team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body, created_at FROM (SELECT id, team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body, created_at FROM community_team_messages WHERE team_id = $1 AND kind = \'dm\' AND ((sender_id = $2 AND recipient_id = $3) OR (sender_id = $3 AND recipient_id = $2)) ORDER BY created_at DESC LIMIT 100) recent_messages ORDER BY created_at ASC',
        [parts[3], userId, recipientId]
      )
    } else {
      result = await pool.query(
        "SELECT id, team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body, created_at FROM (SELECT id, team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body, created_at FROM community_team_messages WHERE team_id = $1 AND kind IN ('message', 'announcement') ORDER BY created_at DESC LIMIT 100) recent_messages ORDER BY created_at ASC",
        [parts[3]]
      )
    }
    send(response, 200, { messages: result.rows })
    return
  }

  if (parts[2] === 'teams' && parts.length === 5 && parts[4] === 'messages' && request.method === 'POST') {
    if (!requireUser()) return
    const role = await getTeamRole(parts[3], userId)
    if (!role) {
      send(response, 403, { error: 'team membership required' })
      return
    }
    const payload = await readJsonBody(request, { maxBytes: 8_000 })
    const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, 3000) : ''
    if (!body) {
      send(response, 400, { error: 'message body is required' })
      return
    }
    let kind = payload.kind === 'announcement' ? 'announcement' : 'message'
    const recipientId = typeof payload.recipientId === 'string' ? payload.recipientId.trim().slice(0, 128) : ''
    if (recipientId) kind = 'dm'
    if (kind === 'announcement' && !canManageTeam(role)) {
      send(response, 403, { error: 'team owner or administrator access required to send an announcement' })
      return
    }
    let recipientName = ''
    if (kind === 'dm') {
      if (!recipientId || recipientId === userId) {
        send(response, 400, { error: 'a different team member is required for direct messages' })
        return
      }
      const target = await pool.query(
        'SELECT display_name FROM community_team_members WHERE team_id = $1 AND user_id = $2',
        [parts[3], recipientId]
      )
      if (!target.rows[0]) {
        send(response, 404, { error: 'team member not found' })
        return
      }
      recipientName = target.rows[0].display_name
    }
    const inserted = await pool.query(
      'INSERT INTO community_team_messages (team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, team_id, sender_id, sender_name, kind, recipient_id, recipient_name, body, created_at',
      [parts[3], userId, userDisplayName(session), kind, kind === 'dm' ? recipientId : null, recipientName, body]
    )
    const message = inserted.rows[0]
    if (kind === 'dm') {
      await createCommunityNotification(pool, {
        userId: recipientId,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'team_dm',
        title: 'チームメンバーから DM が届きました',
        body: body.slice(0, 500),
        resourceType: 'team',
        resourceId: parts[3]
      })
    } else {
      const team = await pool.query('SELECT name FROM community_teams WHERE id = $1', [parts[3]])
      const isAnnouncement = kind === 'announcement'
      await notifyTeamMembers(
        parts[3],
        userId,
        userDisplayName(session),
        isAnnouncement ? 'team_announcement' : 'team_message',
        isAnnouncement ? 'チーム全体通知: ' + (team.rows[0]?.name || 'チーム') : 'チームに新しいメッセージがあります',
        body,
        'team'
      )
    }
    send(response, 201, { message })
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
    const exists = await pool.query('SELECT id, owner_id, name FROM community_projects WHERE id = $1', [parts[3]])
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
      if (column && added.rowCount) {
        await pool.query('UPDATE community_projects SET stars = stars + 1 WHERE id = $1', [parts[3]])
        if (exists.rows[0].owner_id !== userId) {
          await createCommunityNotification(pool, {
            userId: exists.rows[0].owner_id,
            actorId: userId,
            actorName: userDisplayName(session),
            kind: 'project_star',
            title: '作品にスターが付きました',
            body: userDisplayName(session) + ' が「' + exists.rows[0].name + '」にスターしました。',
            resourceType: 'community_project',
            resourceId: parts[3]
          })
        }
      }
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
    const exists = await pool.query('SELECT id, owner_id, name FROM community_projects WHERE id = $1', [parts[3]])
    if (!exists.rows[0]) {
      send(response, 404, { error: 'project not found' })
      return
    }
    const result = await pool.query(
      'INSERT INTO community_comments (project_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, author_id, body, created_at',
      [parts[3], userId, body]
    )
    if (exists.rows[0].owner_id !== userId) {
      await createCommunityNotification(pool, {
        userId: exists.rows[0].owner_id,
        actorId: userId,
        actorName: userDisplayName(session),
        kind: 'project_comment',
        title: '作品に意見が届きました',
        body: userDisplayName(session) + ' が「' + exists.rows[0].name + '」にコメントしました: ' + body,
        resourceType: 'community_project',
        resourceId: parts[3]
      })
    }
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
