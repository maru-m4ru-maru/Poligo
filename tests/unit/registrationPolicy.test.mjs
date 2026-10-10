import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeEmailAddress,
  normalizeUsername
} from '../../services/api/src/registrationPolicy.js'

test('accepts usernames with letters, numbers, and underscores', () => {
  assert.equal(normalizeUsername('maru_m4ru_maru'), 'maru_m4ru_maru')
  assert.equal(normalizeUsername('ABC_123'), 'ABC_123')
})

test('rejects invalid, short, overlong, or whitespace usernames', () => {
  for (const username of [
    '',
    'ab',
    'user name',
    'username-',
    '名前',
    'a'.repeat(33),
    'ok\nnot-ok'
  ]) {
    assert.throws(() => normalizeUsername(username), /ユーザー名/)
  }
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
    'person@example.invalid',
    'person@example.test',
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
