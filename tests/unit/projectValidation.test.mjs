import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertNoFileDirectoryConflicts,
  isValidProjectFilePath
} from '../../services/api/src/projectValidation.js'

test('accepts normal nested project paths', () => {
  for (const value of [
    'main.js',
    'src/main.js',
    'src/lib/helpers.mjs',
    '.env.example',
    'docs/README.md'
  ]) {
    assert.equal(isValidProjectFilePath(value), true, value)
  }
})

test('rejects traversal, malformed separators, control characters and prototype keys', () => {
  for (const value of [
    '',
    '.',
    '..',
    '../escape.js',
    'src/../escape.js',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    'src\\\\main.js',
    'src//main.js',
    'src/',
    '/src/main.js',
    '__proto__',
    'constructor',
    'main.js' + String.fromCharCode(0) + 'hidden',
    'main.js' + String.fromCharCode(10) + 'next',
    'main.js' + String.fromCharCode(127)
  ]) {
    assert.equal(isValidProjectFilePath(value), false, JSON.stringify(value))
  }
})

test('rejects collisions between a file and its child path', () => {
  assert.throws(
    () => assertNoFileDirectoryConflicts(['src', 'src/main.js']),
    /conflicts with a directory/
  )
  assert.throws(
    () => assertNoFileDirectoryConflicts(['app.js', 'app.js/cache/data.json']),
    /conflicts with a directory/
  )
  assert.doesNotThrow(() => assertNoFileDirectoryConflicts([
    'src/main.js',
    'src/utils.js',
    'public/index.html'
  ]))
})
