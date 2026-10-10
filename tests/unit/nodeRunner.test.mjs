import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { getLanguage, listLanguages } from '../../services/runner/src/languages.js'
import { decodeDockerLogs } from '../../services/runner/src/dockerLogs.js'

process.env.EXECUTION_TIMEOUT_MS = '3000'

const dockerAvailable = (() => {
  try {
    execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
      stdio: 'pipe',
      timeout: 5000
    })
    return true
  } catch {
    return false
  }
})()

const { enqueueJob, getJob, listExecutionLanguages } = await import(
  '../../services/runner/src/executor.js'
)

function dockerFrame(streamType, value) {
  const payload = Buffer.from(value, 'utf8')
  const header = Buffer.alloc(8)
  header[0] = streamType
  header.writeUInt32BE(payload.length, 4)
  return Buffer.concat([header, payload])
}

async function waitForJob(id, timeoutMs = 240_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const job = getJob(id)

    if (job && ['succeeded', 'failed', 'timeout'].includes(job.status)) {
      return job
    }

    await new Promise(resolve => setTimeout(resolve, 50))
  }

  assert.fail('Node.js execution did not finish within ' + timeoutMs + 'ms')
}

async function executeNode({ files, entrypoint = 'main.js', args = [], env = {}, stdin = '' }) {
  const job = enqueueJob({
    language: 'node',
    entrypoint,
    files,
    args,
    env,
    stdin
  })

  return waitForJob(job.id)
}

test('Node.js runtime is registered with a pinned Node 24 image', () => {
  const node = getLanguage('node')

  assert.ok(node)
  assert.equal(node.image, 'node:24.21.0-bookworm-slim')
  assert.equal(node.entrypoint, 'main.js')
  assert.deepEqual(
    node.command('src/main.js', {}, ['two words', '$(touch /tmp/no-shell)']),
    ['node', '/workspace/src/main.js', 'two words', '$(touch /tmp/no-shell)']
  )
  assert.ok(listLanguages().includes('node'))
  assert.ok(listExecutionLanguages().includes('node'))
})

test('Docker log decoder separates stdout and stderr and handles raw output', () => {
  const combined = Buffer.concat([
    dockerFrame(1, 'hello\n'),
    dockerFrame(2, 'warning\n'),
    dockerFrame(1, 'world\n')
  ])

  assert.deepEqual(decodeDockerLogs(combined), {
    stdout: 'hello\nworld\n',
    stderr: 'warning\n'
  })

  assert.deepEqual(decodeDockerLogs(Buffer.from('plain output')), {
    stdout: 'plain output',
    stderr: ''
  })

  assert.deepEqual(decodeDockerLogs(Buffer.alloc(0)), {
    stdout: '',
    stderr: ''
  })
})

test('CI runner provides a working Docker daemon', { skip: !process.env.CI }, () => {
  assert.equal(dockerAvailable, true, 'Docker integration tests require the Docker daemon')
})

test('Node.js executes inside the isolated Docker sandbox', {
  skip: !dockerAvailable,
  timeout: 300_000
}, async t => {
  await t.test('ES modules, relative imports, arguments, environment, stdin, filesystem and permissions', async () => {
    const result = await executeNode({
      files: {
        'main.js': [
          'import process from "node:process"',
          'import { writeFile, unlink } from "node:fs/promises"',
          'import { message } from "./helper.js"',
          'let stdin = ""',
          'for await (const chunk of process.stdin) stdin += chunk',
          'let workspaceWritable = true',
          'try { await writeFile("/workspace/blocked.txt", "blocked") } catch { workspaceWritable = false }',
          'const temp = "/tmp/poligo-node-" + process.pid',
          'await writeFile(temp, "tmp-ok")',
          'await unlink(temp)',
          'console.log(JSON.stringify({ message, args: process.argv.slice(2), env: process.env.POLIGO_TEST_VALUE, stdin, cwd: process.cwd(), uid: process.getuid(), workspaceWritable, tmpWritable: true }))'
        ].join('\n'),
        'helper.js': 'export const message = "esm-relative-import-ok"',
        'package.json': JSON.stringify({ type: 'module' })
      },
      args: ['two words', '$(touch /tmp/no-shell)'],
      env: { POLIGO_TEST_VALUE: 'env-ok' },
      stdin: '標準入力\nsecond line\n'
    })

    assert.equal(result.status, 'succeeded', result.result?.stderr)
    const output = JSON.parse(result.result.stdout.trim())
    assert.equal(output.message, 'esm-relative-import-ok')
    assert.deepEqual(output.args, ['two words', '$(touch /tmp/no-shell)'])
    assert.equal(output.env, 'env-ok')
    assert.equal(output.stdin, '標準入力\nsecond line\n')
    assert.equal(output.cwd, '/workspace')
    assert.equal(output.uid, 65532)
    assert.equal(output.workspaceWritable, false)
    assert.equal(output.tmpWritable, true)
  })

  await t.test('CommonJS files work even in an ESM package', async () => {
    const result = await executeNode({
      entrypoint: 'main.cjs',
      files: {
        'main.cjs': 'const { answer } = require("./helper.cjs"); console.log(answer)',
        'helper.cjs': 'module.exports = { answer: "commonjs-ok" }',
        'package.json': JSON.stringify({ type: 'module' })
      }
    })

    assert.equal(result.status, 'succeeded', result.result?.stderr)
    assert.equal(result.result.stdout.trim(), 'commonjs-ok')
  })

  await t.test('stdout, stderr and non-zero exit codes are reported separately', async () => {
    const result = await executeNode({
      files: {
        'main.js': [
          'console.log("stdout-marker")',
          'console.error("stderr-marker")',
          'process.exitCode = 7'
        ].join('\n')
      }
    })

    assert.equal(result.status, 'failed')
    assert.equal(result.result.exitCode, 7)
    assert.match(result.result.stdout, /stdout-marker/)
    assert.match(result.result.stderr, /stderr-marker/)
    assert.doesNotMatch(result.result.stdout, /stderr-marker/)
    assert.doesNotMatch(result.result.stderr, /stdout-marker/)
  })

  await t.test('infinite loops are killed by the execution timeout', async () => {
    const startedAt = Date.now()
    const result = await executeNode({
      files: {
        'main.js': 'while (true) {}'
      }
    })

    assert.equal(result.status, 'timeout')
    assert.equal(result.result.timedOut, true)
    assert.ok(Date.now() - startedAt < 15_000)
  })

  await t.test('path traversal is rejected and failed workspaces are cleaned', async () => {
    const result = await executeNode({
      files: {
        'main.js': 'console.log("should-not-run")',
        '../escape.js': 'console.log("escape")'
      }
    })

    assert.equal(result.status, 'failed')
    assert.match(result.result.stderr, /invalid file path/)
    assert.equal(result.result.stdout, '')
  })

  await t.test('invalid argument and stdin types fail safely', async () => {
    const invalidArgs = enqueueJob({
      language: 'node',
      entrypoint: 'main.js',
      files: { 'main.js': 'console.log("no")' },
      args: ['valid', null]
    })
    const argsResult = await waitForJob(invalidArgs.id)
    assert.equal(argsResult.status, 'failed')
    assert.match(argsResult.result.stderr, /execution arguments must be strings/)

    const invalidStdin = enqueueJob({
      language: 'node',
      entrypoint: 'main.js',
      files: { 'main.js': 'console.log("no")' },
      stdin: { invalid: true }
    })
    const stdinResult = await waitForJob(invalidStdin.id)
    assert.equal(stdinResult.status, 'failed')
    assert.match(stdinResult.result.stderr, /execution stdin must be text/)
  })
})
