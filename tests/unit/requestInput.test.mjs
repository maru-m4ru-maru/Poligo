import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRequestInputStatus,
  readJsonBody
} from '../../services/api/src/requestInput.js'

function requestFromChunks(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield Buffer.from(chunk)
      }
    }
  }
}

test('parses JSON split across chunks and treats an empty body as an empty object', async () => {
  assert.deepEqual(
    await readJsonBody(requestFromChunks(['{"name":', '"Poligo"}']), 100),
    { name: 'Poligo' }
  )
  assert.deepEqual(await readJsonBody(requestFromChunks([]), 100), {})
})

test('rejects malformed JSON and non-object JSON as client input errors', async () => {
  await assert.rejects(
    readJsonBody(requestFromChunks(['{"unterminated":']), 100),
    error => error.message === 'invalid JSON body' && getRequestInputStatus(error) === 400
  )
  await assert.rejects(
    readJsonBody(requestFromChunks(['[]']), 100),
    error => error.message === 'request body must be a JSON object' && getRequestInputStatus(error) === 400
  )
})

test('enforces request size using byte counts rather than JavaScript string length', async () => {
  await assert.rejects(
    readJsonBody(requestFromChunks(['{"value":"日本語"}']), 10),
    error => error.message === 'request too large' && getRequestInputStatus(error) === 413
  )
})

test('does not misclassify unrelated runtime errors as input errors', () => {
  assert.equal(getRequestInputStatus(new Error('database failed')), null)
})
