import { randomUUID } from 'node:crypto'

export function buildProjectUpdateStatements({
  projectId,
  ownerId,
  expectedUpdatedAt,
  updatedAt,
  projectName,
  storedFiles,
  newStorageBytes,
  defaultStorageLimitBytes
}) {
  const writeToken = '__poligo_write_' + randomUUID()
  const statements = [
    {
      sql: `UPDATE projects
        SET name = ?, updated_at = ?
        WHERE id = ?
          AND owner_id = ?
          AND updated_at = ?
          AND (
            SELECT COALESCE(SUM(LENGTH(CAST(pf.content AS BLOB))), 0)
            FROM projects p
            LEFT JOIN project_files pf ON pf.project_id = p.id
            WHERE p.owner_id = ? AND p.id != ?
          ) + ? <= COALESCE(
            (SELECT limit_bytes FROM user_storage_limits WHERE user_id = ?),
            ?
          )`,
      args: [
        writeToken,
        updatedAt,
        projectId,
        ownerId,
        expectedUpdatedAt,
        ownerId,
        projectId,
        newStorageBytes,
        ownerId,
        defaultStorageLimitBytes
      ]
    },
    {
      sql: `DELETE FROM project_files
        WHERE project_id = ?
          AND EXISTS (
            SELECT 1 FROM projects
            WHERE id = ?
              AND owner_id = ?
              AND updated_at = ?
              AND name = ?
          )`,
      args: [
        projectId,
        projectId,
        ownerId,
        updatedAt,
        writeToken
      ]
    }
  ]

  for (const [path, content] of Object.entries(storedFiles)) {
    statements.push({
      sql: `INSERT INTO project_files (project_id, path, content)
        SELECT ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM projects
          WHERE id = ?
            AND owner_id = ?
            AND updated_at = ?
            AND name = ?
        )`,
      args: [
        projectId,
        path,
        content,
        projectId,
        ownerId,
        updatedAt,
        writeToken
      ]
    })
  }

  statements.push({
    sql: `UPDATE projects
      SET name = ?
      WHERE id = ?
        AND owner_id = ?
        AND updated_at = ?
        AND name = ?`,
    args: [
      projectName,
      projectId,
      ownerId,
      updatedAt,
      writeToken
    ]
  })

  return {
    writeToken,
    statements
  }
}

export function buildProjectDeleteStatements({ projectId, ownerId }) {
  return [
    {
      sql: `DELETE FROM project_commit_files
        WHERE commit_id IN (
          SELECT id FROM project_commits
          WHERE project_id = ?
            AND EXISTS (
              SELECT 1 FROM projects
              WHERE id = ? AND owner_id = ?
            )
        )`,
      args: [projectId, projectId, ownerId]
    },
    {
      sql: `DELETE FROM project_commits
        WHERE project_id = ?
          AND EXISTS (
            SELECT 1 FROM projects
            WHERE id = ? AND owner_id = ?
          )`,
      args: [projectId, projectId, ownerId]
    },
    {
      sql: `DELETE FROM project_files
        WHERE project_id = ?
          AND EXISTS (
            SELECT 1 FROM projects
            WHERE id = ? AND owner_id = ?
          )`,
      args: [projectId, projectId, ownerId]
    },
    {
      sql: `DELETE FROM terminal_sessions
        WHERE project_id = ?
          AND owner_id = ?
          AND EXISTS (
            SELECT 1 FROM projects
            WHERE id = ? AND owner_id = ?
          )`,
      args: [projectId, ownerId, projectId, ownerId]
    },
    {
      sql: 'DELETE FROM projects WHERE id = ? AND owner_id = ?',
      args: [projectId, ownerId]
    }
  ]
}
