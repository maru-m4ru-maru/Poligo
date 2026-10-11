export function getWorkspaceClaimDecision(workspaceId, sessionUserId, registeredOwnerExists) {
  if (
    typeof workspaceId !== 'string' ||
    !workspaceId ||
    typeof sessionUserId !== 'string' ||
    !sessionUserId
  ) {
    return 'invalid'
  }

  if (workspaceId === sessionUserId) {
    return 'same-account'
  }

  return registeredOwnerExists
    ? 'owned-by-another-account'
    : 'legacy-workspace'
}
