import assert from 'node:assert/strict'
import test from 'node:test'
import { saveProject } from '../../apps/web/src/projectStore.js'

test('serializes saves to the same project so a late older response cannot overwrite newer files', async () => {
  const originalFetch = globalThis.fetch
  const originalStorage = globalThis.localStorage
  const values = new Map()
  const calls = []
  let resolveFirstRequest
  let markFirstRequestStarted
  const firstRequestStarted = new Promise(resolve => {
    markFirstRequestStarted = resolve
  })

  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    }
  }

  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body)
    calls.push({ url, payload })

    if (calls.length === 1) {
      markFirstRequestStarted()
      return await new Promise(resolve => {
        resolveFirstRequest = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ ...payload, version: 1 })
        })
      })
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ ...payload, version: 2 })
    }
  }

  try {
    const first = saveProject({
      id: 'project-one',
      name: 'older',
      files: { 'main.js': 'older' }
    })

    await firstRequestStarted

    const second = saveProject({
      id: 'project-one',
      name: 'newer',
      files: { 'main.js': 'newer' }
    })

    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls.length, 1)

    resolveFirstRequest()

    const [firstResult, secondResult] = await Promise.all([first, second])

    assert.equal(firstResult.name, 'older')
    assert.equal(secondResult.name, 'newer')
    assert.deepEqual(calls.map(call => call.payload.name), ['older', 'newer'])
    assert.equal(calls[1].payload.files['main.js'], 'newer')
    assert.equal(values.get('poligo-current-project'), 'project-one')
  } finally {
    globalThis.fetch = originalFetch
    if (originalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = originalStorage
    }
  }
})
