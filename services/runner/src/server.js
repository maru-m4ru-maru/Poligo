import http from 'node:http'

const port = Number(process.env.PORT || 10001)

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

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, {
      status: 'ok',
      service: 'runner'
    })
    return
  }

  if (request.method === 'POST' && request.url === '/v1/run') {
    try {
      const payload = await readJson(request)

      send(response, 200, {
        status: 'accepted',
        mode: 'runner-contract',
        language: payload.language || 'plaintext'
      })
    } catch (error) {
      send(response, 400, {
        error: error instanceof Error ? error.message : 'invalid request'
      })
    }
    return
  }

  send(response, 404, {
    error: 'not found'
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log('Poligo runner listening on ' + port)
})
