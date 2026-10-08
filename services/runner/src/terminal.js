import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Docker from 'dockerode'

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
})

const workRoot = process.env.WORK_ROOT || path.join(os.tmpdir(), 'poligo-runner')
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

async function writeWorkspace(files) {
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

  await fs.mkdir(workRoot, {
    recursive: true
  })

  const workspace = await fs.mkdtemp(
    path.join(workRoot, 'terminal-')
  )

  try {
    await fs.chmod(workspace, 0o777)

    for (const [name, content] of entries) {
      const safePath = normalizeFilePath(name)

      if (typeof content !== 'string') {
        throw new Error('terminal file content must be text')
      }

      totalBytes += Buffer.byteLength(content, 'utf8')

      if (totalBytes > maxBytes) {
        throw new Error('terminal workspace is too large')
      }

      const destination = path.join(
        workspace,
        ...safePath.split('/')
      )

      await fs.mkdir(path.dirname(destination), {
        recursive: true,
        mode: 0o777
      })

      await fs.writeFile(destination, content, {
        encoding: 'utf8',
        mode: 0o666
      })

    }

    const directories = []
    const visit = async current => {
      const entries = await fs.readdir(current, {
        withFileTypes: true
      })

      for (const entry of entries) {
        const child = path.join(current, entry.name)

        if (entry.isDirectory()) {
          directories.push(child)
          await visit(child)
        }
      }
    }

    await visit(workspace)

    for (const directory of directories) {
      await fs.chmod(directory, 0o777)
    }


    return workspace
  } catch (error) {
    await fs.rm(workspace, {
      recursive: true,
      force: true
    })
    throw error
  }
}

async function readWorkspace(workspace) {
  const files = {}
  let totalBytes = 0

  async function visit(directory, prefix = '') {
    const entries = await fs.readdir(directory, {
      withFileTypes: true
    })

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }

      const relativePath = prefix
        ? prefix + '/' + entry.name
        : entry.name

      const fullPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        await visit(fullPath, relativePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (Object.keys(files).length >= maxFiles) {
        throw new Error('too many terminal files')
      }

      const content = await fs.readFile(fullPath)
      totalBytes += content.length

      if (totalBytes > maxBytes) {
        throw new Error('terminal workspace is too large')
      }

      files[relativePath] = content.toString('utf8')
    }
  }

  await visit(workspace)

  return files
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

  await fs.rm(session.workspace, {
    recursive: true,
    force: true
  })
}

async function createTerminal({
  id = randomUUID(),
  files
}) {
  const terminalId = normalizeId(id)

  if (sessions.has(terminalId)) {
    throw new Error('terminal id already exists')
  }

  const workspace = await writeWorkspace(files)
  let container = null

  try {
    await ensureImage()

    container = await docker.createContainer({
      Image: terminalImage,
      Cmd: ['bash'],
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
        Binds: [
          workspace + ':/workspace:rw'
        ],
        Tmpfs: {
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
      workspace,
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

      void fs.rm(workspace, {
        recursive: true,
        force: true
      })
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

    return {
      id: terminalId,
      status: 'ready',
      createdAt: session.createdAt
    }
  } catch (error) {
    if (container) {
      try {
        await container.kill()
      } catch {}

      try {
        await container.remove({
          force: true
        })
      } catch {}
    }

    await fs.rm(workspace, {
      recursive: true,
      force: true
    })
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

  return readWorkspace(session.workspace)
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
