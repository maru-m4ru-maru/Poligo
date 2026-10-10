import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { after, before, test } from 'node:test'
import { once } from 'node:events'
import net from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../..', import.meta.url))
const runnerToken = 'runner-health-test-token'

let runner
let baseUrl
let output = ''

async function reservePort() {
  const socket = net.createServer()

  await new Promise((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })

  const address = socket.address()

  await new Promise((resolve, reject) => {
    socket.close(error => error ? reject(error) : resolve())
  })

  return address.port
}

async function waitForRunner() {
  const deadline = Date.now() + 10_000
  let lastStatus = 'not responding'

  while (Date.now() < deadline) {
    if (runner.exitCode !== null) {
      throw new Error('Runner exited before becoming ready: ' + output)
    }

    try {
      const response = await fetch(baseUrl + '/health', {
        signal: AbortSignal.timeout(1_000)
      })

      lastStatus = String(response.status)
      await response.arrayBuffer()

      if (response.status === 200) {
        return
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error)
    }

    await delay(100)
  }

  throw new Error(
    'Runner did not become ready: ' + lastStatus + '\n' + output
  )
}

before(async () => {
  const port = await reservePort()
  baseUrl = 'http://127.0.0.1:' + port

  runner = spawn(
    process.execPath,
    ['services/runner/src/server.js'],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: String(port),
        RUNNER_TOKEN: runnerToken,
        TERMINAL_BACKEND: 'process',
        TERMINAL_RUN_ROOT: '/tmp/poligo-runner-health-test-' + process.pid
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  runner.stdout.setEncoding('utf8')
  runner.stderr.setEncoding('utf8')
  runner.stdout.on('data', chunk => {
    output += chunk
  })
  runner.stderr.on('data', chunk => {
    output += chunk
  })

  await waitForRunner()
})

after(async () => {
  if (!runner || runner.exitCode !== null || runner.signalCode !== null) {
    return
  }

  runner.kill('SIGTERM')

  await Promise.race([
    once(runner, 'exit'),
    delay(2_000)
  ])

  if (runner.exitCode === null && runner.signalCode === null) {
    runner.kill('SIGKILL')
  }
})

test('GET /health is available without a bearer token', async () => {
  const response = await fetch(baseUrl + '/health')
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'runner')
  assert.equal(body.terminalBackend, 'process')
  assert.equal(typeof body.terminalReady, 'boolean')
})

test('HEAD /health is available without a bearer token and has no body', async () => {
  const response = await fetch(baseUrl + '/health', {
    method: 'HEAD'
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(await response.text(), '')
})

test('health checks remain public without disabling Runner API authentication', async () => {
  const response = await fetch(baseUrl + '/v1/languages')

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    error: 'unauthorized'
  })
})
