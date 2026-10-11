import { connect } from '@tursodatabase/serverless'
import {
  encryptSecret,
  isEncryptedSecret
} from './secretStore.js'

const url = process.env.TURSO_DATABASE_URL || ''
const authToken = process.env.TURSO_AUTH_TOKEN || ''
const DEFAULT_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024

let database = null
let status = 'not_configured'
let error = null

if (url && authToken) {
  database = connect({
    url,
    authToken
  })
  status = 'configured'
}

export function getDatabaseStatus() {
  return {
    status,
    error
  }
}

export function getDatabase() {
  if (!database) {
    throw new Error('Turso is not configured')
  }

  return database
}

export async function initializeDatabase() {
  if (!database) {
    return false
  }

  try {
    await database.batch([
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS project_files (
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        PRIMARY KEY (project_id, path),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id)',
      `CREATE TABLE IF NOT EXISTS user_storage_limits (
        user_id TEXT PRIMARY KEY NOT NULL,
        limit_bytes INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS project_commits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS project_commit_files (
        commit_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        PRIMARY KEY (commit_id, path),
        FOREIGN KEY (commit_id) REFERENCES project_commits(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_project_commits_project_id ON project_commits(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_commit_files_commit_id ON project_commit_files(commit_id)',
      `CREATE TABLE IF NOT EXISTS user_bans (
        user_id TEXT PRIMARY KEY NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        banned_at INTEGER NOT NULL,
        banned_by TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_user_bans_banned_at ON user_bans(banned_at)',
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_user_id TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      )`,
      'CREATE INDEX IF NOT EXISTS idx_announcements_active_created_at ON announcements(active, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_announcements_target_user ON announcements(target_user_id)',
      `CREATE TABLE IF NOT EXISTS terminal_sessions (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        base_files TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        websocket_ticket_hash TEXT NOT NULL DEFAULT '',
        ticket_expires_at INTEGER NOT NULL DEFAULT 0,
        ticket_used INTEGER NOT NULL DEFAULT 1
      )`,
      'CREATE INDEX IF NOT EXISTS idx_terminal_sessions_owner_project ON terminal_sessions(owner_id, project_id)',
      'CREATE INDEX IF NOT EXISTS idx_terminal_sessions_expires_at ON terminal_sessions(expires_at)',
      `CREATE TRIGGER IF NOT EXISTS enforce_project_file_storage_limit
      BEFORE INSERT ON project_files
      BEGIN
        SELECT RAISE(ABORT, 'storage limit exceeded')
        WHERE
          COALESCE((
            SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
            FROM projects p
            JOIN project_files pf ON pf.project_id = p.id
            WHERE p.owner_id = (
              SELECT owner_id FROM projects WHERE id = NEW.project_id
            )
          ), 0) +
          COALESCE((
            SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
            FROM projects p
            JOIN project_commits pc ON pc.project_id = p.id
            JOIN project_commit_files pcf ON pcf.commit_id = pc.id
            WHERE p.owner_id = (
              SELECT owner_id FROM projects WHERE id = NEW.project_id
            )
          ), 0) +
          LENGTH(CAST(NEW.content AS BLOB)) >
          COALESCE((
            SELECT limit_bytes FROM user_storage_limits
            WHERE user_id = (
              SELECT owner_id FROM projects WHERE id = NEW.project_id
            )
          ), ${DEFAULT_STORAGE_LIMIT_BYTES});
      END`,
      `CREATE TRIGGER IF NOT EXISTS enforce_commit_file_storage_limit
      BEFORE INSERT ON project_commit_files
      BEGIN
        SELECT RAISE(ABORT, 'storage limit exceeded')
        WHERE
          COALESCE((
            SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
            FROM projects p
            JOIN project_files pf ON pf.project_id = p.id
            WHERE p.owner_id = (
              SELECT owner_id
              FROM project_commits
              WHERE id = NEW.commit_id
            )
          ), 0) +
          COALESCE((
            SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
            FROM projects p
            JOIN project_commits pc ON pc.project_id = p.id
            JOIN project_commit_files pcf ON pcf.commit_id = pc.id
            WHERE p.owner_id = (
              SELECT owner_id
              FROM project_commits current_commit
              JOIN projects current_project
                ON current_project.id = current_commit.project_id
              WHERE current_commit.id = NEW.commit_id
            )
          ), 0) +
          LENGTH(CAST(NEW.content AS BLOB)) >
          COALESCE((
            SELECT limit_bytes FROM user_storage_limits
            WHERE user_id = (
              SELECT p.owner_id
              FROM project_commits pc
              JOIN projects p ON p.id = pc.project_id
              WHERE pc.id = NEW.commit_id
            )
          ), ${DEFAULT_STORAGE_LIMIT_BYTES});
      END`
    ], 'immediate')

    const secretRows = await database.prepare(
      `SELECT project_id, path, content FROM project_files WHERE path = '.env' OR path LIKE '%.env.%' OR path LIKE '%/.env' OR path LIKE '%/.env.%'`
    )
    const commitSecretRows = await database.prepare(
      `SELECT commit_id, path, content FROM project_commit_files WHERE path = '.env' OR path LIKE '%.env.%' OR path LIKE '%/.env' OR path LIKE '%/.env.%'`
    )
    const files = await secretRows.all()
    const commitFiles = await commitSecretRows.all()

    const secretUpdates = []
    const commitSecretUpdates = []

    for (const file of files) {
      const name = file.path.split('/').pop() || file.path
      const secret =
        name === '.env' ||
        (name.startsWith('.env.') && name !== '.env.example')

      if (secret && !isEncryptedSecret(file.content)) {
        secretUpdates.push({
          sql: 'UPDATE project_files SET content = ? WHERE project_id = ? AND path = ?',
          args: [encryptSecret(file.content), file.project_id, file.path]
        })
      }
    }

    for (const file of commitFiles) {
      const name = file.path.split('/').pop() || file.path
      const secret =
        name === '.env' ||
        (name.startsWith('.env.') && name !== '.env.example')

      if (secret && !isEncryptedSecret(file.content)) {
        commitSecretUpdates.push({
          sql: 'UPDATE project_commit_files SET content = ? WHERE commit_id = ? AND path = ?',
          args: [encryptSecret(file.content), file.commit_id, file.path]
        })
      }
    }

    if (secretUpdates.length) {
      await database.batch(secretUpdates, 'immediate')
    }

    if (commitSecretUpdates.length) {
      await database.batch(commitSecretUpdates, 'immediate')
    }

    status = 'online'
    error = null

    return true
  } catch (reason) {
    status = 'error'
    error = reason instanceof Error ? reason.message : String(reason)
    return false
  }
}
