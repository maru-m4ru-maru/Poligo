import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAiEditsToFiles } from '../../apps/web/src/aiEditPolicy.js'

test('applies exact existing-file edits and safely creates new files', () => {
  const files = {
    'main.js': 'const greeting = "hello"\nconsole.log(greeting)',
    'src/helper.js': 'export const count = 1'
  }
  const result = applyAiEditsToFiles(files, [
    {
      path: 'main.js',
      oldText: 'const greeting = "hello"',
      newText: 'const greeting = "hello, Poligo"'
    },
    {
      path: 'src/new.js',
      oldText: '',
      newText: 'export const ready = true'
    }
  ])

  assert.equal(result.ok, true)
  assert.equal(result.files['main.js'], 'const greeting = "hello, Poligo"\nconsole.log(greeting)')
  assert.equal(result.files['src/new.js'], 'export const ready = true')
  assert.deepEqual(result.changedFiles, ['main.js', 'src/new.js'])
  assert.equal(files['main.js'], 'const greeting = "hello"\nconsole.log(greeting)')
})

test('rejects inherited object keys, traversal, reserved paths, and secret files', () => {
  const files = { 'main.js': 'console.log("safe")' }

  for (const path of [
    '__proto__',
    'constructor',
    'src/prototype/index.js',
    '../outside.js',
    '/tmp/outside.js',
    'src\\helper.js',
    '.git/config',
    'node_modules/pkg/index.js',
    '.env',
    'config/.env.production'
  ]) {
    const result = applyAiEditsToFiles(files, [
      { path, oldText: '', newText: 'malicious' }
    ])
    assert.equal(result.ok, false, 'expected path to be rejected: ' + path)
    assert.equal(Object.prototype.hasOwnProperty.call(files, '__proto__'), false)
  }
})

test('rejects non-unique and stale oldText without partially applying previous edits', () => {
  const files = {
    'main.js': 'value++; value++'
  }
  const result = applyAiEditsToFiles(files, [
    { path: 'new.js', oldText: '', newText: 'export {}' },
    { path: 'main.js', oldText: 'value++', newText: 'value += 1' }
  ])

  assert.equal(result.ok, false)
  assert.match(result.error, /複数箇所/)
  assert.equal(files['new.js'], undefined)
  assert.equal(files['main.js'], 'value++; value++')
})

test('rejects file-directory collisions when creating AI-generated files', () => {
  const result = applyAiEditsToFiles({
    'src/main.js': 'console.log("existing")'
  }, [
    { path: 'src', oldText: '', newText: 'not a directory' }
  ])

  assert.equal(result.ok, false)
  assert.match(result.error, /競合/)
})

test('uses a prototype-safe file map for successful AI edits', () => {
  const result = applyAiEditsToFiles({
    'main.js': 'console.log("before")'
  }, [
    { path: 'main.js', oldText: 'before', newText: 'after' }
  ])

  assert.equal(result.ok, true)
  assert.equal(Object.getPrototypeOf(result.files), null)
  assert.equal(result.files['main.js'], 'console.log("after")')
})

test('keeps empty edit lists as no-op results', () => {
  const files = { 'main.js': 'unchanged' }
  const result = applyAiEditsToFiles(files, [])

  assert.equal(result.ok, true)
  assert.equal(result.files, files)
  assert.deepEqual(result.changedFiles, [])
})
