import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProjectPayload } from '../../services/api/src/projectValidation.js'

test('normalizes project names and accepts safe nested text files', () => {
  const result = normalizeProjectPayload({
    name: '  New Project  ',
    files: {
      'src/main.js': 'console.log("ok")',
      'package.json': '{"type":"module"}'
    }
  })

  assert.equal(result.name, 'New Project')
  assert.equal(result.files['src/main.js'], 'console.log("ok")')
})

test('rejects empty, absolute, traversal, empty-segment, backslash and control-character paths', () => {
  const paths = [
    '',
    '/absolute.js',
    '../escape.js',
    'src/../escape.js',
    'src//main.js',
    'src/./main.js',
    'src\\main.js',
    'src/line\nfeed.js',
    'src/null\0byte.js'
  ]

  for (const path of paths) {
    assert.throws(
      () => normalizeProjectPayload({ name: 'x', files: { [path]: 'data' } }),
      /invalid project file path/,
      JSON.stringify(path)
    )
  }
})

test('rejects a file path that is also a directory prefix', () => {
  assert.throws(
    () => normalizeProjectPayload({
      name: 'x',
      files: {
        src: 'not a folder',
        'src/main.js': 'console.log("bad layout")'
      }
    }),
    /conflicts with a directory/
  )
})

test('requires a name and string file contents', () => {
  assert.throws(() => normalizeProjectPayload({ name: ' ', files: {} }), /project name is invalid/)
  assert.throws(() => normalizeProjectPayload({ name: 'x', files: { 'main.js': 42 } }), /must be text/)
})

test('enforces file count and content byte quotas', () => {
  const manyFiles = Object.fromEntries(
    Array.from({ length: 201 }, (_, index) => ['file-' + index, ''])
  )
  assert.throws(
    () => normalizeProjectPayload({ name: 'x', files: manyFiles }),
    /too many project files/
  )
  assert.throws(
    () => normalizeProjectPayload({ name: 'x', files: { 'large.txt': 'x'.repeat(5_000_001) } }),
    /project is too large/
  )
})

test('validates the payload envelope and preserves special-looking filenames safely', () => {
  assert.throws(() => normalizeProjectPayload(null), /payload must be an object/)
  assert.throws(() => normalizeProjectPayload([]), /payload must be an object/)
  assert.throws(() => normalizeProjectPayload({
    name: 'Bad\nName',
    files: { 'main.js': '' }
  }), /project name is invalid/)

  const files = Object.fromEntries([
    ['__proto__', 'safe text file'],
    ['constructor', 'safe text file'],
    ['toString', 'safe text file']
  ])
  const result = normalizeProjectPayload({ name: 'Safe', files })

  assert.equal(result.files['__proto__'], 'safe text file')
  assert.equal(result.files.constructor, 'safe text file')
  assert.equal(result.files.toString, 'safe text file')
  assert.equal(Object.keys(result.files).length, 3)
})
