import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProjectFileMap } from '../../services/api/src/projectFiles.js'

test('accepts valid relative file paths and UTF-8 text', () => {
  assert.deepEqual(normalizeProjectFileMap({
    'src/main.js': 'console.log("ok")',
    '資料/説明.txt': '日本語'
  }), {
    'src/main.js': 'console.log("ok")',
    '資料/説明.txt': '日本語'
  })
})

test('rejects traversal, absolute paths, backslashes, NUL and ambiguous components', () => {
  const invalidPaths = [
    '../escape.js',
    'src/../escape.js',
    '/etc/passwd',
    'src\\main.js',
    'src//main.js',
    'src/',
    './main.js',
    'bad\0name.js',
    '__proto__'
  ]

  for (const path of invalidPaths) {
    assert.throws(
      () => normalizeProjectFileMap({ [path]: 'content' }),
      /invalid project file path/,
      path
    )
  }
})

test('rejects file and directory path collisions independent of object order', () => {
  assert.throws(
    () => normalizeProjectFileMap({
      src: 'this is a file',
      'src/main.js': 'this requires src to be a directory'
    }),
    /conflicts with a directory/
  )

  assert.throws(
    () => normalizeProjectFileMap({
      'src/main.js': 'this requires src to be a directory',
      src: 'this is a file'
    }),
    /conflicts with a directory/
  )
})

test('enforces per-project file count and UTF-8 byte limits', () => {
  assert.throws(
    () => normalizeProjectFileMap({ a: '1', b: '2' }, { maxFiles: 1 }),
    /too many project files/
  )
  assert.throws(
    () => normalizeProjectFileMap({ a: '日本語' }, { maxBytes: 5 }),
    /project is too large/
  )
})

test('rejects non-object maps and non-text file contents', () => {
  assert.throws(() => normalizeProjectFileMap(null), /project files must be an object/)
  assert.throws(() => normalizeProjectFileMap([]), /project files must be an object/)
  assert.throws(() => normalizeProjectFileMap({ a: 1 }), /project file content must be text/)
})
