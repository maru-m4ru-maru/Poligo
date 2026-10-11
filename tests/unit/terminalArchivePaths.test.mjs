import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeArchivePath } from '../../services/runner/src/terminal.js'

test('normalizes safe paths emitted by Docker workspace archives', () => {
  assert.equal(normalizeArchivePath('./main.js'), 'main.js')
  assert.equal(normalizeArchivePath('./src/main.mjs'), 'src/main.mjs')
  assert.equal(normalizeArchivePath('workspace'), '')
  assert.equal(normalizeArchivePath('workspace/src/main.js'), 'src/main.js')
  assert.equal(normalizeArchivePath('./workspace/src/main.js'), 'src/main.js')
})

test('drops absolute, traversal, reserved, control-character and malformed archive paths', () => {
  for (const path of [
    '/etc/passwd',
    '../outside.js',
    'workspace/../../etc/passwd',
    './.git/config',
    'node_modules/pkg/index.js',
    'src/__proto__/payload.js',
    'constructor',
    'src//main.js',
    'src/./main.js',
    'src/../main.js',
    'src\\\\main.js',
    'src/line\nfeed.js',
    'a'.repeat(241)
  ]) {
    assert.equal(normalizeArchivePath(path), '', 'expected rejection for ' + JSON.stringify(path))
  }
})
