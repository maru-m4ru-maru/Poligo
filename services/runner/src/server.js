import http from 'node:http'
import { existsSync } from 'node:fs'
import { WebSocketServer } from 'ws'
const terminalBackend = process.env.TERMINAL_BACKEND === 'process'
  ? await import('./terminal-process.js')
  : await import('./terminal.js')

const {
  attachTerminalSocket,
  closeTerminal,
  createTerminalSession,
  getTerminalFiles,
  updateTerminalFiles,
  listTerminals
} = terminalBackend
import { enqueueJob, getJob, listExecutionLanguages } from './executor.js'

const port = Number(process.env.PORT || 10001)
const runnerToken = process.env.RUNNER_TOKEN || ''
const maxRequestBytes = Number(process.env.MAX_REQUEST_BYTES || 8_000_000)

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''
  let size = 0

  for await (const chunk of request) {
    size += Buffer.byteLength(chunk)

    if (size > maxRequestBytes) {
      throw new Error('request too large')
    }

    body += chunk
  }

  return body ? JSON.parse(body) : {}
}

function authorized(request) {
  if (!runnerToken) {
    return false
  }

  return request.headers.authorization === 'Bearer ' + runnerToken
}

const terminalWebSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 1_048_576
})

const server = http.createServer(async (request, response) => {
  const requestPath = new URL(
    request.url || '/',
    'http://localhost'
  ).pathname.replace(/\/+$/, '') || '/'

  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    requestPath === '/health'
  ) {
    const health = {
      status: 'ok',
      service: 'runner',
      terminalBackend: process.env.TERMINAL_BACKEND === 'process' ? 'process' : 'docker',
      terminalReady: process.env.TERMINAL_BACKEND === 'process'
        ? process.getuid?.() === 0
        : existsSync(process.env.DOCKER_SOCKET || '/var/run/docker.sock')
    }

    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      })
      response.end()
    } else {
      send(response, 200, health)
    }

    return
  }

  if (!authorized(request)) {
    send(response, 401, {
      error: 'unauthorized'
    })
    return
  }

  if (request.method === 'GET' && requestPath === '/v1/languages') {
    send(response, 200, {
      languages: listExecutionLanguages()
    })
    return
  }

  if (
    request.method === 'GET' &&
    requestPath === '/v1/terminals'
  ) {
    const terminals = listTerminals()

    console.info('Runner terminal list requested', {
      terminalCount: terminals.length
    })

    send(response, 200, {
      terminals
    })
    return
  }

  if (
    request.method === 'POST' &&
    requestPath === '/v1/terminals'
  ) {
    try {
      const payload = await readJson(request)
      const session = await createTerminalSession(payload)

      send(response, 202, session)
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'invalid terminal request'
      const status = message.includes('capacity is currently full')
        ? 429
        : message.includes('too large') || message.includes('too many')
          ? 413
          : 400

      send(response, status, {
        error: message
      })
    }

    return
  }

  if (
    request.method === 'GET' &&
    requestPath.startsWith('/v1/terminals/') &&
    requestPath.endsWith('/files')
  ) {
    const id = requestPath.slice(
      '/v1/terminals/'.length,
      -'/files'.length
    )

    try {
      const files = await getTerminalFiles(id)

      send(response, 200, {
        files
      })
    } catch (error) {
      send(response, 404, {
        error: error instanceof Error
          ? error.message
          : 'terminal session not found'
      })
    }

    return
  }

  if (
    request.method === 'PUT' &&
    requestPath.startsWith('/v1/terminals/') &&
    requestPath.endsWith('/files')
  ) {
    const id = requestPath.slice(
      '/v1/terminals/'.length,
      -'/files'.length
    )

    if (!id || id.includes('/')) {
      send(response, 400, {
        error: 'invalid terminal session id'
      })
      return
    }

    try {
      const payload = await readJson(request)
      await updateTerminalFiles(id, payload.files)

      send(response, 200, {
        ok: true
      })
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'terminal workspace update failed'
      const status = message === 'terminal session not found'
        ? 404
        : message.includes('too large') || message.includes('too many')
          ? 413
          : 400

      send(response, status, {
        error: message
      })
    }

    return
  }

  if (
    request.method === 'DELETE' &&
    requestPath.startsWith('/v1/terminals/')
  ) {
    const id = requestPath.slice('/v1/terminals/'.length)

    try {
      await closeTerminal(id)

      send(response, 200, {
        ok: true
      })
    } catch (error) {
      send(response, 404, {
        error: error instanceof Error
          ? error.message
          : 'terminal session not found'
      })
    }

    return
  }

  if (request.method === 'POST' && requestPath === '/v1/run') {
    try {
      const payload = await readJson(request)
      const job = enqueueJob(payload)

      send(response, 202, {
        id: job.id,
        status: job.status
      })
    } catch (error) {
      send(response, 400, {
        error: error instanceof Error ? error.message : 'invalid request'
      })
    }

    return
  }

  if (request.method === 'GET' && requestPath.startsWith('/v1/runs/')) {
    const id = requestPath.slice('/v1/runs/'.length)
    const job = getJob(id)

    if (!job) {
      send(response, 404, {
        error: 'execution not found'
      })
      return
    }

    send(response, 200, {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result
    })
    return
  }

  if (requestPath.startsWith('/v1/terminals')) {
    console.warn('Runner terminal route not found', {
      method: request.method,
      path: requestPath
    })
  }

  send(response, 404, {
    error: 'not found'
  })
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(
    request.url || '/',
    'http://localhost'
  )
  const prefix = '/v1/terminals/'

  if (!url.pathname.startsWith(prefix)) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    return
  }

  const id = url.pathname.slice(prefix.length)

  if (!id || id.includes('/')) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    return
  }

  if (!authorized(request)) {
    console.warn('Terminal websocket rejected', {
      id,
      authorizationHeaderPresent: Boolean(request.headers.authorization)
    })
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    return
  }

  terminalWebSocketServer.handleUpgrade(
    request,
    socket,
    head,
    client => {
      console.info('Terminal websocket accepted', { id })

      Promise.resolve(attachTerminalSocket(id, client)).catch(error => {
        console.error('Terminal socket attach failed', {
          id,
          message: error instanceof Error ? error.message : String(error)
        })

        if (client.readyState === 1) {
          client.close(1011, 'terminal attach failed')
        }
      })
    }
  )
})

server.listen(port, '0.0.0.0', () => {
  console.log('Poligo runner listening on ' + port)
})
