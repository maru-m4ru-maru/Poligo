import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExecutionLanguage,
  getExecutionTarget
} from '../../apps/web/src/executionLanguage.js'

function nodeProject(extra = {}) {
  return {
    'main.js': 'console.log("Node")',
    'package.json': JSON.stringify({
      type: 'module',
      poligo: {
        runtime: 'node'
      },
      ...extra
    })
  }
}

test('routes Node.js project JavaScript files to the Node runtime', () => {
  const files = nodeProject()

  assert.equal(getExecutionLanguage(files, 'main.js', 'javascript'), 'node')
  assert.deepEqual(getExecutionTarget(files, 'main.js', 'javascript'), {
    language: 'node',
    entrypoint: 'main.js'
  })
})

test('keeps the selected JavaScript file as entrypoint inside a Node project', () => {
  const files = {
    ...nodeProject(),
    'src/helper.mjs': 'console.log("helper")',
    'legacy.cjs': 'console.log("commonjs")'
  }

  assert.equal(getExecutionTarget(files, 'src/helper.mjs', 'javascript').entrypoint, 'src/helper.mjs')
  assert.equal(getExecutionTarget(files, 'legacy.cjs', 'javascript').entrypoint, 'legacy.cjs')
})

test('executes the project entrypoint while package.json or documentation is active', () => {
  const files = nodeProject()

  assert.deepEqual(getExecutionTarget(files, 'package.json', 'json'), {
    language: 'node',
    entrypoint: 'main.js'
  })
  assert.deepEqual(getExecutionTarget(files, 'README.md', 'markdown'), {
    language: 'node',
    entrypoint: 'main.js'
  })
})

test('resolves a declared JavaScript main file before conventional entrypoints', () => {
  const files = {
    'package.json': JSON.stringify({
      main: 'src/server.mjs',
      poligo: { runtime: 'node' }
    }),
    'index.js': 'console.log("index")',
    'src/server.mjs': 'console.log("declared main")'
  }

  assert.equal(
    getExecutionTarget(files, 'package.json', 'json').entrypoint,
    'src/server.mjs'
  )
})

test('falls back to conventional files and then a deterministic JavaScript file', () => {
  assert.equal(getExecutionTarget({
    'index.js': 'console.log("index")',
    'src/index.js': 'console.log("src")',
    'package.json': JSON.stringify({ poligo: { runtime: 'node' } })
  }, 'README.md', 'markdown').entrypoint, 'index.js')

  assert.equal(getExecutionTarget({
    'src/zeta.cjs': 'module.exports = {}',
    'src/alpha.mjs': 'export {}',
    'package.json': JSON.stringify({ poligo: { runtime: 'node' } })
  }, 'package.json', 'json').entrypoint, 'src/alpha.mjs')
})

test('returns an empty Node entrypoint when a Node project has no JavaScript file', () => {
  assert.deepEqual(getExecutionTarget({
    'package.json': JSON.stringify({ poligo: { runtime: 'node' } }),
    'README.md': 'No entrypoint yet'
  }, 'package.json', 'json'), {
    language: 'node',
    entrypoint: ''
  })
})

test('keeps regular browser JavaScript in browser preview mode', () => {
  assert.deepEqual(getExecutionTarget({
    'index.html': '<script src="app.js"></script>',
    'app.js': 'console.log("browser")'
  }, 'app.js', 'javascript'), {
    language: 'javascript',
    entrypoint: 'app.js'
  })
})

test('does not change language for TypeScript without an explicit Node runtime', () => {
  assert.equal(getExecutionLanguage({
    'main.ts': 'console.log("TypeScript")',
    'package.json': JSON.stringify({ poligo: { runtime: 'node' } })
  }, 'main.ts', 'typescript'), 'typescript')
})

test('keeps the editor language when Node.js metadata is missing or invalid', () => {
  assert.equal(getExecutionLanguage({}, 'main.js', 'javascript'), 'javascript')
  assert.equal(getExecutionLanguage({
    'main.js': 'console.log("still JavaScript")',
    'package.json': '{not json'
  }, 'main.js', 'javascript'), 'javascript')
})
