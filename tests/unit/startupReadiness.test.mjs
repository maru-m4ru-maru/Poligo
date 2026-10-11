import assert from 'node:assert/strict'
import test from 'node:test'
import { createStartupReadiness } from '../../services/api/src/startupReadiness.js'

test('startup readiness stays pending until initialization finishes', async () => {
  const readiness = createStartupReadiness()
  let finished = false

  readiness.promise.then(() => {
    finished = true
  })

  await Promise.resolve()
  assert.equal(finished, false)

  assert.equal(readiness.resolve(true), true)
  assert.equal(await readiness.promise, true)
  assert.equal(finished, true)
})

test('startup readiness can report failed initialization exactly once', async () => {
  const readiness = createStartupReadiness()

  assert.equal(readiness.resolve(false), true)
  assert.equal(await readiness.promise, false)
  assert.equal(readiness.resolve(true), false)
  assert.equal(await readiness.promise, false)
})
