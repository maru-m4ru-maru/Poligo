export function calculateStorageBytes(projectBytes, historyBytes = 0) {
  const projectSize = Number(projectBytes)
  const historySize = Number(historyBytes)

  if (
    !Number.isSafeInteger(projectSize) ||
    projectSize < 0 ||
    !Number.isSafeInteger(historySize) ||
    historySize < 0
  ) {
    throw new Error('storage byte counts must be non-negative safe integers')
  }

  const total = projectSize + historySize

  if (!Number.isSafeInteger(total)) {
    throw new Error('total storage byte count is too large')
  }

  return total
}
