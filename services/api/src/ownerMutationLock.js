export function createKeyedLock() {
  const queues = new Map()

  return async function withKeyLock(key, operation) {
    const previous = queues.get(key) || Promise.resolve()
    let release
    const gate = new Promise(resolve => {
      release = resolve
    })
    const tail = previous.catch(() => {}).then(() => gate)

    queues.set(key, tail)
    await previous.catch(() => {})

    try {
      return await operation()
    } finally {
      release()

      if (queues.get(key) === tail) {
        queues.delete(key)
      }
    }
  }
}
