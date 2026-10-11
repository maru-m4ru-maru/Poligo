export function isWorkspaceClaimAllowed(workspaceId, sessionUserId, workspaceOwnerIsRegistered) {
  if (
    typeof workspaceId !== 'string' ||
    !workspaceId ||
    typeof sessionUserId !== 'string' ||
    !sessionUserId
  ) {
    return false
  }

  return workspaceId === sessionUserId || workspaceOwnerIsRegistered !== true
}
