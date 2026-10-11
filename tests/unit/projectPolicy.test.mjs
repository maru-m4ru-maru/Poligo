import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeProjectFileMap,
  normalizeProjectFilePath,
  normalizeProjectPayload
} from '../../services/api/src/projectPolicy.js'

test('normalizes ordinary project payloads without changing nested files', () => {
  const payload = normalizeProjectPayload({
    name: '  Node app  ',
    files: {
      'main.js': 'console.log("ok")',
      'src/helper.js': 'export const ok = true',
      '.gitignore': 'node_modules/\n'
    }
  })

  assert.equal(payload.name, 'Node app')
  assert.equal(payload.files['main.js'], 'console.log("ok")')
  assert.equal(payload.files['src/helper.js'], 'export const ok = true')
  assert.equal(payload.files['.gitignore'], 'node_modules/\n')
})

test('rejects malformed payloads, project names, and invalid file maps', () => {
  for (const payload of [null, [], 'project', 42]) {
    assert.throws(() => normalizeProjectPayload(payload), /invalid project payload/)
  }

  for (const name of ['', '  ', 'x'.repeat(121), 'name\nadmin', 'name\0']) {
    assert.throws(
      () => normalizeProjectPayload({ name, files: { 'main.js': '' } }),
      /invalid project name/
    )
  }

  for (const files of [null, [], 'main.js', 42]) {
    assert.throws(
      () => normalizeProjectPayload({ name: 'valid', files }),
      /project files must be an object/
    )
  }
})

test('rejects traversal, absolute paths, NUL, control characters, and ambiguous path segments', () => {
  const invalid = [
    '../escape.js',
    '/etc/passwd',
    'src/../main.js',
    'src/./main.js',
    'src//main.js',
    'src/',
    'src\\main.js',
    'main.js\0backup',
    'main\n.js',
    'node_modules/pkg.js',
    '.git/config',
    '.terminal-cache/state',
    '__proto__/pollute.js',
    'constructor/prototype/pollute.js'
  ]

  for (const path of invalid) {
    assert.throws(() => normalizeProjectFilePath(path), /invalid project file path/)
    assert.throws(
      () => normalizeProjectPayload({ name: 'valid', files: { [path]: 'x' } }),
      /invalid project file path/
    )
  }
})

test('rejects file and directory name collisions in either insertion order', () => {
  for (const files of [
    { src: 'file', 'src/main.js': 'nested' },
    { 'src/main.js': 'nested', src: 'file' },
    { 'a/b.js': 'one', 'a/b.js/c.js': 'two' }
  ]) {
    assert.throws(
      () => normalizeProjectFileMap(files),
      /file\/directory conflict/
    )
  }
})

test('enforces file-count and UTF-8 byte limits', () => {
  assert.throws(
    () => normalizeProjectFileMap({
      'a.js': 'x',
      'b.js': 'y'
    }, { maxFiles: 1 }),
    /too many project files/
  )

  assert.throws(
    () => normalizeProjectFileMap({
      'main.js': 'あ'
    }, { maxBytes: 2 }),
    /project is too large/
  )
})

test('keeps prototype-sensitive paths out of normal project file objects', () => {
  const files = normalizeProjectFileMap({
    'main.js': 'ok',
    'src/main.js': 'nested'
  })

  assert.equal(Object.getPrototypeOf(files), null)
  assert.equal(Object.hasOwn(files, '__proto__'), false)
})
