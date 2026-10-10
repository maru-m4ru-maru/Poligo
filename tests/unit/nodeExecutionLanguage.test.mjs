import assert from 'node:assert/strict'
import test from 'node:test'
import { getExecutionLanguage } from '../../apps/web/src/executionLanguage.js'

test('routes JavaScript files to Node.js only for the explicit Poligo runtime marker', () => {
  const files = {
    'main.js': 'console.log("Node")',
    'package.json': JSON.stringify({
      type: 'module',
      poligo: {
        runtime: 'node'
      }
    })
  }

  assert.equal(getExecutionLanguage(files, 'main.js', 'javascript'), 'node')
  assert.equal(getExecutionLanguage(files, 'src/main.mjs', 'javascript'), 'node')
  assert.equal(getExecutionLanguage(files, 'main.cjs', 'javascript'), 'node')
})

test('keeps regular browser JavaScript in browser preview mode', () => {
  assert.equal(
    getExecutionLanguage({
      'index.html': '<script src="app.js"></script>',
      'app.js': 'console.log("browser")'
    }, 'app.js', 'javascript'),
    'javascript'
  )
})

test('keeps the editor language when Node.js metadata is missing or invalid', () => {
  assert.equal(getExecutionLanguage({}, 'main.js', 'javascript'), 'javascript')
  assert.equal(getExecutionLanguage({
    'main.js': 'console.log("still JavaScript")',
    'package.json': '{not json'
  }, 'main.js', 'javascript'), 'javascript')
  assert.equal(getExecutionLanguage({
    'main.ts': 'console.log("TypeScript")',
    'package.json': JSON.stringify({ poligo: { runtime: 'node' } })
  }, 'main.ts', 'typescript'), 'typescript')
})
