export const MAX_PROJECT_COMMITS = 100

export function canCreateProjectCommit(currentCount) {
  return Number.isSafeInteger(currentCount) &&
    currentCount >= 0 &&
    currentCount < MAX_PROJECT_COMMITS
}
