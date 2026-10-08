import { randomUUID } from 'node:crypto'
import Docker from 'dockerode'
import tar from 'tar-stream'

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
})

const terminalImage = process.env.TERMINAL_IMAGE || 'node:22-bookworm'
const maxFiles = Number(process.env.TERMINAL_MAX_FILES || 200)
const maxBytes = Number(process.env.TERMINAL_MAX_PROJECT_BYTES || 5_000_000)
const memoryBytes = Number(process.env.TERMINAL_MEMORY_BYTES || 536_870_912)
const nanoCpus = Number(process.env.TERMINAL_NANO_CPUS || 500_000_000)
const pidsLimit = Number(process.env.TERMINAL_PIDS_LIMIT || 128)
const idleTtlMs = Number(process.env.TERMINAL_IDLE_TTL_MS || 30 * 60 * 1000)
const maxOutputBytes = Number(process.env.TERMINAL_MAX_OUTPUT_BYTES || 65_536)
const terminalNetworkMode = process.env.TERMINAL_NETWORK_MODE || 'none'

const sessions = new Map()

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - idleTtlMs

  for (const [id, session] of sessions) {
    if (session.lastUsedAt <= cutoff) {
      void closeTerminal(id)
    }
  }
}, 60_000)

cleanupTimer.unref?.()

function normalizeFilePath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some(part => part === '..' || part === '.')
  ) {
    throw new Error('invalid file path')
  }

  return value
}

function normalizeId(value) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(value)
  ) {
    throw new Error('invalid terminal id')
  }

  return value
}

function appendOutput(session, data) {
  session.outputBuffer += data

  if (session.outputBuffer.length > maxOutputBytes) {
    session.outputBuffer =
      session.outputBuffer.slice(-maxOutputBytes)
  }

  if (session.socket?.readyState === 1) {
    session.socket.send(
      JSON.stringify({
        type: 'output',
        data
      })
    )
  }
}

async function ensureImage() {
  try {
    await docker.getImage(terminalImage).inspect()
    return
  } catch {}

  const stream = await docker.pull(terminalImage)

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      }
    )
  })
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

    if (totalBytes > maxBytes) {
      throw new Error('terminal workspace is too large')
    }

    normalized[safePath] = content
  }

  return normalized
}

async function createWorkspaceArchive(files) {
  const normalized = normalizeFiles(files)
  const pack = tar.pack()
  const directories = new Set()

  for (const [name, content] of Object.entries(normalized)) {
    const parts = name.split('/')

    for (let index = 1; index < parts.length; index += 1) {
      directories.add(
        parts.slice(0, index).join('/') + '/'
      )
    }
  }

  for (const directory of [...directories].sort()) {
    pack.entry({
      name: directory,
      type: 'directory',
      mode: 0o777
    })
  }

  for (const [name, content] of Object.entries(normalized)) {
    pack.entry({
      name,
      type: 'file',
      mode: 0o666,
      size: Buffer.byteLength(content, 'utf8')
    }, Buffer.from(content, 'utf8'))
  }

  pack.finalize()

  const chunks = []

  for await (const chunk of pack) {
    chunks.push(Buffer.from(chunk))
  }

  return {
    normalized,
    archive: Buffer.concat(chunks)
  }
}

function normalizeArchivePath(name) {
  let value = String(name || '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')

  if (value === 'workspace') {
    return ''
  }

  if (value.startsWith('workspace/')) {
    value = value.slice('workspace/'.length)
  }

  if (
    !value ||
    value.includes('\0') ||
    value.split('/').some(part => part === '..' || part === '.')
  ) {
    return ''
  }

  return value
}

async function readWorkspaceArchive(container) {
  const archive = await container.getArchive({
    path: '/workspace'
  })
  const extract = tar.extract()
  const files = {}
  let totalBytes = 0

  return await new Promise((resolve, reject) => {
    extract.on('entry', (header, stream, next) => {
      const name = normalizeArchivePath(header.name)

      if (
        header.type !== 'file' ||
        !name ||
        Object.keys(files).length >= maxFiles
      ) {
        stream.resume()
        stream.on('end', next)
        return
      }

      const chunks = []
      let fileBytes = 0

      stream.on('data', chunk => {
        fileBytes += chunk.length
        totalBytes += chunk.length

        if (
          fileBytes > maxBytes ||
          totalBytes > maxBytes
        ) {
          extract.destroy(
            new Error('terminal workspace is too large')
          )
          return
        }

        chunks.push(Buffer.from(chunk))
      })

      stream.on('end', () => {
        files[name] = Buffer.concat(chunks).toString('utf8')
        next()
      })

      stream.on('error', reject)
    })

    extract.on('finish', () => {
      resolve(files)
    })

    extract.on('error', reject)
    archive.on('error', reject)
    archive.pipe(extract)
  })
}

async function cleanupSession(session) {
  if (session.stream) {
    try {
      session.stream.end()
    } catch {}
  }

  if (session.container) {
    try {
      await session.container.kill()
    } catch {}

    try {
      await session.container.remove({
        force: true
      })
    } catch {}
  }
}

async function createTerminal({
  id = randomUUID(),
  files
}) {
  const terminalId = normalizeId(id)
  const { normalized, archive } =
    await createWorkspaceArchive(files)

  if (sessions.has(terminalId)) {
    throw new Error('terminal id already exists')
  }

  try {
    await ensureImage()

    const container = await docker.createContainer({
      Image: terminalImage,
      Cmd: [
        'bash',
        '--noprofile',
        '--norc',
        '-i',
        '-c',
        'cd /workspace && exec bash --noprofile --norc -i'
      ],
      WorkingDir: '/workspace',
      User: '0:0',
      Env: [
        'HOME=/workspace',
        'TERM=xterm-256color',
        'COLORTERM=truecolor',
        'LANG=C.UTF-8',
        'LC_ALL=C.UTF-8',
        'NPM_CONFIG_CACHE=/tmp/npm',
        'XDG_CACHE_HOME=/tmp/.cache',
        'PS1=\\u@poligo:\\w$ '
      ],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        AutoRemove: false,
        NetworkMode: terminalNetworkMode,
        ReadonlyRootfs: true,
        Memory: memoryBytes,
        NanoCpus: nanoCpus,
        PidsLimit: pidsLimit,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Tmpfs: {
          '/workspace': 'rw,nosuid,nodev,size=128m',
          '/tmp': 'rw,nosuid,nodev,size=64m'
        },
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '64k',
            'max-file': '1'
          }
        }
      }
    })

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true
    })

    const session = {
      id: terminalId,
      container,
      stream,
      socket: null,
      outputBuffer: '',
      createdAt: new Date().toISOString(),
      lastUsedAt: Date.now()
    }

    sessions.set(terminalId, session)

    stream.on('data', chunk => {
      session.lastUsedAt = Date.now()
      appendOutput(
        session,
        Buffer.isBuffer(chunk)
          ? chunk.toString('utf8')
          : String(chunk)
      )
    })

    stream.on('end', () => {
      if (session.socket?.readyState === 1) {
        session.socket.send(
          JSON.stringify({
            type: 'exit',
            code: null
          })
        )
        session.socket.close()
      }

      sessions.delete(terminalId)

      void container.remove({
        force: true
      }).catch(() => {})
    })

    stream.on('error', error => {
      appendOutput(
        session,
        '\r\n[terminal stream error] ' +
        (error instanceof Error ? error.message : String(error)) +
        '\r\n'
      )
    })

    await container.start()
    await container.resize({
      w: 120,
      h: 32
    })

    await container.putArchive(
      archive,
      {
        path: '/workspace'
      }
    )

    session.stream.write('cd /workspace\n')

    return {
      id: terminalId,
      status: 'ready',
      createdAt: session.createdAt,
      fileCount: Object.keys(normalized).length
    }
  } catch (error) {
    const session = sessions.get(terminalId)

    if (session) {
      sessions.delete(terminalId)
      await cleanupSession(session)
    }

    throw error
  }
}

export function getTerminal(id) {
  return sessions.get(normalizeId(id)) || null
}

export async function createTerminalSession(payload) {
  return createTerminal(payload)
}

export async function getTerminalFiles(id) {
  const session = getTerminal(id)

  if (!session) {
    throw new Error('terminal session not found')
  }

  session.lastUsedAt = Date.now()

  return readWorkspaceArchive(session.container)
}

export async function closeTerminal(id) {
  const terminalId = normalizeId(id)
  const session = sessions.get(terminalId)

  if (!session) {
    return
  }

  sessions.delete(terminalId)
  await cleanupSession(session)
}

export async function attachTerminalSocket(id, socket) {
  const session = getTerminal(id)

  if (!session) {
    socket.close()
    return
  }

  if (
    session.socket &&
    session.socket.readyState === 1
  ) {
    session.socket.close()
  }

  session.socket = socket
  session.lastUsedAt = Date.now()

  if (session.outputBuffer) {
    socket.send(
      JSON.stringify({
        type: 'output',
        data: session.outputBuffer
      })
    )
  }

  socket.on('message', message => {
    session.lastUsedAt = Date.now()

    let payload

    try {
      payload = JSON.parse(
        message.toString('utf8')
      )
    } catch {
      return
    }

    if (
      payload?.type === 'input' &&
      typeof payload.data === 'string'
    ) {
      session.stream.write(payload.data)
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
        rows <= 100
      ) {
        void session.container.resize({
          w: cols,
          h: rows
        })
      }
    }
  })

  socket.on('close', () => {
    if (session.socket === socket) {
      session.socket = null
    }
  })
}

export function listTerminals() {
  return [...sessions.values()].map(session => ({
    id: session.id,
    createdAt: session.createdAt,
    lastUsedAt: new Date(session.lastUsedAt).toISOString()
  }))
}
