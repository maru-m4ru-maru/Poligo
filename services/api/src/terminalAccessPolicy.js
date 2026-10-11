export function canAcceptTerminalUpgrade({
  owner,
  now = Date.now(),
  originAllowed,
  runnerConfigured,
  ticketPresent,
  banned = false
}) {
  return Boolean(
    owner &&
    !owner.revoked &&
    Number(owner.expiresAt) > now &&
    originAllowed &&
    runnerConfigured &&
    ticketPresent &&
    !banned
  )
}
