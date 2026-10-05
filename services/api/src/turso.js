import { connect } from '@tursodatabase/serverless'

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

    status = 'online'
    error = null

    return true
  } catch (reason) {
    status = 'error'
    error = reason instanceof Error ? reason.message : String(reason)
    return false
  }
}
