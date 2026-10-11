const mutationQueues = new Map()

export function withOwnerMutationLock(ownerId, operation) {
  if (typeof ownerId !== 'string' || !ownerId) {
    throw new Error('owner id is required for project mutations')
  }

  if (typeof operation !== 'function') {
    throw new TypeError('project mutation must be a function')
  }

  const previous = mutationQueues.get(ownerId) || Promise.resolve()
  let release

  const gate = new Promise(resolve => {
    release = resolve
  })
  const tail = previous.then(() => gate)

  mutationQueues.set(ownerId, tail)

  return previous
    .then(operation)
    .finally(() => {
      release()

      if (mutationQueues.get(ownerId) === tail) {
        mutationQueues.delete(ownerId)
      }
    })
}
