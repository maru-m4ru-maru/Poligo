import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEmailAddress } from '../../services/api/src/registrationPolicy.js'

const uuid = 'a'.repeat(32)

test('allows generated Poligo E2E addresses on the reserved example.com domain', () => {
  const email = `poligo-typescript-${uuid}@example.com`

  assert.equal(normalizeEmailAddress(email), email)
  assert.equal(
    normalizeEmailAddress(`  POLIGO-TYPESCRIPT-${uuid}@EXAMPLE.COM  `),
    email
  )
})

test('rejects non-generated example.com addresses and known disposable providers', () => {
  assert.throws(
    () => normalizeEmailAddress('person@example.com'),
    /使い捨てメールアドレス/
  )
  assert.throws(
    () => normalizeEmailAddress('person@mailinator.com'),
    /使い捨てメールアドレス/
  )
})

test('rejects reserved testing top-level domains', () => {
  for (const email of [
    'person@example.invalid',
    'person@example.test',
    'person@example.localhost'
  ]) {
    assert.throws(() => normalizeEmailAddress(email), /形式が正しくありません/)
  }
})
