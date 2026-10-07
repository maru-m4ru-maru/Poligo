import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Docker from 'dockerode'
import { getLanguage } from './languages.js'

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock'
})

const workRoot = process.env.WORK_ROOT || path.join(os.tmpdir(), 'poligo-runner')
const maxFiles = Number(process.env.MAX_FILES || 200)
const maxBytes = Number(process.env.MAX_PROJECT_BYTES || 5_000_000)
const timeoutMs = Number(process.env.EXECUTION_TIMEOUT_MS || 10_000)
const memoryBytes = Number(process.env.EXECUTION_MEMORY_BYTES || 268_435_456)
const nanoCpus = Number(process.env.EXECUTION_NANO_CPUS || 500_000_000)
const pidsLimit = Number(process.env.EXECUTION_PIDS_LIMIT || 128)
const maxOutputBytes = Number(process.env.MAX_OUTPUT_BYTES || 65_536)
const maxArguments = Number(process.env.MAX_EXECUTION_ARGUMENTS || 32)
const maxArgumentBytes = Number(process.env.MAX_EXECUTION_ARGUMENT_BYTES || 512)
const maxEnvironmentVariables = Number(process.env.MAX_ENVIRONMENT_VARIABLES || 64)
const maxEnvironmentBytes = Number(process.env.MAX_ENVIRONMENT_BYTES || 16_384)
const concurrency = Number(process.env.EXECUTION_CONCURRENCY || 1)

const jobs = new Map()
const queue = []
const jobTtlMs = Number(process.env.JOB_TTL_MS || 10 * 60 * 1000)

let running = 0

const jobCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - jobTtlMs

  for (const [id, job] of jobs) {
    if (
      job.finishedAt &&
      Date.parse(job.finishedAt) <= cutoff
    ) {
      jobs.delete(id)
    }
  }
}, 60_000)

jobCleanupTimer.unref?.()

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

function truncate(value) {
  if (value.length <= maxOutputBytes) {
    return value
  }

  return value.slice(0, maxOutputBytes) + '\n[output truncated]'
}

function normalizeArguments(args) {
  if (args === undefined || args === null) {
    return []
  }

  if (!Array.isArray(args)) {
    throw new Error('execution arguments must be an array')
  }

  if (args.length > maxArguments) {
    throw new Error('too many execution arguments')
  }

  let totalBytes = 0
  const normalized = []

  for (const value of args) {
    if (
      typeof value !== 'string' ||
      value.includes('\0')
    ) {
      throw new Error('execution arguments must be strings without NUL bytes')
    }

    totalBytes += Buffer.byteLength(value, 'utf8')

    if (totalBytes > maxArgumentBytes) {
      throw new Error('execution arguments are too long')
    }

    normalized.push(value)
  }

  return normalized
}

function normalizeEnvironment(env) {
  if (env === undefined || env === null) {
    return {}
  }

  if (typeof env !== 'object' || Array.isArray(env)) {
    throw new Error('execution environment must be an object')
  }

  const entries = Object.entries(env)

  if (entries.length > maxEnvironmentVariables) {
    throw new Error('too many environment variables')
  }

  let totalBytes = 0
  const normalized = {}

  for (const [key, value] of entries) {
    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
      typeof value !== 'string' ||
      value.includes('\0')
    ) {
      throw new Error('invalid execution environment')
    }

    totalBytes +=
      Buffer.byteLength(key, 'utf8') +
      Buffer.byteLength(value, 'utf8')

    if (totalBytes > maxEnvironmentBytes) {
      throw new Error('execution environment is too large')
    }

    normalized[key] = value
  }

  return normalized
}

async function prepareWorkspace(files) {
  const entries = Object.entries(files)

  if (entries.length === 0) {
    throw new Error('no files provided')
  }

  if (entries.length > maxFiles) {
    throw new Error('too many files')
  }

  let totalBytes = 0
  const workspace = await fs.mkdtemp(path.join(workRoot, 'job-'))

  try {
    for (const [name, content] of entries) {
      const safePath = normalizeFilePath(name)

      if (typeof content !== 'string') {
        throw new Error('file content must be text')
      }

      totalBytes += Buffer.byteLength(content, 'utf8')

      if (totalBytes > maxBytes) {
        throw new Error('project too large')
      }

      const destination = path.join(workspace, ...safePath.split('/'))
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, content, {
        encoding: 'utf8',
        mode: 0o444
      })
    }

    return workspace
  } catch (error) {
    await fs.rm(workspace, { recursive: true, force: true })
    throw error
  }
}

async function ensureImage(image) {
  try {
    await docker.getImage(image).inspect()
    return
  } catch {
    const stream = await docker.pull(image)

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
}

async function executeJob(job) {
  const language = getLanguage(job.language)

  if (!language) {
    throw new Error('unsupported language')
  }

  const files = job.files || {}
  const args = normalizeArguments(job.args)
  const environment = normalizeEnvironment(job.env)
  const entrypoint = normalizeFilePath(job.entrypoint || language.entrypoint)

  if (!Object.prototype.hasOwnProperty.call(files, entrypoint)) {
    throw new Error('entrypoint file not found')
  }

  const workspace = await prepareWorkspace(files)
  let container

  try {
    await ensureImage(language.image)

    container = await docker.createContainer({
      Image: language.image,
      Cmd: language.command(entrypoint, files, args),
      WorkingDir: '/workspace',
      User: '65532:65532',
      Env: [
        'HOME=/tmp',
        'PYTHONDONTWRITEBYTECODE=1',
        ...Object.entries(environment).map(([key, value]) =>
          key + '=' + value
        )
      ],
      HostConfig: {
        AutoRemove: true,
        NetworkMode: 'none',
        ReadonlyRootfs: true,
        Memory: memoryBytes,
        NanoCpus: nanoCpus,
        PidsLimit: pidsLimit,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Binds: [
          workspace + ':/workspace:ro'
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

    job.status = 'running'
    job.startedAt = new Date().toISOString()

    await container.start()

    const result = await Promise.race([
      container.wait(),
      new Promise(resolve => {
        setTimeout(() => resolve({ timedOut: true }), timeoutMs)
      })
    ])

    const timedOut = result?.timedOut === true

    if (timedOut) {
      try {
        await container.kill()
      } catch {}
    }

    let logs = Buffer.alloc(0)

    try {
      logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 2000
      })
    } catch {}

    const output = truncate(
      Buffer.isBuffer(logs) ? logs.toString('utf8') : String(logs)
    )

    job.finishedAt = new Date().toISOString()

    if (timedOut) {
      job.status = 'timeout'
      job.result = {
        stdout: output,
        stderr: '',
        exitCode: null,
        timedOut: true
      }
      return
    }

    job.status = result?.StatusCode === 0 ? 'succeeded' : 'failed'
    job.result = {
      stdout: output,
      stderr: result?.StatusCode === 0 ? '' : output,
      exitCode: result?.StatusCode ?? null,
      timedOut: false
    }
  } finally {
    await fs.rm(workspace, { recursive: true, force: true })

    if (container) {
      try {
        await container.remove({ force: true })
      } catch {}
    }
  }
}

async function processQueue() {
  while (running < concurrency && queue.length > 0) {
    const id = queue.shift()
    const job = jobs.get(id)

    if (!job) {
      continue
    }

    running += 1

    executeJob(job)
      .catch(error => {
        job.status = 'failed'
        job.finishedAt = new Date().toISOString()
        job.result = {
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          exitCode: null,
          timedOut: false
        }
      })
      .finally(() => {
        running -= 1
        processQueue()
      })
  }
}

export function enqueueJob({
  id = randomUUID(),
  language,
  entrypoint,
  files,
  args,
  env
}) {
  if (!id) {
    throw new Error('execution id is required')
  }

  if (jobs.has(id)) {
    throw new Error('execution id already exists')
  }

  const job = {
    id,
    language,
    entrypoint,
    files,
    args,
    env,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    result: null
  }

  jobs.set(id, job)
  queue.push(id)
  processQueue()

  return job
}

export function getJob(id) {
  return jobs.get(id) || null
}

export function listExecutionLanguages() {
  return Object.keys({
    python: true,
    c: true,
    cpp: true
  })
}
