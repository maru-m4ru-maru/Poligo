import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeEmailAddress,
  normalizeUsername
} from '../../services/api/src/registrationPolicy.js'

test('normalizes usernames without silently changing their display case', () => {
  assert.equal(normalizeUsername('  maru_m4ru_maru  '), 'maru_m4ru_maru')
})

test('rejects empty, overlong, and control-character usernames', () => {
  assert.throws(() => normalizeUsername(' '), /ユーザー名/)
  assert.throws(() => normalizeUsername('x'), /ユーザー名/)
  assert.throws(() => normalizeUsername('a'.repeat(65)), /ユーザー名/)
  assert.throws(() => normalizeUsername('ok\nnot-ok'), /ユーザー名/)
})

test('normalizes valid email addresses to lowercase', () => {
  assert.equal(normalizeEmailAddress('  Person@Example.com '), 'person@example.com')
})

test('rejects malformed email addresses', () => {
  for (const email of [
    '',
    'person',
    '@example.com',
    'person@@example.com',
    'person..dots@example.com',
    'person@example',
    'person@example..com',
    'person@-example.com',
    'person@example.c'
  ]) {
    assert.throws(() => normalizeEmailAddress(email), undefined, email)
  }
})

test('rejects common disposable email domains', () => {
  assert.throws(
    () => normalizeEmailAddress('someone@mailinator.com'),
    /使い捨てメール/
  )
})
