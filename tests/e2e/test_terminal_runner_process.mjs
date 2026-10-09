import http from 'node:http'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

const token = process.env.RUNNER_TEST_TOKEN || 'terminal-process-e2e-token'
const baseUrl = process.env.RUNNER_TEST_URL || 'http://127.0.0.1:10001'
const firstId = randomUUID()
const secondId = randomUUID()
const createdIds = []
const sockets = new Set()

function request(path, options = {}, body, authToken = token) {
  return new Promise((resolve, reject) => {
    const serialized = body === undefined ? undefined : JSON.stringify(body)
    const headers = {
      ...(authToken
        ? {
            Authorization: 'Bearer ' + authToken
          }
        : {}),
      ...(serialized === undefined
        ? {}
        : {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(serialized)
          })
    }

    const outgoing = http.request(
      baseUrl + path,
      {
        method: options.method || 'GET',
        headers,
        timeout: 15_000
      },
      response => {
        let text = ''

        response.setEncoding('utf8')
        response.on('data', chunk => {
          text += chunk
        })
        response.on('end', () => {
          let json = null

          try {
            json = text ? JSON.parse(text) : null
          } catch {}

          resolve({
            status: response.statusCode || 0,
            body: json,
            text
          })
        })
      }
    )

    outgoing.on('timeout', () => {
      outgoing.destroy(new Error('request timeout: ' + path))
    })
    outgoing.on('error', reject)

    if (serialized !== undefined) {
      outgoing.write(serialized)
    }

    outgoing.end()
  })
}

function openSocket(id) {
  const socket = new WebSocket(
    baseUrl.replace(/^http/, 'ws') +
      '/v1/terminals/' +
      encodeURIComponent(id),
    {
      headers: {
        Authorization: 'Bearer ' + token
      },
      maxPayload: 1_048_576
    }
  )

  sockets.add(socket)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.terminate()
      reject(new Error('websocket open timeout'))
    }, 15_000)

    socket.once('open', () => {
      clearTimeout(timeout)
      resolve(socket)
    })

    socket.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function sendAndWait(socket, data, predicate, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let output = ''

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('terminal output timeout: ' + output))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timeout)
      socket.off('message', onMessage)
      socket.off('close', onClose)
      socket.off('error', onError)
    }

    function onMessage(message) {
      let payload

      try {
        payload = JSON.parse(message.toString('utf8'))
      } catch {
        output += message.toString('utf8')
        if (predicate(output)) {
          cleanup()
          resolve(output)
        }
        return
      }

      if (payload?.type === 'output') {
        output += payload.data || ''

        if (predicate(output)) {
          cleanup()
          resolve(output)
        }
      }

      if (payload?.type === 'error') {
        cleanup()
        reject(new Error(payload.message || 'terminal error'))
      }
    }

    function onClose() {
      cleanup()
      reject(new Error('terminal socket closed'))
    }

    function onError(error) {
      cleanup()
      reject(error)
    }

    socket.on('message', onMessage)
    socket.on('close', onClose)
    socket.on('error', onError)
    socket.send(JSON.stringify({
      type: 'input',
      data
    }))
  })
}

async function createSession(id, files) {
  const response = await request('/v1/terminals', {
    method: 'POST'
  }, {
    id,
    files
  })

  if (response.status !== 202) {
    throw new Error(
      'terminal create failed: ' + response.status + ' ' + response.text
    )
  }

  createdIds.push(id)
  return response.body
}

async function closeSession(id) {
  const socket = [...sockets].find(item => item.terminalId === id)

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close()
  }

  const response = await request(
    '/v1/terminals/' + encodeURIComponent(id),
    {
      method: 'DELETE'
    }
  )

  if (response.status !== 200) {
    throw new Error(
      'terminal close failed: ' + response.status + ' ' + response.text
    )
  }

  const missing = await request(
    '/v1/terminals/' + encodeURIComponent(id) + '/files'
  )

  if (missing.status !== 404) {
    throw new Error('closed terminal still exists')
  }
}

async function run() {
  const health = await request('/health', {}, undefined, null)

  if (
    health.status !== 200 ||
    health.body?.terminalBackend !== 'process' ||
    health.body?.terminalReady !== true
  ) {
    throw new Error('hosted terminal health check failed: ' + health.text)
  }

  const unauthenticated = await request(
    '/v1/terminals',
    {
      method: 'POST'
    },
    {
      id: randomUUID(),
      files: {
        'main.js': 'console.log(1)'
      }
    },
    null
  )

  if (unauthenticated.status !== 401) {
    throw new Error('unauthenticated terminal creation was not rejected')
  }

  const invalidPath = await request('/v1/terminals', {
    method: 'POST'
  }, {
    id: randomUUID(),
    files: {
      '../escape.txt': 'unsafe'
    }
  })

  if (invalidPath.status !== 400) {
    throw new Error('path traversal was not rejected')
  }

  await createSession(firstId, {
    'main.js': 'console.log("initial file")\n',
    'nested/source.txt': 'initial nested file\n',
    'private.txt': 'isolated file\n'
  })

  const initial = await request(
    '/v1/terminals/' + encodeURIComponent(firstId) + '/files'
  )

  if (
    initial.status !== 200 ||
    initial.body?.files?.['main.js'] !== 'console.log("initial file")\n' ||
    initial.body?.files?.['nested/source.txt'] !== 'initial nested file\n'
  ) {
    throw new Error('initial workspace files are incorrect: ' + initial.text)
  }

  const first = await openSocket(firstId)
  first.terminalId = firstId
  first.send(JSON.stringify({
    type: 'resize',
    cols: 100,
    rows: 30
  }))

  const prompt = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => {
      first.off('message', onMessage)
      reject(new Error('initial terminal prompt timeout: ' + output))
    }, 15_000)

    function onMessage(message) {
      try {
        const payload = JSON.parse(message.toString('utf8'))
        if (payload.type === 'output') {
          output += payload.data || ''
        }
      } catch {
        output += message.toString('utf8')
      }

      if (output.includes('@poligo:')) {
        clearTimeout(timeout)
        first.off('message', onMessage)
        resolve(output)
      }
    }

    first.on('message', onMessage)
  })

  if (!prompt.includes('@poligo:')) {
    throw new Error('shell prompt was not rendered')
  }

  const pwd = await sendAndWait(
    first,
    'pwd\n',
    output => output.includes('/poligo-terminal-sessions/' + firstId)
  )

  if (!pwd.includes('/poligo-terminal-sessions/' + firstId)) {
    throw new Error('terminal did not start in its session workspace')
  }

  const node = await sendAndWait(
    first,
    "node -e \"console.log('NODE_RUNTIME_OK')\"\n",
    output => output.includes('NODE_RUNTIME_OK')
  )

  if (!node.includes('NODE_RUNTIME_OK')) {
    throw new Error('Node.js command did not run')
  }

  const python = await sendAndWait(
    first,
    "python3 -c \"print('PYTHON_RUNTIME_OK')\"\n",
    output => output.includes('PYTHON_RUNTIME_OK')
  )

  if (!python.includes('PYTHON_RUNTIME_OK')) {
    throw new Error('Python command did not run')
  }

  const secretCheck = await sendAndWait(
    first,
    "printf 'RUNNER_SECRET:%s\\n' \"${RUNNER_TOKEN-UNSET}\"\n",
    output => output.includes('RUNNER_SECRET:UNSET')
  )

  if (!secretCheck.includes('RUNNER_SECRET:UNSET')) {
    throw new Error('runner authentication secret leaked into terminal')
  }

  const stderr = await sendAndWait(
    first,
    "printf 'STDERR_CHANNEL_OK\\n' >&2\n",
    output => output.includes('STDERR_CHANNEL_OK')
  )

  if (!stderr.includes('STDERR_CHANNEL_OK')) {
    throw new Error('stderr output was not displayed')
  }

  const fileOutput = await sendAndWait(
    first,
    "mkdir -p generated && printf 'FILE_SYNC_OK' > generated/output.txt && cat generated/output.txt\n",
    output => output.includes('FILE_SYNC_OK')
  )

  if (!fileOutput.includes('FILE_SYNC_OK')) {
    throw new Error('file write or read did not work')
  }

  const hidden = await sendAndWait(
    first,
    "mkdir -p node_modules && printf 'DO_NOT_SYNC' > node_modules/hidden.txt && printf 'IGNORE_READY\\n'\n",
    output => output.includes('IGNORE_READY')
  )

  if (!hidden.includes('IGNORE_READY')) {
    throw new Error('workspace exclusion test command failed')
  }

  await createSession(secondId, {
    'second.txt': 'second session\n'
  })

  const second = await openSocket(secondId)
  second.terminalId = secondId

  const isolated = await sendAndWait(
    second,
    "cat /tmp/poligo-terminal-sessions/" + firstId + "/private.txt 2>&1\n",
    output => output.includes('Permission denied')
  )

  if (!isolated.includes('Permission denied')) {
    throw new Error('terminal sessions can access each other\'s workspace')
  }

  const files = await request(
    '/v1/terminals/' + encodeURIComponent(firstId) + '/files'
  )

  if (
    files.status !== 200 ||
    files.body?.files?.['generated/output.txt'] !== 'FILE_SYNC_OK' ||
    'node_modules/hidden.txt' in files.body?.files
  ) {
    throw new Error('terminal file collection failed: ' + files.text)
  }

  const interrupted = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => {
      first.off('message', onMessage)
      reject(new Error('Ctrl+C test timed out: ' + output))
    }, 15_000)

    function cleanup() {
      clearTimeout(timeout)
      first.off('message', onMessage)
    }

    function onMessage(message) {
      let payload

      try {
        payload = JSON.parse(message.toString('utf8'))
      } catch {
        return
      }

      if (payload.type === 'output') {
        output += payload.data || ''

        if (output.includes('^C')) {
          cleanup()
          resolve(output)
        }
      }
    }

    first.on('message', onMessage)
    first.send(JSON.stringify({
      type: 'input',
      data: 'sleep 15\n'
    }))

    setTimeout(() => {
      first.send(JSON.stringify({
        type: 'input',
        data: '\u0003'
      }))
    }, 300)
  })

  if (!interrupted.includes('^C')) {
    throw new Error('Ctrl+C did not interrupt the running command')
  }

  const updated = await sendAndWait(
    first,
    "printf 'UPDATED_VALUE' >> generated/output.txt && cat generated/output.txt\n",
    output => output.includes('FILE_SYNC_OKUPDATED_VALUE')
  )

  if (!updated.includes('FILE_SYNC_OKUPDATED_VALUE')) {
    throw new Error('file modifications are not retained')
  }

  const finalFiles = await request(
    '/v1/terminals/' + encodeURIComponent(firstId) + '/files'
  )

  if (
    finalFiles.status !== 200 ||
    finalFiles.body?.files?.['generated/output.txt'] !== 'FILE_SYNC_OKUPDATED_VALUE'
  ) {
    throw new Error('modified file was not included in the sync snapshot')
  }

  await closeSession(secondId)
  await closeSession(firstId)

  console.log('HOSTED TERMINAL E2E: PASS')
}

try {
  await run()
} finally {
  for (const socket of sockets) {
    try {
      socket.terminate()
    } catch {}
  }

  for (const id of createdIds.reverse()) {
    try {
      await request(
        '/v1/terminals/' + encodeURIComponent(id),
        {
          method: 'DELETE'
        }
      )
    } catch {}
  }
}
