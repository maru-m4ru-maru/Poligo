export const DEFAULT_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024

const OWNER_STORAGE_BYTES = `(
  COALESCE((
    SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
    FROM project_files pf
    INNER JOIN projects p ON p.id = pf.project_id
    WHERE p.owner_id = %OWNER%
  ), 0) + COALESCE((
    SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
    FROM project_commit_files pcf
    INNER JOIN project_commits pc ON pc.id = pcf.commit_id
    INNER JOIN projects p ON p.id = pc.project_id
    WHERE p.owner_id = %OWNER%
  ), 0)
)`

function ownerStorageFor(ownerExpression) {
  return OWNER_STORAGE_BYTES.replaceAll('%OWNER%', ownerExpression)
}

export const PROJECT_STORAGE_QUOTA_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_enforce_owner_quota_insert
   BEFORE INSERT ON project_files
   FOR EACH ROW
   WHEN ${ownerStorageFor('(SELECT owner_id FROM projects WHERE id = NEW.project_id)')}
        + LENGTH(CAST(NEW.content AS BLOB)) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = (SELECT owner_id FROM projects WHERE id = NEW.project_id)
     ), ${DEFAULT_STORAGE_LIMIT_BYTES})
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_enforce_owner_quota_insert
   BEFORE INSERT ON project_commit_files
   FOR EACH ROW
   WHEN ${ownerStorageFor('(SELECT p.owner_id FROM project_commits pc INNER JOIN projects p ON p.id = pc.project_id WHERE pc.id = NEW.commit_id)')}
        + LENGTH(CAST(NEW.content AS BLOB)) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = (
         SELECT p.owner_id
         FROM project_commits pc
         INNER JOIN projects p ON p.id = pc.project_id
         WHERE pc.id = NEW.commit_id
       )
     ), ${DEFAULT_STORAGE_LIMIT_BYTES})
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_enforce_owner_quota_update
   BEFORE UPDATE OF project_id, path, content ON project_files
   FOR EACH ROW
   WHEN (
     ${ownerStorageFor('(SELECT owner_id FROM projects WHERE id = NEW.project_id)')} -
     CASE
       WHEN (SELECT owner_id FROM projects WHERE id = OLD.project_id) =
            (SELECT owner_id FROM projects WHERE id = NEW.project_id)
       THEN LENGTH(CAST(OLD.content AS BLOB))
       ELSE 0
     END +
     LENGTH(CAST(NEW.content AS BLOB))
   ) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = (SELECT owner_id FROM projects WHERE id = NEW.project_id)
     ), ${DEFAULT_STORAGE_LIMIT_BYTES})
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_enforce_owner_quota_update
   BEFORE UPDATE OF commit_id, path, content ON project_commit_files
   FOR EACH ROW
   WHEN (
     ${ownerStorageFor('(SELECT p.owner_id FROM project_commits pc INNER JOIN projects p ON p.id = pc.project_id WHERE pc.id = NEW.commit_id)')} -
     CASE
       WHEN (
         SELECT p.owner_id
         FROM project_commits pc
         INNER JOIN projects p ON p.id = pc.project_id
         WHERE pc.id = OLD.commit_id
       ) = (
         SELECT p.owner_id
         FROM project_commits pc
         INNER JOIN projects p ON p.id = pc.project_id
         WHERE pc.id = NEW.commit_id
       )
       THEN LENGTH(CAST(OLD.content AS BLOB))
       ELSE 0
     END +
     LENGTH(CAST(NEW.content AS BLOB))
   ) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = (
         SELECT p.owner_id
         FROM project_commits pc
         INNER JOIN projects p ON p.id = pc.project_id
         WHERE pc.id = NEW.commit_id
       )
     ), ${DEFAULT_STORAGE_LIMIT_BYTES})
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_projects_enforce_owner_quota_update
   BEFORE UPDATE OF owner_id ON projects
   FOR EACH ROW
   WHEN NEW.owner_id <> OLD.owner_id AND (
     ${ownerStorageFor('NEW.owner_id')} + COALESCE((
       SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
       FROM project_files pf
       WHERE pf.project_id = OLD.id
     ), 0) + COALESCE((
       SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
       FROM project_commit_files pcf
       INNER JOIN project_commits pc ON pc.id = pcf.commit_id
       WHERE pc.project_id = OLD.id
     ), 0)
   ) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = NEW.owner_id
     ), ${DEFAULT_STORAGE_LIMIT_BYTES})
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`
]
