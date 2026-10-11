import assert from 'node:assert/strict'
import test from 'node:test'
import { createRunnerReadinessProbe } from '../../services/api/src/runnerReadiness.js'

function response(body, ok = true) {
  return {
    ok,
    async json() {
      return body
    }
  }
}

test('recognizes a runner that is ready to execute containers', async () => {
  const isReady = createRunnerReadinessProbe({
    fetchImpl: async () => response({
      status: 'ok',
      service: 'runner',
      terminalReady: true,
      executionReady: true
    })
  })

  assert.equal(await isReady('https://runner.example.test'), true)
})

test('does not confuse a ready process terminal with execution readiness', async () => {
  const isReady = createRunnerReadinessProbe({
    fetchImpl: async () => response({
      status: 'degraded',
      service: 'runner',
      terminalBackend: 'process',
      terminalReady: true,
      executionReady: false
    })
  })

  assert.equal(await isReady('https://runner.example.test'), false)
})

test('fails closed on bad responses and unavailable runners', async () => {
  for (const fetchImpl of [
    async () => response({ service: 'other', executionReady: true }),
    async () => response({ service: 'runner', executionReady: true }, false),
    async () => { throw new Error('connection refused') }
  ]) {
    const isReady = createRunnerReadinessProbe({ fetchImpl })
    assert.equal(await isReady('https://runner.example.test'), false)
  }

  const isReady = createRunnerReadinessProbe({
    fetchImpl: async () => { throw new Error('must not be called') }
  })
  assert.equal(await isReady('not a URL'), false)
  assert.equal(await isReady(''), false)
})

test('caches runner status and shares concurrent health probes', async () => {
  let now = 1_000
  let calls = 0
  let resolveFetch
  const isReady = createRunnerReadinessProbe({
    now: () => now,
    cacheTtlMs: 5_000,
    fetchImpl: async () => {
      calls += 1
      await new Promise(resolve => { resolveFetch = resolve })
      return response({ service: 'runner', executionReady: true })
    }
  })

  const first = isReady('https://runner.example.test')
  const second = isReady('https://runner.example.test')
  await Promise.resolve()
  assert.equal(calls, 1)
  resolveFetch()
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.equal(await isReady('https://runner.example.test'), true)
  assert.equal(calls, 1)

  now += 5_001
  const third = await isReady('https://runner.example.test')
  assert.equal(third, true)
  assert.equal(calls, 2)
})
