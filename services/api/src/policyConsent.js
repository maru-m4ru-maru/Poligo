export const TERMS_VERSION = '2026-10-16'
export const PRIVACY_POLICY_VERSION = '2026-10-16'

export function createPolicyConsentFields(user, acceptedAt = new Date()) {
  if (user?.termsAccepted !== true || user?.privacyPolicyAccepted !== true) {
    throw new Error('アカウント作成には利用規約とプライバシーポリシーの両方への同意が必要です。')
  }

  const timestamp = acceptedAt instanceof Date
    ? acceptedAt.toISOString()
    : new Date(acceptedAt).toISOString()

  return {
    termsAccepted: true,
    privacyPolicyAccepted: true,
    termsAcceptedAt: timestamp,
    privacyPolicyAcceptedAt: timestamp,
    termsVersion: TERMS_VERSION,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION
  }
}
