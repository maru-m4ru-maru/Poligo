import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeEmailAddress,
  normalizeUsername
} from '../../services/api/src/registrationPolicy.js'

const uuid = 'a'.repeat(32)

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
  assert.equal(normalizeEmailAddress('  Person@Gmail.com '), 'person@gmail.com')
})

test('rejects malformed and reserved testing email addresses', () => {
  for (const email of [
    '',
    'person',
    '@gmail.com',
    'person@@gmail.com',
    'person..dots@gmail.com',
    'person@gmail',
    'person@example.invalid',
    'person@example.test',
    'person@example..com',
    'person@-example.com',
    'person@example.c'
  ]) {
    assert.throws(() => normalizeEmailAddress(email), undefined, email)
  }
})

test('rejects example.com addresses even when they imitate generated Poligo E2E accounts', () => {
  for (const email of [
    `poligo-typescript-${uuid}@example.com`,
    `poligo-foo-bar-${uuid}@EXAMPLE.COM`,
    'person@example.com'
  ]) {
    assert.throws(
      () => normalizeEmailAddress(email),
      /使い捨てメールアドレス/,
      email
    )
  }
})

test('rejects common disposable email domains', () => {
  for (const email of [
    'someone@mailinator.com',
    'someone@tempmail.com'
  ]) {
    assert.throws(
      () => normalizeEmailAddress(email),
      /使い捨てメールアドレス/
    )
  }
})
