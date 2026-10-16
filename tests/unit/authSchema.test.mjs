import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureUserUsernameColumn } from '../../services/api/src/authSchema.js'

function createDatabase(initialColumns, options = {}) {
  const columns = new Set(initialColumns)
  let alterCount = 0

  return {
    get alterCount() {
      return alterCount
    },
    async prepare(sql) {
      assert.equal(sql, 'PRAGMA table_info("user")')

      return {
        async all() {
          return [...columns].map(name => ({ name }))
        }
      }
    },
    async batch(statements, mode) {
      assert.equal(mode, 'immediate')
      assert.equal(statements.length, 1)
      assert.equal(statements[0].sql, 'ALTER TABLE "user" ADD COLUMN username TEXT')
      assert.deepEqual(statements[0].args, [])
      alterCount += 1

      if (!options.refuseAlter) {
        columns.add('username')
      }
    }
  }
}

test('adds username to a legacy user table that lacks the column', async () => {
  const database = createDatabase(['id', 'name', 'email'])

  await ensureUserUsernameColumn(database)

  assert.equal(database.alterCount, 1)
})

test('does not run ALTER TABLE when username already exists', async () => {
  const database = createDatabase(['id', 'name', 'email', 'username'])

  await ensureUserUsernameColumn(database)

  assert.equal(database.alterCount, 0)
})

test('fails clearly when the username migration does not take effect', async () => {
  const database = createDatabase(['id', 'name', 'email'], {
    refuseAlter: true
  })

  await assert.rejects(
    ensureUserUsernameColumn(database),
    /user\.username column is missing/
  )

  assert.equal(database.alterCount, 1)
})


import { ensureUserPolicyColumns } from '../../services/api/src/authSchema.js'

function createPolicyDatabase(initialColumns = [], options = {}) {
  const columns = new Set(initialColumns)
  const statements = []

  return {
    columns,
    statements,
    async prepare(sql) {
      assert.equal(sql, 'PRAGMA table_info("user")')
      return {
        async all() {
          return [...columns].map(name => ({ name }))
        }
      }
    },
    async batch(batchStatements, mode) {
      assert.equal(mode, 'immediate')
      assert.equal(batchStatements.length, 1)
      const sql = batchStatements[0].sql
      statements.push(sql)
      const match = sql.match(/^ALTER TABLE "user" ADD COLUMN ([A-Za-z]+) /)
      assert.ok(match, sql)
      if (!options.refuseAlter) columns.add(match[1])
    }
  }
}

test('adds every policy-consent field to a legacy user table', async () => {
  const database = createPolicyDatabase(['id', 'name', 'email', 'username'])

  await ensureUserPolicyColumns(database)

  const expected = [
    'termsAccepted',
    'privacyPolicyAccepted',
    'termsAcceptedAt',
    'privacyPolicyAcceptedAt',
    'termsVersion',
    'privacyPolicyVersion'
  ]

  assert.deepEqual(expected.filter(name => database.columns.has(name)), expected)
  assert.equal(database.statements.length, expected.length)
})

test('policy-consent migration is idempotent', async () => {
  const database = createPolicyDatabase([
    'id',
    'termsAccepted',
    'privacyPolicyAccepted',
    'termsAcceptedAt',
    'privacyPolicyAcceptedAt',
    'termsVersion',
    'privacyPolicyVersion'
  ])

  await ensureUserPolicyColumns(database)

  assert.equal(database.statements.length, 0)
})

test('fails clearly when policy-consent columns cannot be created', async () => {
  const database = createPolicyDatabase(['id'], { refuseAlter: true })

  await assert.rejects(
    ensureUserPolicyColumns(database),
    /user consent columns are missing/
  )
})
