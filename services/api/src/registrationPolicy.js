import isDisposable from 'email-disposable'

const EMAIL_LOCAL_PART = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw new Error('ユーザー名を入力してください。')
  }

  const username = value.trim()

  if (
    username.length < 2 ||
    username.length > 64 ||
    /[\u0000-\u001f\u007f]/.test(username)
  ) {
    throw new Error('ユーザー名は2〜64文字で入力してください。')
  }

  return username
}

export function normalizeEmailAddress(value) {
  if (typeof value !== 'string') {
    throw new Error('メールアドレスを入力してください。')
  }

  const email = value.trim().toLowerCase()

  if (email.length > 254) {
    throw new Error('メールアドレスが長すぎます。')
  }

  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  if (
    at <= 0 ||
    at !== email.indexOf('@') ||
    local.length > 64 ||
    !EMAIL_LOCAL_PART.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !domain ||
    domain.length > 253 ||
    !domain.includes('.') ||
    domain.split('.').some(label =>
      !label ||
      label.length > 63 ||
      !DOMAIN_LABEL.test(label)
    )
  ) {
    throw new Error('メールアドレスの形式が正しくありません。')
  }

  const topLevelDomain = domain.split('.').at(-1)

  if (
    topLevelDomain.length < 2 ||
    (!/^[a-z]{2,63}$/i.test(topLevelDomain) &&
      !/^xn--[a-z0-9-]{2,59}$/i.test(topLevelDomain))
  ) {
    throw new Error('メールアドレスの形式が正しくありません。')
  }

  if (isDisposable(email)) {
    throw new Error('使い捨てメールアドレスは登録に使用できません。')
  }

  return email
}
