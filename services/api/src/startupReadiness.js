export function createStartupReadiness() {
  let resolvePromise
  let settled = false

  const promise = new Promise(resolve => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve(ready) {
      if (settled) {
        return false
      }

      settled = true
      resolvePromise(Boolean(ready))
      return true
    }
  }
}
