import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasProjectFilePathConflict,
  normalizeProjectFilePath
} from '../../apps/web/src/projectFilePaths.js'

test('accepts relative project paths and preserves nested folders', () => {
  assert.equal(normalizeProjectFilePath('main.js'), 'main.js')
  assert.equal(normalizeProjectFilePath('src/components/App.jsx'), 'src/components/App.jsx')
})

test('rejects absolute, traversal, control-character, overlong and reserved paths', () => {
  for (const path of [
    '',
    '/etc/passwd',
    '../secret',
    'src/../secret',
    'src//main.js',
    'src/.',
    'src/',
    'src\\main.js',
    'main\0js',
    'main\njs',
    'x'.repeat(241),
    '.git/config',
    'node_modules/pkg/index.js',
    '__proto__/pollute.js',
    'constructor/prototype/file.js'
  ]) {
    assert.throws(() => normalizeProjectFilePath(path))
  }
})

test('detects exact file paths and file/directory conflicts', () => {
  const files = {
    'main.js': '',
    'src/App.jsx': '',
    'src/utils/index.js': ''
  }

  assert.equal(hasProjectFilePathConflict(files, 'main.js'), true)
  assert.equal(hasProjectFilePathConflict(files, 'src'), true)
  assert.equal(hasProjectFilePathConflict(files, 'src/App.jsx/child.js'), true)
  assert.equal(hasProjectFilePathConflict(files, 'other.js'), false)
  assert.equal(hasProjectFilePathConflict(files, 'main.js', 'main.js'), false)
})
