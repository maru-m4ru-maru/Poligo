import { connect } from '@tursodatabase/serverless'
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret
} from './secretStore.js'

const url = process.env.TURSO_DATABASE_URL || ''
const authToken = process.env.TURSO_AUTH_TOKEN || ''

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
      'CREATE INDEX IF NOT EXISTS idx_project_commit_files_commit_id ON project_commit_files(commit_id)'
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
