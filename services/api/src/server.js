import http from 'node:http'
import { randomUUID } from 'node:crypto'

const port = Number(process.env.PORT || 10000)
const runnerUrl = process.env.RUNNER_URL || ''
const runnerToken = process.env.RUNNER_TOKEN || ''
const allowedOrigin = process.env.CORS_ORIGIN || '*'

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''

  for await (const chunk of request) {
    body += chunk

    if (body.length > 2_000_000) {
      throw new Error('request too large')
    }
  }

  return body ? JSON.parse(body) : {}
}

function runnerHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  }

  if (runnerToken) {
    headers.Authorization = 'Bearer ' + runnerToken
  }

  return headers
}

async function handleExecution(request, response) {
  const payload = await readJson(request)

  if (!runnerUrl) {
    send(response, 503, {
      error: 'runner is not configured'
    })
    return
  }

  const id = randomUUID()

  const runnerResponse = await fetch(
    runnerUrl.replace(/\/$/, '') + '/v1/run',
    {
      method: 'POST',
      headers: runnerHeaders(),
      body: JSON.stringify({
        id,
        language: payload.language || 'plaintext',
        entrypoint: payload.entrypoint || null,
        files: payload.files || {}
      })
    }
  )

  let result

  try {
    result = await runnerResponse.json()
  } catch {
    result = {
      error: 'runner returned invalid JSON'
    }
  }

  send(response, runnerResponse.ok ? 202 : 502, {
    id,
    ...result
  })
}

async function handleExecutionStatus(response, id) {
  if (!runnerUrl) {
    send(response, 503, {
      error: 'runner is not configured'
    })
    return
  }

  const runnerResponse = await fetch(
    runnerUrl.replace(/\/$/, '') + '/v1/runs/' + encodeURIComponent(id),
    {
      method: 'GET',
      headers: runnerHeaders()
    }
  )

  let result

  try {
    result = await runnerResponse.json()
  } catch {
    result = {
      error: 'runner returned invalid JSON'
    }
  }

  send(response, runnerResponse.ok ? 200 : 502, result)
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, {})
    return
  }

  if (request.method === 'GET' && request.url === '/api/health') {
    send(response, 200, {
      status: 'ok',
      service: 'api',
      runner: Boolean(runnerUrl)
    })
    return
  }

  if (request.method === 'POST' && request.url === '/api/executions') {
    try {
      await handleExecution(request, response)
    } catch (error) {
      send(response, 502, {
        error: error instanceof Error ? error.message : 'runner request failed'
      })
    }
    return
  }

  if (request.method === 'GET' && request.url.startsWith('/api/executions/')) {
    const id = request.url.slice('/api/executions/'.length)

    if (!id || id.includes('/')) {
      send(response, 400, {
        error: 'invalid execution id'
      })
      return
    }

    try {
      await handleExecutionStatus(response, id)
    } catch (error) {
      send(response, 502, {
        error: error instanceof Error ? error.message : 'runner request failed'
      })
    }
    return
  }

  send(response, 404, {
    error: 'not found'
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log('Poligo API listening on ' + port)
})
