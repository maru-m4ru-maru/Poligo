import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertNoFileDirectoryConflicts,
  normalizeRunnerFilePath
} from '../../services/runner/src/filePaths.js'

test('accepts ordinary relative files including Unicode paths', () => {
  assert.equal(normalizeRunnerFilePath('main.js'), 'main.js')
  assert.equal(normalizeRunnerFilePath('src/機能/helper.mjs'), 'src/機能/helper.mjs')
})

test('rejects traversal, absolute paths, drive letters, controls and reserved components', () => {
  for (const value of [
    '',
    '../outside.js',
    'src/../outside.js',
    '/etc/passwd',
    'C:/Windows/win.ini',
    'src\\\\outside.js',
    'src/./main.js',
    'src//main.js',
    'node_modules/pkg/index.js',
    '.git/config',
    '__proto__',
    'src/constructor',
    'src/line\nfeed.js',
    'src/with\0nul.js'
  ]) {
    assert.throws(() => normalizeRunnerFilePath(value), /invalid file path/)
  }
})

test('rejects file-directory conflicts regardless of insertion order', () => {
  assert.throws(
    () => assertNoFileDirectoryConflicts(['src/main.js', 'src/main.js/helper.js']),
    /file path conflicts with a directory/
  )
  assert.throws(
    () => assertNoFileDirectoryConflicts(['src/main.js/helper.js', 'src/main.js']),
    /file path conflicts with a directory/
  )
  assert.doesNotThrow(() =>
    assertNoFileDirectoryConflicts(['src/main.js', 'src/helper.js'])
  )
})
