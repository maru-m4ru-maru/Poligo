import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const frontend = readFileSync(path.join(root, 'apps/web/src/main.jsx'), 'utf8')
const server = readFileSync(path.join(root, 'services/api/src/server.js'), 'utf8')

test('Poligo AI is the only provider and mode label shown to users', () => {
  assert.match(frontend, /<strong>Poligo AI<\/strong>/)
  assert.doesNotMatch(frontend, /OpenRouter/)
  assert.doesNotMatch(frontend, /ai-model-picker/)
  assert.doesNotMatch(frontend, /自動.{0,10}速度重視|速度重視|賢さ重視|推論重視/)
  assert.doesNotMatch(frontend, /aiMode|setAiMode|message\.model|result\.model/)
})

test('AI responses never include provider or model metadata', () => {
  const start = server.indexOf('async function handleAiAssist(')
  const end = server.indexOf('\nconst server = http.createServer', start)
  assert.ok(start >= 0 && end > start)

  const handler = server.slice(start, end)
  assert.match(handler, /name: 'Cloudflare Workers AI'/)
  assert.match(handler, /name: 'OpenRouter'/)
  assert.ok(handler.indexOf("name: 'Cloudflare Workers AI'") < handler.indexOf("name: 'OpenRouter'"))
  assert.match(handler, /if \(!cloudflareWorkersAi\.enabled && !openRouterApiKey\)/)
  assert.match(handler, /send\(response, 200, \{\s*reply:[\s\S]*?edits\s*\}\)/)
  assert.doesNotMatch(handler, /model: selectedModel\.model/)
  assert.doesNotMatch(handler, /mode: selectedModel\.mode/)
})
