const DEFAULT_CACHE_TTL_MS = 10_000
const DEFAULT_TIMEOUT_MS = 1_500

export function createRunnerReadinessProbe({
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  let cached = {
    url: '',
    checkedAt: 0,
    ready: false,
    promise: null
  }

  return async function isRunnerExecutionReady(runnerUrl) {
    if (typeof runnerUrl !== 'string' || !runnerUrl.trim()) {
      return false
    }

    const root = runnerUrl.trim().replace(/\\/+$/, '')
    let healthUrl

    try {
      healthUrl = new URL('/health', root).toString()
    } catch {
      return false
    }

    const current = now()

    if (cached.url === root && cached.promise) {
      return cached.promise
    }

    if (cached.url === root && current - cached.checkedAt < cacheTtlMs) {
      return cached.ready
    }

    const record = {
      url: root,
      checkedAt: current,
      ready: false,
      promise: null
    }

    cached = record

    record.promise = (async () => {
      let ready = false

      try {
        const response = await fetchImpl(healthUrl, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs)
        })
        const health = await response.json()

        ready = response.ok === true &&
          health?.service === 'runner' &&
          health?.executionReady === true
      } catch {
        ready = false
      }

      record.checkedAt = now()
      record.ready = ready
      record.promise = null
      return ready
    })()

    return record.promise
  }
}

export const isRunnerExecutionReady = createRunnerReadinessProbe()
