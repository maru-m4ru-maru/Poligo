export const workspaceSyncScript = String.raw`
const fs = require('node:fs')
const path = require('node:path')

let input = ''

process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => {
  input += chunk
})

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input)
    const root = path.resolve(payload.root)
    const rootStat = fs.lstatSync(root)
    const files = payload.files
    const deletions = Array.isArray(payload.deletions)
      ? payload.deletions
      : []
    const ignored = new Set([
      '.git',
      'node_modules',
      '.terminal-cache',
      '.tmp',
      '.cache'
    ])

    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      throw new Error('invalid terminal workspace')
    }

    if (!files || typeof files !== 'object' || Array.isArray(files)) {
      throw new Error('terminal files must be an object')
    }

    function pathParts(value) {
      if (
        typeof value !== 'string' ||
        !value ||
        value.length > 240 ||
        value.includes('\0') ||
        value.startsWith('/') ||
        value.includes('\\')
      ) {
        throw new Error('invalid file path')
      }

      const parts = value.split('/')

      if (
        parts.some(part =>
          !part ||
          part === '.' ||
          part === '..' ||
          ignored.has(part)
        )
      ) {
        throw new Error('invalid file path')
      }

      return parts
    }

    const filePaths = Object.keys(files)
    const filePathSet = new Set(filePaths)

    for (const relative of filePaths) {
      const parts = pathParts(relative)

      if (typeof files[relative] !== 'string') {
        throw new Error('terminal file content must be text')
      }

      for (let index = 1; index < parts.length; index += 1) {
        if (filePathSet.has(parts.slice(0, index).join('/'))) {
          throw new Error('terminal file path conflicts with a directory')
        }
      }
    }

    function removeTarget(target) {
      let stat

      try {
        stat = fs.lstatSync(target)
      } catch (error) {
        if (error.code === 'ENOENT') {
          return
        }

        throw error
      }

      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        fs.rmdirSync(target)
      } else {
        fs.unlinkSync(target)
      }
    }

    function removeRelative(relative) {
      const parts = pathParts(relative)
      let current = root

      for (const part of parts.slice(0, -1)) {
        current = path.join(current, part)

        let stat

        try {
          stat = fs.lstatSync(current)
        } catch (error) {
          if (error.code === 'ENOENT') {
            return
          }

          throw error
        }

        if (!stat.isDirectory() || stat.isSymbolicLink()) {
          return
        }
      }

      removeTarget(path.join(current, parts[parts.length - 1]))
    }

    function ensureParents(relative) {
      const parts = pathParts(relative)
      let current = root

      for (const part of parts.slice(0, -1)) {
        const next = path.join(current, part)
        let stat

        try {
          stat = fs.lstatSync(next)
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }

        if (!stat) {
          fs.mkdirSync(next, {
            mode: 0o700
          })
        } else if (!stat.isDirectory() || stat.isSymbolicLink()) {
          fs.rmSync(next, {
            recursive: true,
            force: true
          })
          fs.mkdirSync(next, {
            mode: 0o700
          })
        }

        current = next
      }

      return path.join(current, parts[parts.length - 1])
    }

    for (const relative of deletions) {
      if (!filePathSet.has(relative)) {
        removeRelative(relative)
      }
    }

    for (const relative of filePaths) {
      const target = ensureParents(relative)
      removeTarget(target)

      const flags = fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        (fs.constants.O_NOFOLLOW || 0)
      const descriptor = fs.openSync(target, flags, 0o600)

      try {
        fs.writeFileSync(descriptor, files[relative], {
          encoding: 'utf8'
        })
      } finally {
        fs.closeSync(descriptor)
      }
    }

    process.stdout.write(JSON.stringify({
      ok: true,
      fileCount: filePaths.length
    }))
  } catch (error) {
    process.stderr.write(
      error instanceof Error ? error.message : String(error)
    )
    process.exitCode = 1
  }
})

`
