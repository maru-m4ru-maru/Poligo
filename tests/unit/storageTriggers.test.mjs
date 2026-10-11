import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  STORAGE_LIMIT_TRIGGERS
} from '../../services/api/src/storageTriggers.js'

test('SQLite triggers enforce live-file and commit-snapshot quota within transactions', () => {
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

db.execute("INSERT INTO projects (id, owner_id) VALUES ('project-a', 'alice')")
db.execute("INSERT INTO projects (id, owner_id) VALUES ('project-b', 'bob')")
db.execute("INSERT INTO project_commits (id, project_id) VALUES ('commit-a', 'project-a')")
db.execute("INSERT INTO user_storage_limits (user_id, limit_bytes) VALUES ('alice', 4)")

db.execute("INSERT INTO project_files (project_id, path, content) VALUES ('project-a', 'one.txt', 'ab')")
db.execute("INSERT INTO project_commit_files (commit_id, path, content) VALUES ('commit-a', 'one.txt', 'cd')")

def must_reject(statement, args):
    try:
        db.execute(statement, args)
    except sqlite3.IntegrityError as error:
        if 'storage limit exceeded' not in str(error):
            raise
        return
    raise AssertionError('storage quota trigger allowed an over-limit insert')

must_reject(
    "INSERT INTO project_files (project_id, path, content) VALUES (?, ?, ?)",
    ('project-a', 'overflow.txt', 'x')
)
must_reject(
    "INSERT INTO project_commit_files (commit_id, path, content) VALUES (?, ?, ?)",
    ('commit-a', 'overflow.txt', 'x')
)

db.execute("INSERT INTO project_files (project_id, path, content) VALUES ('project-b', 'large.txt', '0123456789')")
assert db.execute("SELECT COUNT(*) FROM project_files WHERE project_id = 'project-a'").fetchone()[0] == 1
assert db.execute("SELECT COUNT(*) FROM project_commit_files WHERE commit_id = 'commit-a'").fetchone()[0] == 1
assert payload["defaultLimit"] == 15 * 1024 * 1024
print("SQLite storage quota triggers: PASS")
`

  const result = execFileSync('python3', ['-c', script], {
    input: JSON.stringify({
      triggers: STORAGE_LIMIT_TRIGGERS,
      defaultLimit: DEFAULT_STORAGE_LIMIT_BYTES
    }),
    encoding: 'utf8'
  })

  assert.match(result, /SQLite storage quota triggers: PASS/)
})
