import {
  COMMIT_HISTORY_STORAGE_MULTIPLIER,
  MAX_COMMITS_PER_ACCOUNT,
  MAX_COMMITS_PER_PROJECT
} from './commitRetention.js'

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
      LENGTH(CAST(NEW.content AS BLOB)) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = (
          SELECT owner_id FROM projects WHERE id = NEW.project_id
        )
      ), ${DEFAULT_STORAGE_LIMIT_BYTES});
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_project_file_storage_limit_update
  BEFORE UPDATE OF project_id, path, content ON project_files
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
          AND NOT (pf.project_id = OLD.project_id AND pf.path = OLD.path)
      ), 0) +
      LENGTH(CAST(NEW.content AS BLOB)) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = (
          SELECT owner_id FROM projects WHERE id = NEW.project_id
        )
      ), ${DEFAULT_STORAGE_LIMIT_BYTES});
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_project_owner_transfer_storage_limit
  BEFORE UPDATE OF owner_id ON projects
  WHEN NEW.owner_id != OLD.owner_id
  BEGIN
    SELECT RAISE(ABORT, 'storage limit exceeded')
    WHERE
      COALESCE((
        SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
        FROM projects p
        JOIN project_files pf ON pf.project_id = p.id
        WHERE p.owner_id = NEW.owner_id AND p.id != NEW.id
      ), 0) +
      COALESCE((
        SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
        FROM project_files pf
        WHERE pf.project_id = NEW.id
      ), 0) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = NEW.owner_id
      ), ${DEFAULT_STORAGE_LIMIT_BYTES});

    SELECT RAISE(ABORT, 'commit history storage limit exceeded')
    WHERE
      COALESCE((
        SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
        FROM projects p
        JOIN project_commits pc ON pc.project_id = p.id
        JOIN project_commit_files pcf ON pcf.commit_id = pc.id
        WHERE p.owner_id = NEW.owner_id AND p.id != NEW.id
      ), 0) +
      COALESCE((
        SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
        FROM project_commits pc
        JOIN project_commit_files pcf ON pcf.commit_id = pc.id
        WHERE pc.project_id = NEW.id
      ), 0) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = NEW.owner_id
      ), ${DEFAULT_STORAGE_LIMIT_BYTES}) * ${COMMIT_HISTORY_STORAGE_MULTIPLIER};
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_project_owner_transfer_commit_count_limit
  BEFORE UPDATE OF owner_id ON projects
  WHEN NEW.owner_id != OLD.owner_id
  BEGIN
    SELECT RAISE(ABORT, 'commit history limit exceeded')
    WHERE
      COALESCE((
        SELECT COUNT(*)
        FROM project_commits pc
        JOIN projects p ON p.id = pc.project_id
        WHERE p.owner_id = NEW.owner_id
          AND p.id != NEW.id
      ), 0) +
      COALESCE((
        SELECT COUNT(*)
        FROM project_commits
        WHERE project_id = NEW.id
      ), 0) > ${MAX_COMMITS_PER_ACCOUNT};
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_project_commit_count_limits
  BEFORE INSERT ON project_commits
  BEGIN
    SELECT RAISE(ABORT, 'commit history limit exceeded')
    WHERE
      (SELECT COUNT(*) FROM project_commits WHERE project_id = NEW.project_id) >= ${MAX_COMMITS_PER_PROJECT}
      OR
      (SELECT COUNT(*)
       FROM project_commits pc
       JOIN projects p ON p.id = pc.project_id
       WHERE p.owner_id = (
         SELECT owner_id FROM projects WHERE id = NEW.project_id
       )) >= ${MAX_COMMITS_PER_ACCOUNT};
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_commit_file_storage_limit
  BEFORE INSERT ON project_commit_files
  BEGIN
    SELECT RAISE(ABORT, 'commit history storage limit exceeded')
    WHERE
      COALESCE((
        SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
        FROM projects p
        JOIN project_commits pc ON pc.project_id = p.id
        JOIN project_commit_files pcf ON pcf.commit_id = pc.id
        WHERE p.owner_id = (
          SELECT p2.owner_id
          FROM project_commits pc2
          JOIN projects p2 ON p2.id = pc2.project_id
          WHERE pc2.id = NEW.commit_id
        )
      ), 0) +
      LENGTH(CAST(NEW.content AS BLOB)) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = (
          SELECT p2.owner_id
          FROM project_commits pc2
          JOIN projects p2 ON p2.id = pc2.project_id
          WHERE pc2.id = NEW.commit_id
        )
      ), ${DEFAULT_STORAGE_LIMIT_BYTES}) * ${COMMIT_HISTORY_STORAGE_MULTIPLIER};
  END`,
  `CREATE TRIGGER IF NOT EXISTS enforce_commit_file_storage_limit_update
  BEFORE UPDATE OF commit_id, path, content ON project_commit_files
  BEGIN
    SELECT RAISE(ABORT, 'commit history storage limit exceeded')
    WHERE
      COALESCE((
        SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
        FROM projects p
        JOIN project_commits pc ON pc.project_id = p.id
        JOIN project_commit_files pcf ON pcf.commit_id = pc.id
        WHERE p.owner_id = (
          SELECT p2.owner_id
          FROM project_commits pc2
          JOIN projects p2 ON p2.id = pc2.project_id
          WHERE pc2.id = NEW.commit_id
        )
          AND NOT (pcf.commit_id = OLD.commit_id AND pcf.path = OLD.path)
      ), 0) +
      LENGTH(CAST(NEW.content AS BLOB)) >
      COALESCE((
        SELECT limit_bytes FROM user_storage_limits
        WHERE user_id = (
          SELECT p2.owner_id
          FROM project_commits pc2
          JOIN projects p2 ON p2.id = pc2.project_id
          WHERE pc2.id = NEW.commit_id
        )
      ), ${DEFAULT_STORAGE_LIMIT_BYTES}) * ${COMMIT_HISTORY_STORAGE_MULTIPLIER};
  END`
]
