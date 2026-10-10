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
