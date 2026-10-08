import http from 'node:http'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

const token = 'terminal-e2e-token'
const baseUrl = 'http://127.0.0.1:10001'
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
  output => output.includes('/workspace')
)

if (!pwdOutput.includes('/workspace')) {
  throw new Error('workspace path was not reported')
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

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'created-by-terminal' > created.txt\n"
  })
)

await waitForOutput(
  socket,
  output => output.includes('workspace')
)

socket.send(
  JSON.stringify({
    type: 'input',
    data: "printf 'SYNC_MARKER:%s\\n' \"$(cat created.txt)\"\\n"
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
