export function isConfiguredAdmin(user, adminUserIds, adminEmails) {
  if (!user?.id) {
    return false
  }

  if (adminUserIds.has(user.id)) {
    return true
  }

  const emailVerified =
    user.emailVerified === true ||
    Number(user.emailVerified) === 1

  if (!emailVerified) {
    return false
  }

  return adminEmails.has(String(user.email || '').trim().toLowerCase())
}

export function isDisposableE2EAccountEmail(value) {
  if (typeof value !== 'string') {
    return false
  }

  return /^poligo-[a-z0-9-]+-[a-f0-9]{32}@example\.(?:invalid|com)$/i.test(
    value.trim().toLowerCase()
  )
}
