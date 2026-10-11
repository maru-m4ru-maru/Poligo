import assert from 'node:assert/strict'
import test from 'node:test'
import {
  withOwnerMutationLock,
  withOwnerMutationLocks
} from '../../services/api/src/ownerMutationLock.js'

test('serializes project mutations for the same account', async () => {
  const order = []
  let releaseFirst
  let startedFirst
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve
  })
  const firstStarted = new Promise(resolve => {
    startedFirst = resolve
  })

  const first = withOwnerMutationLock('alice', async () => {
    order.push('first:start')
    startedFirst()
    await firstGate
    order.push('first:end')
  })
  await firstStarted

  const second = withOwnerMutationLock('alice', async () => {
    order.push('second')
  })

  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(order, ['first:start'])

  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first:start', 'first:end', 'second'])
})

test('does not serialize independent accounts behind each other', async () => {
  let releaseAlice
  const aliceGate = new Promise(resolve => {
    releaseAlice = resolve
  })
  let startedAlice
  const aliceStarted = new Promise(resolve => {
    startedAlice = resolve
  })

  const alice = withOwnerMutationLock('alice', async () => {
    startedAlice()
    await aliceGate
  })
  await aliceStarted

  let bobCompleted = false
  await withOwnerMutationLock('bob', async () => {
    bobCompleted = true
  })

  assert.equal(bobCompleted, true)
  releaseAlice()
  await alice
})

test('releases the account queue after a failed mutation', async () => {
  await assert.rejects(
    withOwnerMutationLock('alice', async () => {
      throw new Error('simulated database failure')
    }),
    /simulated database failure/
  )

  const result = await withOwnerMutationLock('alice', async () => 'recovered')
  assert.equal(result, 'recovered')
})

test('multi-owner locks sort owner identifiers to avoid acquisition-order deadlocks', async () => {
  let active = 0
  let maxActive = 0
  const run = async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 10))
    active -= 1
  }

  await Promise.all([
    withOwnerMutationLocks(['workspace-z', 'user-a'], run),
    withOwnerMutationLocks(['user-a', 'workspace-z'], run)
  ])

  assert.equal(maxActive, 1)
})

test('multi-owner locks deduplicate ids and release every lock after failure', async () => {
  await assert.rejects(
    withOwnerMutationLocks(['alice', 'alice'], async () => {
      throw new Error('multi-owner failure')
    }),
    /multi-owner failure/
  )

  assert.equal(
    await withOwnerMutationLocks(['alice', 'alice'], async () => 'recovered'),
    'recovered'
  )
})

test('rejects invalid multi-owner lock requests', () => {
  assert.throws(() => withOwnerMutationLocks([], () => {}), /valid owner ids/)
  assert.throws(() => withOwnerMutationLocks(['alice', ''], () => {}), /valid owner ids/)
  assert.throws(() => withOwnerMutationLocks(['alice'], null), /valid owner ids/)
})
