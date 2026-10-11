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

export function withOwnerMutationLocks(ownerIds, operation) {
  if (
    !Array.isArray(ownerIds) ||
    !ownerIds.length ||
    ownerIds.some(ownerId => typeof ownerId !== 'string' || !ownerId) ||
    typeof operation !== 'function'
  ) {
    throw new Error('valid owner ids and a mutation operation are required')
  }

  const orderedOwnerIds = [...new Set(ownerIds)].sort()
  let run = operation

  for (let index = orderedOwnerIds.length - 1; index >= 0; index -= 1) {
    const ownerId = orderedOwnerIds[index]
    const next = run
    run = () => withOwnerMutationLock(ownerId, next)
  }

  return run()
}
