import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  STORAGE_LIMIT_TRIGGERS
} from '../../services/api/src/storageTriggers.js'

test('SQLite triggers enforce live quota, commit history quota and commit-count limits atomically', () => {
  const script = String.raw`
import json
import sqlite3
import sys

payload = json.load(sys.stdin)
db = sqlite3.connect(':memory:')
db.executescript("""
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL
);
CREATE TABLE project_files (
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (project_id, path)
);
CREATE TABLE project_commits (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL
);
CREATE TABLE project_commit_files (
  commit_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (commit_id, path)
);
CREATE TABLE user_storage_limits (
  user_id TEXT PRIMARY KEY NOT NULL,
  limit_bytes INTEGER NOT NULL
);
""")

for statement in payload["triggers"]:
    db.execute(statement)

db.execute("INSERT INTO projects (id, owner_id) VALUES ('alice-project', 'alice')")
db.execute("INSERT INTO projects (id, owner_id) VALUES ('bob-project', 'bob')")
db.execute("INSERT INTO user_storage_limits (user_id, limit_bytes) VALUES ('alice', 4)")
db.execute("INSERT INTO user_storage_limits (user_id, limit_bytes) VALUES ('bob', 4)")

db.execute("INSERT INTO project_files (project_id, path, content) VALUES ('alice-project', 'live.txt', 'abcd')")

def must_reject(statement, args, expected):
    try:
        db.execute(statement, args)
    except sqlite3.IntegrityError as error:
        if expected not in str(error):
            raise
        return
    raise AssertionError("trigger allowed an over-limit write: " + expected)

must_reject(
    "INSERT INTO project_files (project_id, path, content) VALUES (?, ?, ?)",
    ("alice-project", "overflow.txt", "x"),
    "storage limit exceeded"
)
db.execute("INSERT INTO project_files (project_id, path, content) VALUES ('bob-project', 'own.txt', 'abcd')")
assert db.execute("SELECT COUNT(*) FROM project_files WHERE project_id = 'alice-project'").fetchone()[0] == 1

db.execute("INSERT INTO project_commits (id, project_id) VALUES ('alice-commit-1', 'alice-project')")
db.execute("INSERT INTO project_commits (id, project_id) VALUES ('alice-commit-2', 'alice-project')")
db.execute("INSERT INTO project_commit_files (commit_id, path, content) VALUES ('alice-commit-1', 'snapshot.txt', '1234')")
db.execute("INSERT INTO project_commit_files (commit_id, path, content) VALUES ('alice-commit-2', 'snapshot.txt', '5678')")
must_reject(
    "INSERT INTO project_commit_files (commit_id, path, content) VALUES (?, ?, ?)",
    ("alice-commit-2", "overflow.txt", "x"),
    "commit history storage limit exceeded"
)
db.execute("INSERT INTO project_commits (id, project_id) VALUES ('bob-commit', 'bob-project')")
db.execute("INSERT INTO project_commit_files (commit_id, path, content) VALUES ('bob-commit', 'snapshot.txt', '12345678')")

db.execute("DELETE FROM project_commit_files WHERE commit_id = 'alice-commit-1'")
db.execute("DELETE FROM project_commits WHERE id = 'alice-commit-1'")
for index in range(3, 52):
    db.execute("INSERT INTO project_commits (id, project_id) VALUES (?, 'alice-project')", ("alice-commit-" + str(index),))
must_reject(
    "INSERT INTO project_commits (id, project_id) VALUES (?, ?)",
    ("alice-commit-overflow", "alice-project"),
    "commit history limit exceeded"
)

# Ownership transfers must not bypass the destination account's live storage cap.
db.execute("INSERT INTO projects (id, owner_id) VALUES ('transfer-project', 'legacy')")
db.execute("INSERT INTO project_files (project_id, path, content) VALUES ('transfer-project', 'file.txt', 'x')")
must_reject(
    "UPDATE projects SET owner_id = 'alice' WHERE id = 'transfer-project'",
    (),
    "storage limit exceeded"
)
assert db.execute("SELECT owner_id FROM projects WHERE id = 'transfer-project'").fetchone()[0] == "legacy"
print("SQLite storage and commit-history triggers: PASS")
`

  const result = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({
      triggers: STORAGE_LIMIT_TRIGGERS,
      defaultLimit: DEFAULT_STORAGE_LIMIT_BYTES
    }),
    encoding: 'utf8'
  })

  assert.match(result, /SQLite storage and commit-history triggers: PASS/)
})
