import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isExecutionLanguageDisabled,
  normalizeJudge0Language,
  shouldUseJudge0
} from '../../services/api/src/executionRouting.js'

test('uses Judge0 when the execution runner is not configured', () => {
  assert.equal(shouldUseJudge0('python', false), true)
  assert.equal(shouldUseJudge0('typescript', false), true)
  assert.equal(shouldUseJudge0('node', false), true)
})

test('always uses the API TypeScript pipeline for TypeScript and TSX', () => {
  assert.equal(shouldUseJudge0('typescript', true, true), true)
})

test('keeps runner-supported languages on a healthy execution runner', () => {
  assert.equal(shouldUseJudge0('python', true, true), false)
  assert.equal(shouldUseJudge0('c', true, true), false)
  assert.equal(shouldUseJudge0('cpp', true, true), false)
  assert.equal(shouldUseJudge0('node', true, true), false)
})

test('falls back to Judge0 when the configured runner lacks execution capacity', () => {
  for (const language of ['python', 'node', 'go', 'rust', 'java', 'ruby', 'kotlin', 'c', 'cpp', 'csharp']) {
    assert.equal(shouldUseJudge0(language, true, false), true, language)
  }
})

test('maps the Node project runtime to the Judge0 JavaScript runtime', () => {
  assert.equal(normalizeJudge0Language('node'), 'javascript')
  assert.equal(normalizeJudge0Language('javascript'), 'javascript')
  assert.equal(normalizeJudge0Language('typescript'), 'typescript')
})


test('temporarily disables PHP execution regardless of letter case', () => {
  assert.equal(isExecutionLanguageDisabled('php'), true)
  assert.equal(isExecutionLanguageDisabled('PHP'), true)
  assert.equal(isExecutionLanguageDisabled(' Php '), true)
})

test('keeps unrelated execution languages enabled', () => {
  for (const language of ['python', 'node', 'javascript', 'typescript', 'ruby']) {
    assert.equal(isExecutionLanguageDisabled(language), false, language)
  }
})
