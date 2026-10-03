import http from 'node:http'
import { enqueueJob, getJob, listExecutionLanguages } from './executor.js'

const port = Number(process.env.PORT || 10001)
const runnerToken = process.env.RUNNER_TOKEN || ''

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
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

function authorized(request) {
  if (!runnerToken) {
    return false
  }

  return request.headers.authorization === 'Bearer ' + runnerToken
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, {
      status: 'ok',
      service: 'runner'
    })
    return
  }

  if (!authorized(request)) {
    send(response, 401, {
      error: 'unauthorized'
    })
    return
  }

  if (request.method === 'GET' && request.url === '/v1/languages') {
    send(response, 200, {
      languages: listExecutionLanguages()
    })
    return
  }

  if (request.method === 'POST' && request.url === '/v1/run') {
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

  if (request.method === 'GET' && request.url.startsWith('/v1/runs/')) {
    const id = request.url.slice('/v1/runs/'.length)
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

  send(response, 404, {
    error: 'not found'
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log('Poligo runner listening on ' + port)
})
