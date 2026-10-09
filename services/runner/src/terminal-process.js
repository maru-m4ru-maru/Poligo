import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import pty from 'node-pty'
import tar from 'tar-stream'

const execFileAsync = promisify(execFile)
const workspaceRoot = process.env.TERMINAL_RUN_ROOT || '/tmp/poligo-terminal-sessions'
const maxFiles = Number(process.env.TERMINAL_MAX_FILES || 200)
const maxProjectBytes = Number(process.env.TERMINAL_MAX_PROJECT_BYTES || 5_000_000)
const maxWorkspaceBytes = Number(process.env.TERMINAL_MAX_WORKSPACE_BYTES || 384 * 1024 * 1024)
const maxWorkspaceEntries = Number(process.env.TERMINAL_MAX_WORKSPACE_ENTRIES || 20_000)
const maxOutputBytes = Number(process.env.TERMINAL_MAX_OUTPUT_BYTES || 65_536)
const maxSessions = Number(process.env.TERMINAL_MAX_SESSIONS || 4)
const idleTtlMs = Number(process.env.TERMINAL_IDLE_TTL_MS || 30 * 60 * 1000)
const maxLifetimeMs = Number(process.env.TERMINAL_MAX_LIFETIME_MS || 4 * 60 * 60 * 1000)
const maxSocketBufferBytes = 1_048_576
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  '.terminal-cache',
  '.tmp',
  '.cache'
])

const sessions = new Map()
let nextUid = 20_000

function normalizeId(value) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(value)
  ) {
    throw new Error('invalid terminal id')
  }

  return value
}

function normalizeFilePath(value) {
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
      part === '.terminal-cache' ||
      part === '.tmp' ||
      part === '.cache'
    )
  ) {
    throw new Error('invalid file path')
  }

  return parts.join('/')
}

function normalizeFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('terminal files must be an object')
  }

  const entries = Object.entries(files)

  if (!entries.length) {
    throw new Error('terminal workspace is empty')
  }

  if (entries.length > maxFiles) {
    throw new Error('too many terminal files')
  }

  let totalBytes = 0
  const normalized = {}

  for (const [name, content] of entries) {
    const safePath = normalizeFilePath(name)

    if (typeof content !== 'string') {
      throw new Error('terminal file content must be text')
    }

    totalBytes += Buffer.byteLength(content, 'utf8')

    if (totalBytes > maxProjectBytes) {
      throw new Error('terminal workspace is too large')
    }

    normalized[safePath] = content
  }

  return normalized
}

async function createSystemUser(workspace) {
  for (let attempt = 0; attempt < 40_000; attempt += 1) {
    const uid = nextUid
    nextUid += 1

    if (nextUid > 59_999) {
      nextUid = 20_000
    }

    if ([...sessions.values()].some(session => session.uid === uid)) {
      continue
    }

    const username = 'poligo' + uid

    try {
      await execFileAsync('/usr/sbin/useradd', [
        '--uid',
        String(uid),
        '--no-create-home',
        '--home-dir',
        workspace,
        '--shell',
        '/bin/bash',
        '--user-group',
        username
      ])

      return {
        uid,
        username
      }
    } catch (error) {
      const message = String(error?.stderr || error?.message || '')

      if (
        message.includes('already exists') ||
        message.includes('already in use') ||
        message.includes('is not unique')
      ) {
        continue
      }

      throw new Error('could not create isolated terminal user')
    }
  }

  throw new Error('terminal user pool is exhausted')
}

async function writeInitialFiles(workspace, uid, files) {
  await fs.mkdir(workspace, {
    recursive: true,
    mode: 0o700
  })

  await fs.chmod(workspace, 0o700)

  for (const [name, content] of Object.entries(files)) {
    const target = path.join(workspace, name)
    await fs.mkdir(path.dirname(target), {
      recursive: true,
      mode: 0o700
    })
    await fs.writeFile(target, content, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    })
  }

  await fs.mkdir(path.join(workspace, '.terminal-cache'), {
    recursive: true,
    mode: 0o700
  })

  await fs.chown(workspace, uid, uid)
  await execFileAsync('/bin/chown', [
    '-R',
    String(uid) + ':' + String(uid),
    workspace
  ])
  await fs.chmod(workspace, 0o700)
}

function appendOutput(session, data) {
  session.lastUsedAt = Date.now()
  session.outputBuffer += data

  if (session.outputBuffer.length > maxOutputBytes) {
    session.outputBuffer = session.outputBuffer.slice(-maxOutputBytes)
  }

  const socket = session.socket

  if (
    socket?.readyState === 1 &&
    socket.bufferedAmount < maxSocketBufferBytes
  ) {
    socket.send(JSON.stringify({
      type: 'output',
      data
    }))
  }
}

function terminalEnvironment(session) {
  const cache = path.join(session.workspace, '.terminal-cache')

  return {
    HOME: session.workspace,
    USER: session.username,
    LOGNAME: session.username,
    SHELL: '/bin/bash',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    TMPDIR: path.join(cache, 'tmp'),
    NPM_CONFIG_CACHE: path.join(cache, 'npm'),
    XDG_CACHE_HOME: cache,
    PS1: '\\u@poligo:\\w$ ',
    PWD: session.workspace
  }
}

function setprivArguments(session, command, args) {
  return [
    '--reuid',
    String(session.uid),
    '--regid',
    String(session.uid),
    '--clear-groups',
    command,
    ...args
  ]
}

async function measureWorkspace(session) {
  const du = await execFileAsync(
    '/usr/bin/setpriv',
    setprivArguments(session, '/usr/bin/du', [
      '-sb',
      session.workspace
    ]),
    {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 65_536
    }
  )

  const bytes = Number(du.stdout.trim().split(/\\s+/)[0])

  if (!Number.isFinite(bytes) || bytes > maxWorkspaceBytes) {
    throw new Error('terminal workspace storage limit exceeded')
  }

  const entries = await execFileAsync(
    '/usr/bin/setpriv',
    setprivArguments(session, '/usr/bin/find', [
      session.workspace,
      '-xdev',
      '-printf',
      'x'
    ]),
    {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: maxWorkspaceEntries + 1
    }
  )

  if (entries.stdout.length > maxWorkspaceEntries) {
    throw new Error('terminal workspace contains too many files')
  }

  return {
    bytes,
    entries: entries.stdout.length
  }
}

async function collectWorkspaceFiles(session) {
  const result = await execFileAsync(
    '/usr/bin/setpriv',
    setprivArguments(session, '/bin/tar', [
      '--exclude=./node_modules',
      '--exclude=./.git',
      '--exclude=./.terminal-cache',
      '--exclude=./.tmp',
      '--exclude=./.cache',
      '-cf',
      '-',
      '-C',
      session.workspace,
      '.'
    ]),
    {
      encoding: 'buffer',
      timeout: 15_000,
      maxBuffer: maxProjectBytes + 1_048_576
    }
  )

  return await new Promise((resolve, reject) => {
    const extract = tar.extract()
    const files = {}
    let totalBytes = 0

    extract.on('entry', (header, stream, next) => {
      const name = String(header.name || '').replace(/^\\.\\//, '')

      if (header.type !== 'file' || !name) {
        stream.resume()
        stream.on('end', next)
        return
      }

      let safePath

      try {
        safePath = normalizeFilePath(name)
      } catch {
        stream.resume()
        stream.on('end', next)
        return
      }

      const chunks = []
      let fileBytes = 0
      let binary = false

      stream.on('data', chunk => {
        fileBytes += chunk.length
        totalBytes += chunk.length

        if (
          fileBytes > maxProjectBytes ||
          totalBytes > maxProjectBytes ||
          Object.keys(files).length >= maxFiles
        ) {
          extract.destroy(new Error('terminal project files exceed the sync limit'))
          return
        }

        if (chunk.includes(0)) {
          binary = true
        }

        chunks.push(Buffer.from(chunk))
      })

      stream.on('end', () => {
        if (!binary) {
          files[safePath] = Buffer.concat(chunks).toString('utf8')
        }

        next()
      })

      stream.on('error', reject)
    })

    extract.on('finish', () => {
      resolve(files)
    })

    extract.on('error', reject)
    extract.end(result.stdout)
  })
}

async function killUserProcesses(session) {
  try {
    await execFileAsync('/usr/bin/pkill', [
      '-KILL',
      '-u',
      String(session.uid)
    ])
  } catch {}
}

async function removeSystemUser(session) {
  try {
    await execFileAsync('/usr/sbin/userdel', [
      session.username
    ])
  } catch {}
}

async function cleanupSession(session) {
  if (session.closing) {
    return
  }

  session.closing = true

  if (session.process) {
    try {
      session.process.kill('SIGKILL')
    } catch {}
  }

  await killUserProcesses(session)
  sessions.delete(session.id)
  await fs.rm(session.workspace, {
    recursive: true,
    force: true
  }).catch(() => {})
  await removeSystemUser(session)
}

const cleanupTimer = setInterval(() => {
  const now = Date.now()

  for (const session of sessions.values()) {
    if (
      now - session.lastUsedAt >= idleTtlMs ||
      now - session.createdAt >= maxLifetimeMs
    ) {
      void cleanupSession(session)
      continue
    }

    void measureWorkspace(session).catch(error => {
      appendOutput(
        session,
        '\r\n[terminal stopped] ' +
          (error instanceof Error ? error.message : 'workspace limit exceeded') +
          '\r\n'
      )
      void cleanupSession(session)
    })
  }
}, 15_000)

cleanupTimer.unref?.()

export async function createTerminalSession({
  id = randomUUID(),
  files
}) {
  if (process.getuid?.() !== 0) {
    throw new Error('hosted terminal backend requires a root-managed runner container')
  }

  if (sessions.size >= maxSessions) {
    throw new Error('terminal capacity is currently full')
  }

  const terminalId = normalizeId(id)
  const normalized = normalizeFiles(files)

  if (sessions.has(terminalId)) {
    throw new Error('terminal id already exists')
  }

  await fs.mkdir(workspaceRoot, {
    recursive: true,
    mode: 0o711
  })
  await fs.chmod(workspaceRoot, 0o711)

  const workspace = path.join(workspaceRoot, terminalId)
  const identity = await createSystemUser(workspace)
  const session = {
    id: terminalId,
    uid: identity.uid,
    username: identity.username,
    workspace,
    process: null,
    socket: null,
    outputBuffer: '',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    closing: false,
    exited: false
  }

  try {
    await writeInitialFiles(workspace, session.uid, normalized)
    await fs.mkdir(path.join(workspace, '.terminal-cache', 'tmp'), {
      recursive: true,
      mode: 0o700
    })
    await fs.chown(path.join(workspace, '.terminal-cache'), session.uid, session.uid)
    await fs.chown(path.join(workspace, '.terminal-cache', 'tmp'), session.uid, session.uid)

    const startup = [
      'umask 077',
      'ulimit -c 0',
      'ulimit -t 300',
      'ulimit -f 65536',
      'ulimit -n 256',
      'ulimit -u 24',
      'export PS1="\\u@poligo:\\w$ "',
      'exec /bin/bash --noprofile --norc -i'
    ].join('; ')

    const process = pty.spawn('/usr/bin/setpriv', [
      '--reuid',
      String(session.uid),
      '--regid',
      String(session.uid),
      '--clear-groups',
      '/bin/bash',
      '--noprofile',
      '--norc',
      '-i',
      '-c',
      startup
    ], {
      name: 'xterm-256color',
      cols: 120,
      rows: 32,
      cwd: workspace,
      env: terminalEnvironment(session),
      encoding: 'utf8'
    })

    session.process = process
    sessions.set(terminalId, session)

    process.onData(data => {
      appendOutput(session, data)
    })

    process.onExit(({ exitCode, signal }) => {
      session.exited = true
      session.exitCode = exitCode
      session.exitSignal = signal

      if (session.socket?.readyState === 1) {
        session.socket.send(JSON.stringify({
          type: 'exit',
          code: exitCode
        }))
      }

      void killUserProcesses(session)
    })

    await measureWorkspace(session)

    return {
      id: terminalId,
      status: 'ready',
      createdAt: new Date(session.createdAt).toISOString(),
      fileCount: Object.keys(normalized).length,
      backend: 'process'
    }
  } catch (error) {
    await cleanupSession(session)
    throw error
  }
}

export async function getTerminalFiles(id) {
  const session = sessions.get(normalizeId(id))

  if (!session || session.closing) {
    throw new Error('terminal session not found')
  }

  session.lastUsedAt = Date.now()
  return collectWorkspaceFiles(session)
}

export async function closeTerminal(id) {
  const session = sessions.get(normalizeId(id))

  if (!session) {
    return
  }

  await cleanupSession(session)
}

export async function attachTerminalSocket(id, socket) {
  const session = sessions.get(normalizeId(id))

  if (!session || session.closing) {
    socket.close()
    return
  }

  if (session.socket && session.socket.readyState === 1) {
    session.socket.close()
  }

  session.socket = socket
  session.lastUsedAt = Date.now()

  if (session.outputBuffer) {
    socket.send(JSON.stringify({
      type: 'output',
      data: session.outputBuffer
    }))
  }

  socket.on('message', message => {
    session.lastUsedAt = Date.now()

    let payload

    try {
      payload = JSON.parse(message.toString('utf8'))
    } catch {
      return
    }

    if (
      payload?.type === 'input' &&
      typeof payload.data === 'string' &&
      Buffer.byteLength(payload.data, 'utf8') <= 65_536 &&
      !session.exited
    ) {
      session.process.write(payload.data)
      return
    }

    if (payload?.type === 'resize') {
      const cols = Number(payload.cols)
      const rows = Number(payload.rows)

      if (
        Number.isInteger(cols) &&
        Number.isInteger(rows) &&
        cols >= 20 &&
        cols <= 240 &&
        rows >= 5 &&
        rows <= 100 &&
        !session.exited
      ) {
        session.process.resize(cols, rows)
      }
    }
  })

  socket.on('close', () => {
    if (session.socket === socket) {
      session.socket = null
    }
  })

  socket.on('error', () => {
    if (session.socket === socket) {
      session.socket = null
    }
  })
}

export function listTerminals() {
  return [...sessions.values()].map(session => ({
    id: session.id,
    createdAt: new Date(session.createdAt).toISOString(),
    lastUsedAt: new Date(session.lastUsedAt).toISOString(),
    exited: session.exited
  }))
}
