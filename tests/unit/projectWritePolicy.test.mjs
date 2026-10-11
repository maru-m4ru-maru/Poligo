import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProjectDeleteStatements, buildProjectUpdateStatements } from '../../services/api/src/projectWritePolicy.js'

function build(overrides = {}) {
  return buildProjectUpdateStatements({
    projectId: 'project-one',
    ownerId: 'user-one',
    expectedUpdatedAt: 100,
    updatedAt: 101,
    projectName: 'Updated project',
    storedFiles: {
      'main.js': 'console.log("updated")',
      'src/helper.js': 'export const value = 1'
    },
    newStorageBytes: 80,
    defaultStorageLimitBytes: 15 * 1024 * 1024,
    ...overrides
  })
}

test('project write mutations share a unique claim token, including the final rename', () => {
  const first = build()
  const second = build()

  assert.notEqual(first.writeToken, second.writeToken)
  assert.match(first.writeToken, /^__poligo_write_[0-9a-f-]+$/i)

  const firstUpdate = first.statements[0]
  assert.match(firstUpdate.sql, /SET name = \?, updated_at = \?/)
  assert.equal(firstUpdate.args[0], first.writeToken)
  assert.equal(firstUpdate.args[4], 100)

  const mutations = first.statements.slice(1, -1)
  assert.equal(mutations.length, 3)

  for (const statement of mutations) {
    assert.match(statement.sql, /name = \?/)
    assert.ok(statement.args.includes(first.writeToken))
  }

  const finalUpdate = first.statements.at(-1)
  assert.match(finalUpdate.sql, /SET name = \?/)
  assert.equal(finalUpdate.args[0], 'Updated project')
  assert.equal(finalUpdate.args.at(-1), first.writeToken)
})

test('every file insert uses the exact project revision token and owner', () => {
  const { writeToken, statements } = build()
  const inserts = statements.filter(statement =>
    statement.sql.startsWith('INSERT INTO project_files')
  )

  assert.equal(inserts.length, 2)

  for (const statement of inserts) {
    assert.ok(statement.args.includes('project-one'))
    assert.ok(statement.args.includes('user-one'))
    assert.ok(statement.args.includes(writeToken))
    assert.match(statement.sql, /updated_at = \?\s+AND name = \?/)
  }
})

test('empty projects still restore the original project name after claiming the revision', () => {
  const { writeToken, statements } = build({ storedFiles: {} })

  assert.equal(statements.length, 3)
  assert.equal(statements.at(-1).args[0], 'Updated project')
  assert.equal(statements.at(-1).args.at(-1), writeToken)
})

test('project deletion removes history and terminal records before the project row', () => {
  const statements = buildProjectDeleteStatements({
    projectId: 'project-one',
    ownerId: 'user-one'
  })

  assert.equal(statements.length, 5)
  assert.match(statements[0].sql, /DELETE FROM project_commit_files/)
  assert.match(statements[1].sql, /DELETE FROM project_commits/)
  assert.match(statements[2].sql, /DELETE FROM project_files/)
  assert.match(statements[3].sql, /DELETE FROM terminal_sessions/)
  assert.match(statements[4].sql, /DELETE FROM projects WHERE id = \? AND owner_id = \?/)

  for (const statement of statements.slice(0, 4)) {
    assert.match(statement.sql, /EXISTS\s*\(\s*SELECT 1 FROM projects/)
    assert.ok(statement.args.includes('project-one'))
    assert.ok(statement.args.includes('user-one'))
  }

  assert.deepEqual(statements[4].args, ['project-one', 'user-one'])
})
