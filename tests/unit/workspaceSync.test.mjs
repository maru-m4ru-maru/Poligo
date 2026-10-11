import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { workspaceSyncScript } from '../../services/runner/src/workspace-sync.js'

function runSync(root, files, deletions = []) {
  const result = spawnSync(process.execPath, ['-e', workspaceSyncScript], {
    encoding: 'utf8',
    input: JSON.stringify({ root, files, deletions }),
    timeout: 5000
  })

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

test('terminal workspace sync writes files and enforces UTF-8 byte-size path bounds', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'poligo-sync-'))
  const workspace = path.join(temporaryRoot, 'workspace')
  mkdirSync(workspace)

  try {
    const result = runSync(workspace, {
      'src/main.js': 'console.log("safe")'
    })

    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), { ok: true, fileCount: 1 })
    assert.equal(readFileSync(path.join(workspace, 'src/main.js'), 'utf8'), 'console.log("safe")')

    const longUnicodePath = '界'.repeat(81) + '.js'
    assert.ok(longUnicodePath.length < 240)
    assert.ok(Buffer.byteLength(longUnicodePath, 'utf8') > 240)

    const rejected = runSync(workspace, {
      [longUnicodePath]: 'must not exist'
    })

    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /invalid file path/)
    assert.equal(existsSync(path.join(workspace, longUnicodePath)), false)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})

test('terminal workspace sync refuses a symlink as the workspace root', () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'poligo-sync-root-'))
  const realRoot = path.join(temporaryRoot, 'real')
  const linkedRoot = path.join(temporaryRoot, 'linked')
  mkdirSync(realRoot)
  symlinkSync(realRoot, linkedRoot)

  try {
    const result = runSync(linkedRoot, { 'main.js': 'no' })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /invalid terminal workspace/)
    assert.equal(existsSync(path.join(realRoot, 'main.js')), false)
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
