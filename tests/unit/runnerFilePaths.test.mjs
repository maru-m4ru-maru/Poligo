import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertNoPathConflicts,
  normalizeRelativeFilePath
} from '../../services/runner/src/filePaths.js'

test('normalizes accepted relative paths without changing their names', () => {
  for (const value of [
    'main.js',
    'src/main.js',
    'docs/README.md',
    'config/settings.json'
  ]) {
    assert.equal(normalizeRelativeFilePath(value), value)
  }
})

test('rejects unsafe, ambiguous and prototype-related paths', () => {
  const values = [
    '',
    '.',
    '..',
    '../escape',
    'src/../escape',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    'src\\main.js',
    'src//main.js',
    'src/',
    '__proto__',
    'src/__proto__/payload',
    'constructor',
    'prototype',
    'main.js' + String.fromCharCode(0) + 'hidden',
    'main.js' + String.fromCharCode(10) + 'next',
    'main.js' + String.fromCharCode(127),
    'x'.repeat(241)
  ]

  for (const value of values) {
    assert.throws(() => normalizeRelativeFilePath(value), /invalid file path/)
  }
})

test('rejects files whose paths conflict with nested files', () => {
  assert.throws(
    () => assertNoPathConflicts(['src', 'src/main.js']),
    /conflicts with a directory/
  )
  assert.throws(
    () => assertNoPathConflicts(['package.json', 'package.json/data']),
    /conflicts with a directory/
  )
  assert.doesNotThrow(() => assertNoPathConflicts([
    'src/main.js',
    'src/helper.js',
    'public/index.html'
  ]))
})
