import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const requireRunnerDependency = createRequire(new URL('../../services/runner/package.json', import.meta.url))
const WebSocket = requireRunnerDependency('ws')

const token = process.env.TERMINAL_E2E_TOKEN || 'terminal-e2e-token'
const baseUrl = process.env.TERMINAL_E2E_URL || 'http://127.0.0.1:10001'
const processBackend = process.env.TERMINAL_E2E_BACKEND === 'process'
const id = randomUUID()

function request(path, options = {}, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      baseUrl + path,
      {
        method: options.method || 'GET',
        headers: {
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
              }),
          Authorization: 'Bearer ' + token
        }
      },
      response => {
        let content = ''

        response.setEncoding('utf8')
        response.on('data', chunk => {
          content += chunk
        })
        response.on('end', () => {
          let json = null

          try {
            json = content ? JSON.parse(content) : null
          } catch {}

          resolve({
            status: response.statusCode || 0,
            body: json,
            text: content
          })
        })
      }
    )

    request.on('error', reject)

    if (body !== undefined) {
      request.write(body)
    }

    request.end()
  })
}

function waitForOutput(socket, predicate, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let output = ''

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('terminal output timeout: ' + output))
    }, timeoutMs)

    function cleanup() {
      clearTimeout(timer)
      socket.off('message', onMessage)
      socket.off('close', onClose)
    }

    function onMessage(data) {
      const text = data.toString('utf8')
      let payload

      try {
        payload = JSON.parse(text)
      } catch {
        output += text
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

    socket.on('message', onMessage)
    socket.on('close', onClose)
  })
}

const created = await request(
  '/v1/terminals',
  {
    method: 'POST'
  },
  JSON.stringify({
    id,
    files: {
      'main.js': 'console.log("terminal e2e")\n'
    }
  })
)

if (created.status !== 202) {
  throw new Error(
    'terminal create failed: ' +
    created.status +
    ' ' +
    created.text
  )
}

const initialFiles = await request(
  '/v1/terminals/' +
    encodeURIComponent(id) +
    '/files'
)

if (
  initialFiles.status !== 200 ||
  initialFiles.body?.files?.['main.js'] !== 'console.log("terminal e2e")\n'
) {
  throw new Error(
    'terminal workspace was not initialized: ' +
    initialFiles.text
  )
}

const socket = new WebSocket(
  baseUrl.replace('http', 'ws') +
    '/v1/terminals/' +
    encodeURIComponent(id),
  {
    headers: {
      Authorization: 'Bearer ' + token
    }
  }
)

await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error('terminal websocket open timeout')),
    15_000
  )

  socket.once('open', () => {
    clearTimeout(timer)
    resolve()
  })

  socket.once('error', reject)
})

socket.send(
  JSON.stringify({
    type: 'resize',
    cols: 120,
    rows: 32
  })
)

await waitForOutput(
  socket,
  output =>
    output.includes('poligo') ||
    output.includes('workspace') ||
    output.includes('$')
)

socket.send(
  JSON.stringify({
    type: 'input',
    data: 'pwd\n'
  })
)

const pwdOutput = await waitForOutput(
  socket,
  output => output.includes(processBackend ? '/tmp/poligo-process-e2e/' : '/workspace')
)

const expectedWorkspace = processBackend ? '/tmp/poligo-process-e2e/' : '/workspace'
if (!pwdOutput.includes(expectedWorkspace)) {
  throw new Error('workspace path was not reported: ' + pwdOutput)
}

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'POLIGO_ID:%s:%s\\\\n' \"$(id -u)\" \"$(id -g)\"\n"
  })
)

const identityOutput = await waitForOutput(
  socket,
  output => /POLIGO_ID:\d+:\d+/.test(output)
)

const identityMatch = identityOutput.match(/POLIGO_ID:(\d+):(\d+)/)
if (!identityMatch || identityMatch[1] !== identityMatch[2] || Number(identityMatch[1]) === 0) {
  throw new Error('Terminal must run as an unprivileged UID/GID: ' + identityOutput)
}
if (!processBackend && identityMatch[1] !== '1000') {
  throw new Error('Docker terminal must run as UID/GID 1000: ' + identityOutput)
}

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'PTY_OK\\n'\n"
  })
)

const ptyOutput = await waitForOutput(
  socket,
  output => output.includes('PTY_OK')
)

if (!ptyOutput.includes('PTY_OK')) {
  throw new Error('PTY command output was missing')
}

if (processBackend) {
  socket.send(JSON.stringify({
    type: 'input',
    data: 'command -v python3; command -v pip; python3 -m pip --version\n'
  }))

  const pipPathOutput = await waitForOutput(
    socket,
    output => output.includes('/.terminal-cache/python-venv/bin/pip')
  )

  if (!pipPathOutput.includes('/.terminal-cache/python-venv/bin/pip')) {
    throw new Error('Python venv pip was not active in the terminal: ' + pipPathOutput)
  }

  socket.send(JSON.stringify({
    type: 'input',
    data: 'pip install --disable-pip-version-check --no-input --retries 1 --timeout 20 requests\n'
  }))

  await waitForOutput(
    socket,
    output => /Successfully installed[^\r\n]*requests|Requirement already satisfied: requests/.test(output),
    90_000
  )

  socket.send(JSON.stringify({
    type: 'input',
    data: "python3 -c \"import requests; print('PYPI_IMPORT_OK:' + requests.__version__)\"\n"
  }))

  const pipImportOutput = await waitForOutput(
    socket,
    output => /PYPI_IMPORT_OK:\d+\.\d+/.test(output)
  )

  if (!pipImportOutput.includes('PYPI_IMPORT_OK:')) {
    throw new Error('Package installed from PyPI could not be imported: ' + pipImportOutput)
  }
}

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'created-by-terminal' > created.txt\n"
  })
)

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'SYNC_MARKER:%s\\n' \"$(cat created.txt)\"\n"
  })
)

await waitForOutput(
  socket,
  output => output.includes('SYNC_MARKER:created-by-terminal')
)

socket.send(
  JSON.stringify({
    type: 'input',
    data: 'sleep 10'
  })
)

await new Promise(resolve => setTimeout(resolve, 500))
socket.send(
  JSON.stringify({
    type: 'input',
    data: '\u0003'
  })
)

await waitForOutput(
  socket,
  output => output.includes('^C') || output.includes('Interrupt')
)

const files = await request(
  '/v1/terminals/' +
    encodeURIComponent(id) +
    '/files'
)

if (
  files.status !== 200 ||
  files.body?.files?.['created.txt'] !== 'created-by-terminal'
) {
  throw new Error(
    'terminal files were not synchronized: ' +
    files.text
  )
}

socket.close()

const closed = await request(
  '/v1/terminals/' + encodeURIComponent(id),
  {
    method: 'DELETE'
  }
)

if (closed.status !== 200) {
  throw new Error(
    'terminal close failed: ' +
    closed.status +
    ' ' +
    closed.text
  )
}

console.log('TERMINAL RUNNER E2E: PASS')
