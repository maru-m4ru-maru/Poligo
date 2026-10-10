const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'burnermail.io',
  'crazymailing.com',
  'discard.email',
  'dispostable.com',
  'dropmail.me',
  'emailfake.com',
  'emailondeck.com',
  'emailtemporanea.net',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxkitten.com',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'mailpoof.com',
  'mintemail.com',
  'mohmal.com',
  'mytemp.email',
  'mytrashmail.com',
  'nowmymail.com',
  'sharklasers.com',
  'spamgourmet.com',
  'spambog.com',
  'tempmail.com',
  'tempmail.plus',
  'tempmailo.com',
  'temp-mail.org',
  'tempail.com',
  'tempr.email',
  'throwawaymail.com',
  'tmailor.com',
  'tmail.ws',
  'trashmail.com',
  'yopmail.com'
])

let externalDisposableCheck = null

try {
  const module = await import('email-disposable')

  if (typeof module.default === 'function') {
    externalDisposableCheck = module.default
  }
} catch {}

const EMAIL_LOCAL_PART = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function normalizeUsername(value) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_]{3,32}$/.test(value)
  ) {
    throw new Error('ユーザー名は英数字とアンダースコアを使って3〜32文字で入力してください。')
  }

  return value
}

function isDisposableEmailAddress(email) {
  if (externalDisposableCheck) {
    try {
      if (externalDisposableCheck(email)) {
        return true
      }
    } catch {}
  }

  const domain = email.split('@').at(-1).toLowerCase()

  for (const disposableDomain of DISPOSABLE_DOMAINS) {
    if (
      domain === disposableDomain ||
      domain.endsWith('.' + disposableDomain)
    ) {
      return true
    }
  }

  return false
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

  if (['invalid', 'test', 'example', 'localhost'].includes(topLevelDomain)) {
    throw new Error('メールアドレスの形式が正しくありません。')
  }

  if (
    topLevelDomain.length < 2 ||
    (!/^[a-z]{2,63}$/i.test(topLevelDomain) &&
      !/^xn--[a-z0-9-]{2,59}$/i.test(topLevelDomain))
  ) {
    throw new Error('メールアドレスの形式が正しくありません。')
  }

  if (isDisposableEmailAddress(email)) {
    throw new Error('使い捨てメールアドレスは登録に使用できません。')
  }

  return email
}
