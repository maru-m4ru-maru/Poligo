export function consumeUserQuota(state, userId, now, windowMs, maxRequests) {
  if (
    !(state instanceof Map) ||
    typeof userId !== 'string' ||
    !userId ||
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1
  ) {
    throw new TypeError('invalid user quota configuration')
  }

  const recent = (state.get(userId) || [])
    .filter(timestamp =>
      Number.isSafeInteger(timestamp) &&
      timestamp <= now &&
      now - timestamp < windowMs
    )
    .sort((left, right) => left - right)

  if (recent.length >= maxRequests) {
    const oldest = recent[0] || now
    return Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
  }

  recent.push(now)
  state.set(userId, recent)
  return 0
}

export function pruneUserQuotaState(state, now, windowMs) {
  if (
    !(state instanceof Map) ||
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1
  ) {
    throw new TypeError('invalid user quota cleanup configuration')
  }

  for (const [userId, timestamps] of state) {
    const recent = timestamps.filter(timestamp =>
      Number.isSafeInteger(timestamp) &&
      timestamp <= now &&
      now - timestamp < windowMs
    )

    if (recent.length) {
      state.set(userId, recent)
    } else {
      state.delete(userId)
    }
  }
}
