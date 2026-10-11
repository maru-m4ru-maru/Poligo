import assert from 'node:assert/strict'
import test from 'node:test'
import { lookupFileMetadata } from '../../apps/web/src/fileMetadata.js'

test('returns metadata only for explicitly registered extensions', () => {
  const metadata = {
    js: { language: 'javascript', kind: 'js' },
    ts: { language: 'typescript', kind: 'typescript' }
  }

  assert.deepEqual(lookupFileMetadata('js', metadata), {
    language: 'javascript',
    kind: 'js'
  })
  assert.deepEqual(lookupFileMetadata('ts', metadata), {
    language: 'typescript',
    kind: 'typescript'
  })
  assert.equal(lookupFileMetadata('unknown', metadata), null)
})

test('does not treat inherited JavaScript object properties as registered extensions', () => {
  const metadata = {
    js: { language: 'javascript', kind: 'js' }
  }

  for (const extension of [
    'constructor',
    'toString',
    'toLocaleString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
    '__proto__'
  ]) {
    assert.equal(
      lookupFileMetadata(extension, metadata),
      null,
      extension + ' must not resolve through Object.prototype'
    )
  }
})

test('returns null for invalid extension and metadata values', () => {
  assert.equal(lookupFileMetadata(null, { js: true }), null)
  assert.equal(lookupFileMetadata('js', null), null)
  assert.equal(lookupFileMetadata('js', []), null)
})
