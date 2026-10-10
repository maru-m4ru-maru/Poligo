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
