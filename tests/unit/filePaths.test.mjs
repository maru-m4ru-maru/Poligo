import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areValidProjectPaths,
  isSafeProjectFilePath
} from '../../apps/web/src/filePaths.js'

test('accepts nested paths used by source files and config', () => {
  assert.equal(isSafeProjectFilePath('src/main.js'), true)
  assert.equal(areValidProjectPaths([
    'src/main.js',
    'src/helper.js',
    'package.json'
  ]), true)
})

test('rejects absolute paths, traversal, separators and control characters', () => {
  for (const path of [
    '',
    '/etc/passwd',
    '../escape.js',
    'src/../escape.js',
    'src//main.js',
    'src/./main.js',
    'src\\main.js',
    'src/line\nfeed.js',
    'src/null\0byte.js',
    'x'.repeat(241)
  ]) {
    assert.equal(isSafeProjectFilePath(path), false, JSON.stringify(path))
  }
})

test('rejects paths that conflict with file and directory names', () => {
  assert.equal(areValidProjectPaths(['src', 'src/main.js']), false)
  assert.equal(areValidProjectPaths(['src/main.js', 'src/main.js/helper.js']), false)
  assert.equal(areValidProjectPaths(['src/a.js', 'src/b.js']), true)
})

test('rejects duplicate paths and malformed input collections', () => {
  assert.equal(areValidProjectPaths(['main.js', 'main.js']), false)
  assert.equal(areValidProjectPaths({ 'main.js': true }), false)
})
