const DEFAULT_CLOUDFLARE_AI_MODEL = '@cf/qwen/qwen2.5-coder-32b-instruct'

export function getCloudflareWorkersAiConfig(env = process.env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const apiToken = String(env.CLOUDFLARE_API_TOKEN || '').trim()
  const model = String(env.CLOUDFLARE_AI_MODEL || DEFAULT_CLOUDFLARE_AI_MODEL).trim()

  return {
    enabled: Boolean(accountId && apiToken),
    accountId,
    apiToken,
    model
  }
}

export async function requestCloudflareWorkersAi({
  accountId,
  apiToken,
  model = DEFAULT_CLOUDFLARE_AI_MODEL,
  messages,
  fetchImpl = globalThis.fetch,
  timeoutMs = 25_000
}) {
  if (!/^[a-f0-9]{32}$/i.test(String(accountId || ''))) {
    throw new Error('Invalid Cloudflare account ID')
  }

  if (typeof apiToken !== 'string' || !apiToken.trim()) {
    throw new Error('Cloudflare Workers AI API token is missing')
  }

  if (!/^@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(model || ''))) {
    throw new Error('Invalid Cloudflare Workers AI model')
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('AI messages are required')
  }

  const endpoint = 'https://api.cloudflare.com/client/v4/accounts/' +
    encodeURIComponent(accountId) +
    '/ai/run/' +
    model

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiToken,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      messages,
      temperature: 0.2,
      max_tokens: 8_000
    })
  })

  let body

  try {
    body = await response.json()
  } catch {
    body = {}
  }

  if (!response.ok || body?.success === false) {
    const detail = body?.errors?.[0]?.message ||
      body?.error?.message ||
      'Cloudflare Workers AI request failed'

    throw new Error(detail)
  }

  const content = body?.result?.response ??
    body?.result?.choices?.[0]?.message?.content ??
    body?.choices?.[0]?.message?.content

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Cloudflare Workers AI returned an empty response')
  }

  return content
}

export { DEFAULT_CLOUDFLARE_AI_MODEL }
