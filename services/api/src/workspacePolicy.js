const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FALLBACK_WORKSPACE_PATTERN = /^workspace-[a-z0-9]+-[a-z0-9]{1,8}$/i

export function isAllowedWorkspaceId(workspaceId, sessionUserId, accountIds = []) {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    return false
  }

  if (workspaceId === sessionUserId) {
    return true
  }

  if (
    !UUID_PATTERN.test(workspaceId) &&
    !FALLBACK_WORKSPACE_PATTERN.test(workspaceId)
  ) {
    return false
  }

  return !accountIds.includes(workspaceId)
}
