export function shouldRejectBannedSession(session, bannedUserIds) {
  const userId = session?.user?.id

  return Boolean(userId && bannedUserIds.has(userId))
}
