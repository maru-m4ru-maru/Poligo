export const MAX_COMMITS_PER_PROJECT = 50
export const MAX_COMMITS_PER_ACCOUNT = 1000
export const COMMIT_HISTORY_STORAGE_MULTIPLIER = 2

export function planCommitRetention(commits, {
  projectId,
  newCommitBytes,
  historyLimitBytes,
  maxProjectCommits = MAX_COMMITS_PER_PROJECT,
  maxAccountCommits = MAX_COMMITS_PER_ACCOUNT
}) {
  if (
    !Number.isSafeInteger(newCommitBytes) ||
    newCommitBytes < 0 ||
    !Number.isSafeInteger(historyLimitBytes) ||
    historyLimitBytes < 0 ||
    newCommitBytes > historyLimitBytes
  ) {
    return {
      ok: false,
      deleteIds: [],
      remainingBytes: 0
    }
  }

  const rows = (Array.isArray(commits) ? commits : [])
    .map(commit => ({
      id: String(commit.id),
      projectId: String(commit.project_id),
      createdAt: Number(commit.created_at),
      bytes: Math.max(0, Number(commit.content_bytes) || 0)
    }))
    .sort((left, right) =>
      left.createdAt - right.createdAt ||
      left.id.localeCompare(right.id)
    )

  const selected = new Set()
  let retainedCount = rows.length
  let retainedBytes = rows.reduce((total, row) => total + row.bytes, 0)
  let projectCount = rows.filter(row => row.projectId === projectId).length

  function removeOldest(predicate) {
    const candidate = rows.find(row =>
      !selected.has(row.id) && predicate(row)
    )

    if (!candidate) {
      return false
    }

    selected.add(candidate.id)
    retainedCount -= 1
    retainedBytes -= candidate.bytes

    if (candidate.projectId === projectId) {
      projectCount -= 1
    }

    return true
  }

  while (projectCount >= maxProjectCommits) {
    if (!removeOldest(row => row.projectId === projectId)) {
      return {
        ok: false,
        deleteIds: [],
        remainingBytes: retainedBytes
      }
    }
  }

  while (retainedCount >= maxAccountCommits) {
    if (!removeOldest(() => true)) {
      return {
        ok: false,
        deleteIds: [],
        remainingBytes: retainedBytes
      }
    }
  }

  while (retainedBytes + newCommitBytes > historyLimitBytes) {
    if (!removeOldest(() => true)) {
      return {
        ok: false,
        deleteIds: [],
        remainingBytes: retainedBytes
      }
    }
  }

  return {
    ok: true,
    deleteIds: [...selected],
    remainingBytes: retainedBytes
  }
}
