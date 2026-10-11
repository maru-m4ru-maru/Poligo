import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { readJsonBody } from '../../packages/protocol/src/requestBody.js'

test('decodes UTF-8 correctly when multibyte code points span stream chunks', async () => {
  const body = Buffer.from(JSON.stringify({
    text: '日本語の入力と絵文字 🧪',
    source: 'console.log("保存済み")'
  }))
  const marker = Buffer.from('日')
  const start = body.indexOf(marker)
  const split = start + 1
  const parsed = await readJsonBody(Readable.from([
    body.subarray(0, split),
    body.subarray(split, split + 3),
    body.subarray(split + 3)
  ]))

  assert.equal(parsed.text, '日本語の入力と絵文字 🧪')
  assert.equal(parsed.source, 'console.log("保存済み")')
})

test('returns an empty object for an empty request body', async () => {
  assert.deepEqual(await readJsonBody(Readable.from([])), {})
})

test('enforces request limits in bytes rather than JavaScript characters', async () => {
  const body = Buffer.from(JSON.stringify({ value: '日本語' }))

  await assert.rejects(
    readJsonBody(Readable.from([body]), {
      maxBytes: body.length - 1
    }),
    /request too large/
  )
})

test('rejects malformed JSON after buffering the complete request', async () => {
  await assert.rejects(
    readJsonBody(Readable.from([Buffer.from('{"text":'), Buffer.from('}')]), {
      maxBytes: 100
    }),
    SyntaxError
  )
})
