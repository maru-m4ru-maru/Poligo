export const DEFAULT_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024

export const STORAGE_LIMIT_TRIGGERS = [
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
          SELECT p.owner_id
          FROM project_commits pc
          JOIN projects p ON p.id = pc.project_id
          WHERE pc.id = NEW.commit_id
        )
      ), 0) +
      COALESCE((
        SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
        FROM projects p
        JOIN project_commits pc ON pc.project_id = p.id
        JOIN project_commit_files pcf ON pcf.commit_id = pc.id
        WHERE p.owner_id = (
          SELECT p.owner_id
          FROM project_commits pc
          JOIN projects p ON p.id = pc.project_id
          WHERE pc.id = NEW.commit_id
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
]
