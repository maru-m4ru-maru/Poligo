function hasFile(files, path) {
  return Object.prototype.hasOwnProperty.call(files, path)
}

function getFile(files, path) {
  return hasFile(files, path) ? files[path] : undefined
}

function setFile(files, path, value) {
  if (value === undefined) {
    delete files[path]
  } else {
    files[path] = value
  }
}

function createConflictCopyPath(path, source, usedPaths) {
  const separator = path.lastIndexOf('/')
  const directory = separator >= 0 ? path.slice(0, separator + 1) : ''
  const name = separator >= 0 ? path.slice(separator + 1) : path
  const marker = '.poligo-' + source + '-conflict'

  for (let index = 0; index < 1000; index += 1) {
    const suffix = marker + (index ? '-' + index : '')
    const maximumNameLength = 240 - directory.length - suffix.length

    if (maximumNameLength < 1) {
      throw new Error('cannot preserve file conflict within the path length limit')
    }

    const candidate = directory + name.slice(0, maximumNameLength) + suffix
    const collides = [...usedPaths].some(existing =>
      existing === candidate ||
      existing.startsWith(candidate + '/') ||
      candidate.startsWith(existing + '/')
    )

    if (!collides) {
      usedPaths.add(candidate)
      return candidate
    }
  }

  throw new Error('cannot allocate a unique file conflict copy path')
}

function makeDeletionNotice(path, source) {
  return [
    '[Poligo file synchronization conflict]',
    'The ' + source + ' version deleted this path while another version changed it:',
    path,
    'The surviving version is preserved separately.'
  ].join('\n') + '\n'
}

export function filesEqual(left, right) {
  const leftPaths = Object.keys(left || {})
  const rightPaths = Object.keys(right || {})

  if (leftPaths.length !== rightPaths.length) {
    return false
  }

  return leftPaths.every(path =>
    hasFile(right, path) && left[path] === right[path]
  )
}

export function mergeTerminalFiles({
  baseFiles = {},
  projectFiles = {},
  runnerFiles = {},
  clientFiles
}) {
  const hasClient = clientFiles !== undefined
  const mergedFiles = { ...projectFiles }
  const baselineFiles = {}
  const usedPaths = new Set([
    ...Object.keys(baseFiles),
    ...Object.keys(projectFiles),
    ...Object.keys(runnerFiles),
    ...(hasClient ? Object.keys(clientFiles) : [])
  ])
  const conflicts = []
  const allPaths = new Set([
    ...Object.keys(baseFiles),
    ...Object.keys(projectFiles),
    ...Object.keys(runnerFiles),
    ...(hasClient ? Object.keys(clientFiles) : [])
  ])

  for (const path of allPaths) {
    const baseValue = getFile(baseFiles, path)
    const projectValue = getFile(projectFiles, path)
    const clientValue = hasClient
      ? getFile(clientFiles, path)
      : projectValue
    const runnerValue = getFile(runnerFiles, path)
    const projectChanged = projectValue !== baseValue
    const clientChanged = hasClient && clientValue !== baseValue
    const runnerChanged = runnerValue !== baseValue

    let mergedValue

    if (clientChanged && runnerChanged && clientValue === runnerValue) {
      mergedValue = clientValue
    } else if (projectChanged && clientChanged && projectValue === clientValue) {
      mergedValue = projectValue
    } else if (projectChanged && runnerChanged && projectValue === runnerValue) {
      mergedValue = projectValue
    } else if (projectChanged) {
      mergedValue = projectValue
    } else if (clientChanged) {
      mergedValue = clientValue
    } else if (runnerChanged) {
      mergedValue = runnerValue
    } else {
      mergedValue = projectValue
    }

    const divergentVersions = []

    if (projectChanged && projectValue !== mergedValue) {
      divergentVersions.push({ source: 'project', value: projectValue })
    }

    if (clientChanged && clientValue !== mergedValue) {
      divergentVersions.push({ source: 'editor', value: clientValue })
    }

    if (runnerChanged && runnerValue !== mergedValue) {
      divergentVersions.push({ source: 'terminal', value: runnerValue })
    }

    const preservedCopies = []

    for (const version of divergentVersions) {
      const copyPath = createConflictCopyPath(path, version.source, usedPaths)
      mergedFiles[copyPath] = version.value === undefined
        ? makeDeletionNotice(path, version.source)
        : version.value
      preservedCopies.push(copyPath)
    }

    if (divergentVersions.length) {
      conflicts.push({
        path,
        sources: divergentVersions.map(version => version.source),
        copies: preservedCopies
      })
    }

    setFile(mergedFiles, path, mergedValue)
    setFile(baselineFiles, path, mergedValue)
  }

  const comparisonFiles = hasClient
    ? clientFiles
    : baseFiles
  const changedPaths = [...new Set([
    ...Object.keys(comparisonFiles),
    ...Object.keys(mergedFiles)
  ])]
    .filter(path =>
      getFile(comparisonFiles, path) !== getFile(mergedFiles, path)
    )
    .sort()

  return {
    files: mergedFiles,
    runnerFiles: { ...mergedFiles },
    baselineFiles: { ...mergedFiles },
    changedPaths,
    conflicts: conflicts.sort((left, right) =>
      left.path.localeCompare(right.path)
    )
  }
}
