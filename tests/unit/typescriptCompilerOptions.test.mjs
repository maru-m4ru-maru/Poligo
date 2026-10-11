import assert from 'node:assert/strict'
import test from 'node:test'
import { getTypeScriptCompilerOptions } from '../../services/api/src/typescriptCompilerOptions.js'

test('targets a ES2020 standard library for .ts compilation', () => {
  assert.equal(getTypeScriptCompilerOptions('main.ts'), '--target es2020')
  assert.equal(getTypeScriptCompilerOptions('src/worker.ts'), '--target es2020')
  assert.equal(getTypeScriptCompilerOptions('MAIN.TS'), '--target es2020')
})

test('does not pass TypeScript compiler flags to the JS runtime used by TSX', () => {
  assert.equal(getTypeScriptCompilerOptions('main.tsx'), '')
  assert.equal(getTypeScriptCompilerOptions('Main.TSX'), '')
})

test('requires a string entrypoint', () => {
  assert.throws(() => getTypeScriptCompilerOptions(undefined), TypeError)
  assert.throws(() => getTypeScriptCompilerOptions(null), TypeError)
})
