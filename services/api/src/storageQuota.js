export const DEFAULT_STORAGE_LIMIT_BYTES = 15 * 1024 * 1024

export const PROJECT_STORAGE_QUOTA_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS trg_project_files_enforce_owner_quota_insert
   BEFORE INSERT ON project_files
   FOR EACH ROW
   WHEN (
     COALESCE((
       SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
       FROM project_files pf
       INNER JOIN projects p ON p.id = pf.project_id
       WHERE p.owner_id = (
         SELECT owner_id FROM projects WHERE id = NEW.project_id
       )
     ), 0) + LENGTH(CAST(NEW.content AS BLOB)) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = (
         SELECT owner_id FROM projects WHERE id = NEW.project_id
       )
     ), 15728640)
   )
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`,
  `CREATE TRIGGER IF NOT EXISTS trg_projects_enforce_owner_quota_update
   BEFORE UPDATE OF owner_id ON projects
   FOR EACH ROW
   WHEN NEW.owner_id <> OLD.owner_id AND (
     COALESCE((
       SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
       FROM project_files pf
       INNER JOIN projects p ON p.id = pf.project_id
       WHERE p.owner_id = NEW.owner_id
     ), 0) + COALESCE((
       SELECT SUM(LENGTH(CAST(pf.content AS BLOB)))
       FROM project_files pf
       WHERE pf.project_id = OLD.id
     ), 0) >
     COALESCE((
       SELECT limit_bytes
       FROM user_storage_limits
       WHERE user_id = NEW.owner_id
     ), 15728640)
   )
   BEGIN
     SELECT RAISE(ABORT, 'storage limit exceeded');
   END`
]
