import assert from 'node:assert/strict'
import test from 'node:test'
import { getTypeScriptCompilerOptions } from '../../services/api/src/typescriptCompilerOptions.js'

test('targets a modern JavaScript library for .ts compilation', () => {
  assert.equal(getTypeScriptCompilerOptions('main.ts'), '--target ES2022')
  assert.equal(getTypeScriptCompilerOptions('src/worker.ts'), '--target ES2022')
  assert.equal(getTypeScriptCompilerOptions('MAIN.TS'), '--target ES2022')
})

test('does not pass TypeScript compiler flags to the JS runtime used by TSX', () => {
  assert.equal(getTypeScriptCompilerOptions('main.tsx'), '')
  assert.equal(getTypeScriptCompilerOptions('Main.TSX'), '')
})

test('requires a string entrypoint', () => {
  assert.throws(() => getTypeScriptCompilerOptions(undefined), TypeError)
  assert.throws(() => getTypeScriptCompilerOptions(null), TypeError)
})
