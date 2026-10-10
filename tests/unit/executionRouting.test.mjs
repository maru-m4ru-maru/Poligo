import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldUseJudge0 } from '../../services/api/src/executionRouting.js'

test('uses Judge0 when the execution runner is not configured', () => {
  assert.equal(shouldUseJudge0('python', false), true)
  assert.equal(shouldUseJudge0('typescript', false), true)
})

test('routes TypeScript and TSX language submissions through the API TypeScript pipeline', () => {
  assert.equal(shouldUseJudge0('typescript', true), true)
})

test('keeps runner-supported languages on the execution runner when configured', () => {
  assert.equal(shouldUseJudge0('python', true), false)
  assert.equal(shouldUseJudge0('c', true), false)
  assert.equal(shouldUseJudge0('cpp', true), false)
})
