import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_STORAGE_LIMIT_BYTES,
  PROJECT_STORAGE_QUOTA_TRIGGERS
} from '../../services/api/src/storageQuota.js'

function createDatabase() {
  const database = new DatabaseSync(':memory:')
  database.exec(`
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
    CREATE TABLE user_storage_limits (
      user_id TEXT PRIMARY KEY,
      limit_bytes INTEGER NOT NULL
    );
  `)

  for (const trigger of PROJECT_STORAGE_QUOTA_TRIGGERS) {
    database.exec(trigger)
  }

  return database
}

function addProject(database, id, ownerId) {
  database.prepare(
    'INSERT INTO projects (id, owner_id) VALUES (?, ?)'
  ).run(id, ownerId)
}

function addFile(database, projectId, path, content) {
  database.prepare(
    'INSERT INTO project_files (project_id, path, content) VALUES (?, ?, ?)'
  ).run(projectId, path, content)
}

function setLimit(database, userId, limitBytes) {
  database.prepare(
    'INSERT INTO user_storage_limits (user_id, limit_bytes) VALUES (?, ?)'
  ).run(userId, limitBytes)
}

test('uses the same default storage limit as the API', () => {
  assert.equal(DEFAULT_STORAGE_LIMIT_BYTES, 15 * 1024 * 1024)
})

test('enforces the aggregate user quota across multiple projects', () => {
  const database = createDatabase()

  try {
    addProject(database, 'project-a', 'user-a')
    addProject(database, 'project-b', 'user-a')
    setLimit(database, 'user-a', 5)
    addFile(database, 'project-a', 'a.txt', 'abc')
    addFile(database, 'project-b', 'b.txt', 'de')

    assert.throws(
      () => addFile(database, 'project-b', 'c.txt', 'f'),
      /storage limit exceeded/
    )
  } finally {
    database.close()
  }
})

test('counts UTF-8 bytes and isolates separate users', () => {
  const database = createDatabase()

  try {
    addProject(database, 'project-a', 'user-a')
    addProject(database, 'project-b', 'user-b')
    setLimit(database, 'user-a', 4)
    setLimit(database, 'user-b', 2)
    addFile(database, 'project-a', 'japanese.txt', 'あ')
    addFile(database, 'project-a', 'ascii.txt', 'a')
    addFile(database, 'project-b', 'b.txt', '12')

    assert.throws(
      () => addFile(database, 'project-a', 'overflow.txt', 'x'),
      /storage limit exceeded/
    )

    assert.equal(
      database.prepare(
        'SELECT SUM(LENGTH(CAST(content AS BLOB))) AS bytes FROM project_files WHERE project_id = ?'
      ).get('project-b').bytes,
      2
    )
  } finally {
    database.close()
  }
})

test('allows a project update to replace old files within the same quota', () => {
  const database = createDatabase()

  try {
    addProject(database, 'project-a', 'user-a')
    setLimit(database, 'user-a', 5)
    addFile(database, 'project-a', 'file.txt', '12345')
    database.prepare(
      'DELETE FROM project_files WHERE project_id = ?'
    ).run('project-a')

    addFile(database, 'project-a', 'file.txt', '1234')
    assert.equal(
      database.prepare('SELECT content FROM project_files WHERE project_id = ?').get('project-a').content,
      '1234'
    )
  } finally {
    database.close()
  }
})

test('prevents ownership transfers that would exceed the destination quota', () => {
  const database = createDatabase()

  try {
    addProject(database, 'source-project', 'source-user')
    addProject(database, 'target-project', 'target-user')
    setLimit(database, 'source-user', 10)
    setLimit(database, 'target-user', 6)
    addFile(database, 'source-project', 'source.txt', '1234')
    addFile(database, 'target-project', 'target.txt', '123')

    assert.throws(
      () => database.prepare(
        'UPDATE projects SET owner_id = ? WHERE id = ?'
      ).run('target-user', 'source-project'),
      /storage limit exceeded/
    )

    assert.equal(
      database.prepare('SELECT owner_id FROM projects WHERE id = ?').get('source-project').owner_id,
      'source-user'
    )

    database.prepare(
      'UPDATE user_storage_limits SET limit_bytes = 7 WHERE user_id = ?'
    ).run('target-user')
    database.prepare(
      'UPDATE projects SET owner_id = ? WHERE id = ?'
    ).run('target-user', 'source-project')

    assert.equal(
      database.prepare(
        'SELECT SUM(LENGTH(CAST(pf.content AS BLOB))) AS bytes FROM project_files pf INNER JOIN projects p ON p.id = pf.project_id WHERE p.owner_id = ?'
      ).get('target-user').bytes,
      7
    )
  } finally {
    database.close()
  }
})
