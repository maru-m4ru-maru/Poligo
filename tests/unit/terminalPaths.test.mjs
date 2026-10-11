import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeTerminalFilePath,
  normalizeTerminalFiles
} from '../../services/runner/src/terminalPaths.js'

test('accepts ordinary nested files and a valid empty workspace', () => {
  const files = normalizeTerminalFiles({
    'main.js': 'console.log("ok")',
    'src/helper.js': 'export const ok = true'
  })

  assert.equal(Object.getPrototypeOf(files), null)
  assert.equal(files['main.js'], 'console.log("ok")')
  assert.equal(files['src/helper.js'], 'export const ok = true')
  assert.deepEqual(normalizeTerminalFiles({}), Object.create(null))
})

test('rejects traversal, dangerous path segments, control bytes and absolute paths', () => {
  const invalid = [
    '../outside',
    '/etc/passwd',
    'src/../escape',
    'src/./escape',
    'src//escape',
    'src\\escape',
    'main\0js',
    'main\njs',
    '.git/config',
    'node_modules/pkg.js',
    '.terminal-cache/tmp',
    '__proto__/pollute.js',
    'constructor/prototype/pollute.js'
  ]

  for (const path of invalid) {
    assert.throws(() => normalizeTerminalFilePath(path), /invalid file path/)
    assert.throws(
      () => normalizeTerminalFiles({ [path]: 'content' }),
      /invalid file path/
    )
  }
})

test('rejects file and directory collisions regardless of insertion order', () => {
  assert.throws(
    () => normalizeTerminalFiles({ src: 'file', 'src/main.js': 'nested' }),
    /file path conflicts/
  )
  assert.throws(
    () => normalizeTerminalFiles({ 'src/main.js': 'nested', src: 'file' }),
    /file path conflicts/
  )
})

test('enforces file count, UTF-8 byte limits and string-only file contents', () => {
  assert.throws(
    () => normalizeTerminalFiles({ 'a.js': '1', 'b.js': '2' }, { maxFiles: 1 }),
    /too many terminal files/
  )
  assert.throws(
    () => normalizeTerminalFiles({ 'a.js': '日本語' }, { maxBytes: 8 }),
    /terminal workspace is too large/
  )
  assert.throws(
    () => normalizeTerminalFiles({ 'a.js': 123 }),
    /terminal file content must be text/
  )
})
