import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPolicyConsentFields,
  TERMS_VERSION,
  PRIVACY_POLICY_VERSION
} from '../../services/api/src/policyConsent.js'

test('records accepted policies, timestamps, and the published versions', () => {
  const acceptedAt = new Date('2026-10-16T00:00:00.000Z')
  const result = createPolicyConsentFields({
    termsAccepted: true,
    privacyPolicyAccepted: true
  }, acceptedAt)

  assert.deepEqual(result, {
    termsAccepted: true,
    privacyPolicyAccepted: true,
    termsAcceptedAt: '2026-10-16T00:00:00.000Z',
    privacyPolicyAcceptedAt: '2026-10-16T00:00:00.000Z',
    termsVersion: TERMS_VERSION,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION
  })
})

test('rejects a missing or unchecked policy consent', () => {
  for (const value of [
    {},
    { termsAccepted: true },
    { privacyPolicyAccepted: true },
    { termsAccepted: false, privacyPolicyAccepted: true },
    { termsAccepted: true, privacyPolicyAccepted: false }
  ]) {
    assert.throws(
      () => createPolicyConsentFields(value),
      /利用規約とプライバシーポリシーの両方/
    )
  }
})
