export const DEFAULT_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024

function usageFor(ownerExpression) {
  return `COALESCE((
    SELECT current_bytes + snapshot_bytes
    FROM user_storage_usage
    WHERE user_id = ${ownerExpression}
  ), 0)`
}

function limitFor(ownerExpression) {
  return `COALESCE((
    SELECT limit_bytes
    FROM user_storage_limits
    WHERE user_id = ${ownerExpression}
  ), ${DEFAULT_STORAGE_LIMIT_BYTES})`
}

function projectOwner(projectExpression) {
  return `(SELECT owner_id FROM projects WHERE id = ${projectExpression})`
}

function commitOwner(commitExpression) {
  return `(SELECT p.owner_id
            FROM project_commits pc
            INNER JOIN projects p ON p.id = pc.project_id
            WHERE pc.id = ${commitExpression})`
}

function projectCurrentBytes(projectExpression) {
  return `COALESCE((
    SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
    FROM project_files pf
    WHERE pf.project_id = ${projectExpression}
  ), 0)`
}

function projectSnapshotBytes(projectExpression) {
  return `COALESCE((
    SELECT SUM(LENGTH(CAST(pcf.content AS BLOB)))
    FROM project_commit_files pcf
    INNER JOIN project_commits pc ON pc.id = pcf.commit_id
    WHERE pc.project_id = ${projectExpression}
  ), 0)`
}

function currentFileLength(expression) {
  return `LENGTH(CAST(${expression}.content AS BLOB))`
}

export const PROJECT_STORAGE_QUOTA_TRIGGERS = [
  `CREATE TABLE IF NOT EXISTS user_storage_usage (
    user_id TEXT PRIMARY KEY NOT NULL,
    current_bytes INTEGER NOT NULL DEFAULT 0,
    snapshot_bytes INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_enforce_owner_quota_insert
   BEFORE INSERT ON project_files
   FOR EACH ROW
   WHEN ${usageFor(projectOwner('NEW.project_id'))} +
        ${currentFileLength('NEW')} > ${limitFor(projectOwner('NEW.project_id'))}
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_usage_insert
   AFTER INSERT ON project_files
   FOR EACH ROW
   BEGIN
     INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
     VALUES (${projectOwner('NEW.project_id')}, ${currentFileLength('NEW')}, 0)
     ON CONFLICT(user_id) DO UPDATE SET
       current_bytes = current_bytes + excluded.current_bytes;
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_usage_delete
   AFTER DELETE ON project_files
   FOR EACH ROW
   BEGIN
     UPDATE user_storage_usage
     SET current_bytes = current_bytes - ${currentFileLength('OLD')}
     WHERE user_id = ${projectOwner('OLD.project_id')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_usage_update_same_owner
   AFTER UPDATE OF project_id, path, content ON project_files
   FOR EACH ROW
   WHEN ${projectOwner('OLD.project_id')} = ${projectOwner('NEW.project_id')}
   BEGIN
     UPDATE user_storage_usage
     SET current_bytes = current_bytes - ${currentFileLength('OLD')} +
                         ${currentFileLength('NEW')}
     WHERE user_id = ${projectOwner('NEW.project_id')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_usage_update_new_owner
   AFTER UPDATE OF project_id, path, content ON project_files
   FOR EACH ROW
   WHEN ${projectOwner('OLD.project_id')} <> ${projectOwner('NEW.project_id')}
   BEGIN
     UPDATE user_storage_usage
     SET current_bytes = current_bytes - ${currentFileLength('OLD')}
     WHERE user_id = ${projectOwner('OLD.project_id')};

     INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
     VALUES (${projectOwner('NEW.project_id')}, ${currentFileLength('NEW')}, 0)
     ON CONFLICT(user_id) DO UPDATE SET
       current_bytes = current_bytes + excluded.current_bytes;
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_enforce_owner_quota_insert
   BEFORE INSERT ON project_commit_files
   FOR EACH ROW
   WHEN ${usageFor(commitOwner('NEW.commit_id'))} +
        ${currentFileLength('NEW')} > ${limitFor(commitOwner('NEW.commit_id'))}
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_usage_insert
   AFTER INSERT ON project_commit_files
   FOR EACH ROW
   BEGIN
     INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
     VALUES (${commitOwner('NEW.commit_id')}, 0, ${currentFileLength('NEW')})
     ON CONFLICT(user_id) DO UPDATE SET
       snapshot_bytes = snapshot_bytes + excluded.snapshot_bytes;
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_usage_delete
   AFTER DELETE ON project_commit_files
   FOR EACH ROW
   BEGIN
     UPDATE user_storage_usage
     SET snapshot_bytes = snapshot_bytes - ${currentFileLength('OLD')}
     WHERE user_id = ${commitOwner('OLD.commit_id')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_usage_update_same_owner
   AFTER UPDATE OF commit_id, path, content ON project_commit_files
   FOR EACH ROW
   WHEN ${commitOwner('OLD.commit_id')} = ${commitOwner('NEW.commit_id')}
   BEGIN
     UPDATE user_storage_usage
     SET snapshot_bytes = snapshot_bytes - ${currentFileLength('OLD')} +
                          ${currentFileLength('NEW')}
     WHERE user_id = ${commitOwner('NEW.commit_id')};
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_project_commit_files_usage_update_new_owner
   AFTER UPDATE OF commit_id, path, content ON project_commit_files
   FOR EACH ROW
   WHEN ${commitOwner('OLD.commit_id')} <> ${commitOwner('NEW.commit_id')}
   BEGIN
     UPDATE user_storage_usage
     SET snapshot_bytes = snapshot_bytes - ${currentFileLength('OLD')}
     WHERE user_id = ${commitOwner('OLD.commit_id')};

     INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
     VALUES (${commitOwner('NEW.commit_id')}, 0, ${currentFileLength('NEW')})
     ON CONFLICT(user_id) DO UPDATE SET
       snapshot_bytes = snapshot_bytes + excluded.snapshot_bytes;
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_projects_enforce_owner_quota_update
   BEFORE UPDATE OF owner_id ON projects
   FOR EACH ROW
   WHEN NEW.owner_id <> OLD.owner_id AND (
     ${usageFor('NEW.owner_id')} +
     ${projectCurrentBytes('OLD.id')} +
     ${projectSnapshotBytes('OLD.id')}
   ) > ${limitFor('NEW.owner_id')}
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_projects_storage_usage_update_owner
   AFTER UPDATE OF owner_id ON projects
   FOR EACH ROW
   WHEN NEW.owner_id <> OLD.owner_id
   BEGIN
     UPDATE user_storage_usage
     SET current_bytes = current_bytes - ${projectCurrentBytes('NEW.id')},
         snapshot_bytes = snapshot_bytes - ${projectSnapshotBytes('NEW.id')}
     WHERE user_id = OLD.owner_id;

     INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
     VALUES (
       NEW.owner_id,
       ${projectCurrentBytes('NEW.id')},
       ${projectSnapshotBytes('NEW.id')}
     )
     ON CONFLICT(user_id) DO UPDATE SET
       current_bytes = current_bytes + excluded.current_bytes,
       snapshot_bytes = snapshot_bytes + excluded.snapshot_bytes;
   END`
]

export const STORAGE_USAGE_BOOTSTRAP = [
  `INSERT INTO user_storage_usage (user_id, current_bytes, snapshot_bytes)
   SELECT owner_id, SUM(current_bytes), SUM(snapshot_bytes)
   FROM (
     SELECT
       p.owner_id,
       COALESCE(SUM(LENGTH(CAST(pf.content AS BLOB))), 0) AS current_bytes,
       0 AS snapshot_bytes
     FROM projects p
     LEFT JOIN project_files pf ON pf.project_id = p.id
     GROUP BY p.owner_id

     UNION ALL

     SELECT
       p.owner_id,
       0 AS current_bytes,
       COALESCE(SUM(LENGTH(CAST(pcf.content AS BLOB))), 0) AS snapshot_bytes
     FROM projects p
     LEFT JOIN project_commits pc ON pc.project_id = p.id
     LEFT JOIN project_commit_files pcf ON pcf.commit_id = pc.id
     GROUP BY p.owner_id
   )
   WHERE 1
   GROUP BY owner_id
   ON CONFLICT(user_id) DO UPDATE SET
     current_bytes = excluded.current_bytes,
     snapshot_bytes = excluded.snapshot_bytes`
]
