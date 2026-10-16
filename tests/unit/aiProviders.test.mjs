import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_CLOUDFLARE_AI_MODEL,
  getCloudflareWorkersAiConfig,
  requestCloudflareWorkersAi
} from '../../services/api/src/aiProviders.js'

const accountId = '1234567890abcdef1234567890abcdef'
const messages = [
  { role: 'system', content: 'Return JSON.' },
  { role: 'user', content: 'Fix this code.' }
]

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body
    }
  }
}

test('Cloudflare Workers AI is optional and has a coding-model default', () => {
  const disabled = getCloudflareWorkersAiConfig({})
  assert.equal(disabled.enabled, false)
  assert.equal(disabled.model, DEFAULT_CLOUDFLARE_AI_MODEL)

  const configured = getCloudflareWorkersAiConfig({
    CLOUDFLARE_ACCOUNT_ID: ' ' + accountId + ' ',
    CLOUDFLARE_API_TOKEN: ' token-value ',
    CLOUDFLARE_AI_MODEL: '@cf/qwen/qwen3-30b-a3b-fp8'
  })
  assert.equal(configured.enabled, true)
  assert.equal(configured.accountId, accountId)
  assert.equal(configured.apiToken, 'token-value')
  assert.equal(configured.model, '@cf/qwen/qwen3-30b-a3b-fp8')
})

test('calls the Cloudflare Workers AI REST endpoint and returns its generated text', async () => {
  let capturedUrl = ''
  let capturedOptions = {}

  const result = await requestCloudflareWorkersAi({
    accountId,
    apiToken: 'test-secret',
    messages,
    fetchImpl: async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return mockResponse(200, {
        success: true,
        result: {
          response: '{"reply":"Updated the code.","edits":[]}'
        }
      })
    }
  })

  assert.equal(
    capturedUrl,
    'https://api.cloudflare.com/client/v4/accounts/' +
      accountId +
      '/ai/run/@cf/qwen/qwen2.5-coder-32b-instruct'
  )
  assert.equal(capturedOptions.method, 'POST')
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-secret')
  assert.equal(capturedOptions.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(capturedOptions.body).messages, messages)
  assert.equal(JSON.parse(capturedOptions.body).temperature, 0.2)
  assert.equal(JSON.parse(capturedOptions.body).max_tokens, 8000)
  assert.equal(result, '{"reply":"Updated the code.","edits":[]}')
})

test('accepts OpenAI-compatible response bodies from Workers AI', async () => {
  const result = await requestCloudflareWorkersAi({
    accountId,
    apiToken: 'test-secret',
    messages,
    fetchImpl: async () => mockResponse(200, {
      success: true,
      result: {
        choices: [{
          message: {
            content: '{"reply":"Hello.","edits":[]}'
          }
        }]
      }
    })
  })

  assert.equal(result, '{"reply":"Hello.","edits":[]}')
})

test('rejects invalid account IDs, model paths, and empty message lists', async () => {
  await assert.rejects(
    requestCloudflareWorkersAi({
      accountId: 'not-an-account-id',
      apiToken: 'test-secret',
      messages,
      fetchImpl: async () => mockResponse(200, {})
    }),
    /Invalid Cloudflare account ID/
  )

  await assert.rejects(
    requestCloudflareWorkersAi({
      accountId,
      apiToken: 'test-secret',
      model: '../unsafe/model',
      messages,
      fetchImpl: async () => mockResponse(200, {})
    }),
    /Invalid Cloudflare Workers AI model/
  )

  await assert.rejects(
    requestCloudflareWorkersAi({
      accountId,
      apiToken: 'test-secret',
      messages: [],
      fetchImpl: async () => mockResponse(200, {})
    }),
    /AI messages are required/
  )
})

test('surfaces upstream errors for internal fallback handling', async () => {
  await assert.rejects(
    requestCloudflareWorkersAi({
      accountId,
      apiToken: 'test-secret',
      messages,
      fetchImpl: async () => mockResponse(429, {
        success: false,
        errors: [{ message: 'Rate limit reached' }]
      })
    }),
    /Rate limit reached/
  )

  await assert.rejects(
    requestCloudflareWorkersAi({
      accountId,
      apiToken: 'test-secret',
      messages,
      fetchImpl: async () => mockResponse(200, {
        success: true,
        result: {}
      })
    }),
    /returned an empty response/
  )
})
