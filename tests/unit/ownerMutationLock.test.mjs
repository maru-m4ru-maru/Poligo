import assert from 'node:assert/strict'
import test from 'node:test'
import { createKeyedLock } from '../../services/api/src/ownerMutationLock.js'

function deferred() {
  let resolve
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
}

test('serializes mutations for the same account', async () => {
  const withLock = createKeyedLock()
  const firstStarted = deferred()
  const releaseFirst = deferred()
  const events = []

  const first = withLock('user-1', async () => {
    events.push('first-start')
    firstStarted.resolve()
    await releaseFirst.promise
    events.push('first-end')
  })

  await firstStarted.promise

  const second = withLock('user-1', async () => {
    events.push('second-start')
    events.push('second-end')
  })

  await Promise.resolve()
  assert.deepEqual(events, ['first-start'])

  releaseFirst.resolve()
  await Promise.all([first, second])
  assert.deepEqual(events, [
    'first-start',
    'first-end',
    'second-start',
    'second-end'
  ])
})

test('allows different accounts to mutate concurrently', async () => {
  const withLock = createKeyedLock()
  const gate = deferred()
  const events = []

  const first = withLock('user-1', async () => {
    events.push('first-start')
    await gate.promise
    events.push('first-end')
  })

  const second = withLock('user-2', async () => {
    events.push('second-start')
    events.push('second-end')
  })

  await second
  assert.deepEqual(events, ['first-start', 'second-start', 'second-end'])

  gate.resolve()
  await first
  assert.deepEqual(events.at(-1), 'first-end')
})

test('releases a mutation queue after failures', async () => {
  const withLock = createKeyedLock()

  await assert.rejects(
    withLock('user-1', async () => {
      throw new Error('expected failure')
    }),
    /expected failure/
  )

  assert.equal(await withLock('user-1', async () => 'recovered'), 'recovered')
})
