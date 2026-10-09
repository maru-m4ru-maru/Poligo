import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filesEqual,
  mergeTerminalFiles
} from '../../services/api/src/terminalSync.js'

test('terminal-only changes reach the project and editor', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.py': 'print("base")\n' },
    projectFiles: { 'main.py': 'print("base")\n' },
    runnerFiles: {
      'main.py': 'print("terminal")\n',
      'created.txt': 'created in terminal\n'
    },
    clientFiles: { 'main.py': 'print("base")\n' }
  })

  assert.deepEqual(result.files, {
    'main.py': 'print("terminal")\n',
    'created.txt': 'created in terminal\n'
  })
  assert.deepEqual(result.changedPaths, ['created.txt', 'main.py'])
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.baselineFiles, result.files)
})

test('editor changes and deletions reach the runner', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.py': 'old\n', 'remove.txt': 'remove\n' },
    projectFiles: { 'main.py': 'old\n', 'remove.txt': 'remove\n' },
    runnerFiles: { 'main.py': 'old\n', 'remove.txt': 'remove\n' },
    clientFiles: { 'main.py': 'edited in browser\n' }
  })

  assert.deepEqual(result.files, { 'main.py': 'edited in browser\n' })
  assert.deepEqual(result.runnerFiles, result.files)
  assert.deepEqual(result.baselineFiles, result.files)
  assert.deepEqual(result.changedPaths, [])
  assert.deepEqual(result.conflicts, [])
})

test('unsaved editor changes synchronize before autosave', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.js': 'old\n' },
    projectFiles: { 'main.js': 'old\n' },
    runnerFiles: { 'main.js': 'old\n' },
    clientFiles: { 'main.js': 'unsaved editor text\n' }
  })

  assert.equal(result.files['main.js'], 'unsaved editor text\n')
  assert.equal(result.runnerFiles['main.js'], 'unsaved editor text\n')
  assert.equal(result.baselineFiles['main.js'], 'unsaved editor text\n')
})

test('a stale client snapshot does not overwrite a newer project value', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.js': 'old\n' },
    projectFiles: { 'main.js': 'newer saved editor text\n' },
    runnerFiles: { 'main.js': 'old\n' },
    clientFiles: { 'main.js': 'old\n' }
  })

  assert.equal(result.files['main.js'], 'newer saved editor text\n')
  assert.equal(result.runnerFiles['main.js'], 'newer saved editor text\n')
  assert.deepEqual(result.changedPaths, ['main.js'])
  assert.deepEqual(result.conflicts, [])
})

test('terminal and editor changes are both preserved when they diverge', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.js': 'base\n' },
    projectFiles: { 'main.js': 'editor version\n' },
    runnerFiles: { 'main.js': 'terminal version\n' },
    clientFiles: { 'main.js': 'editor version\n' }
  })

  assert.equal(result.files['main.js'], 'editor version\n')
  assert.equal(result.files['main.js.poligo-terminal-conflict'], 'terminal version\n')
  assert.deepEqual(result.runnerFiles, result.files)
  assert.deepEqual(result.baselineFiles, result.files)
  assert.deepEqual(result.changedPaths, ['main.js.poligo-terminal-conflict'])
  assert.deepEqual(result.conflicts, [{
    path: 'main.js',
    sources: ['terminal'],
    copies: ['main.js.poligo-terminal-conflict']
  }])
})

test('a conflicting unsaved editor version is preserved separately', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.js': 'base\n' },
    projectFiles: { 'main.js': 'saved in another tab\n' },
    runnerFiles: { 'main.js': 'base\n' },
    clientFiles: { 'main.js': 'unsaved here\n' }
  })

  assert.equal(result.files['main.js'], 'saved in another tab\n')
  assert.equal(result.files['main.js.poligo-editor-conflict'], 'unsaved here\n')
  assert.deepEqual(result.changedPaths, [
    'main.js',
    'main.js.poligo-editor-conflict'
  ])
  assert.deepEqual(result.conflicts[0].sources, ['editor'])
})

test('terminal deletion reaches project files', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'gone.txt': 'value\n' },
    projectFiles: { 'gone.txt': 'value\n' },
    runnerFiles: {},
    clientFiles: { 'gone.txt': 'value\n' }
  })

  assert.deepEqual(result.files, {})
  assert.deepEqual(result.runnerFiles, {})
  assert.deepEqual(result.baselineFiles, {})
  assert.deepEqual(result.changedPaths, ['gone.txt'])
})

test('editor deletion intent is preserved as a readable notice if project has another edit', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.py': 'base\n' },
    projectFiles: { 'main.py': 'newer project version\n' },
    runnerFiles: { 'main.py': 'base\n' },
    clientFiles: {}
  })

  assert.equal(result.files['main.py'], 'newer project version\n')
  assert.match(result.files['main.py.poligo-editor-conflict'], /deleted this path/)
})

test('identical concurrent edits converge without conflict copies', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'main.js': 'base\n' },
    projectFiles: { 'main.js': 'same update\n' },
    runnerFiles: { 'main.js': 'same update\n' },
    clientFiles: { 'main.js': 'same update\n' }
  })

  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.files, { 'main.js': 'same update\n' })
  assert.deepEqual(result.baselineFiles, result.files)
})

test('conflict copy names avoid collisions and preserve nested paths', () => {
  const result = mergeTerminalFiles({
    baseFiles: { 'src/main.js': 'base\n' },
    projectFiles: {
      'src/main.js': 'saved\n',
      'src/main.js.poligo-terminal-conflict': 'existing\n'
    },
    runnerFiles: { 'src/main.js': 'terminal\n' },
    clientFiles: {
      'src/main.js': 'saved\n',
      'src/main.js.poligo-terminal-conflict': 'existing\n'
    }
  })

  assert.equal(result.files['src/main.js.poligo-terminal-conflict-1'], 'terminal\n')
})

test('a retry after project save reuses the existing conflict copy', () => {
  const baseFiles = { 'main.js': 'base\n' }
  const runnerFiles = { 'main.js': 'terminal version\n' }
  const clientFiles = { 'main.js': 'editor version\n' }
  const first = mergeTerminalFiles({
    baseFiles,
    projectFiles: { 'main.js': 'editor version\n' },
    runnerFiles,
    clientFiles
  })
  const retry = mergeTerminalFiles({
    baseFiles,
    projectFiles: first.files,
    runnerFiles,
    clientFiles
  })

  assert.equal(retry.files['main.js'], 'editor version\n')
  assert.equal(retry.files['main.js.poligo-terminal-conflict'], 'terminal version\n')
  assert.deepEqual(
    Object.keys(retry.files).filter(path => path.includes('.poligo-terminal-conflict')),
    ['main.js.poligo-terminal-conflict']
  )
})

test('filesEqual ignores key order and detects content changes', () => {
  assert.equal(filesEqual({ b: '2', a: '1' }, { a: '1', b: '2' }), true)
  assert.equal(filesEqual({ a: '1' }, { a: '2' }), false)
})

test('runner changes are returned as a compact diff when no client snapshot is supplied', () => {
  const result = mergeTerminalFiles({
    baseFiles: {
      'main.js': 'base\n',
      'deleted.txt': 'old file\n'
    },
    projectFiles: {
      'main.js': 'base\n',
      'deleted.txt': 'old file\n'
    },
    runnerFiles: {
      'main.js': 'changed in terminal\n',
      'created.txt': 'created in terminal\n'
    }
  })

  assert.deepEqual(result.files, {
    'main.js': 'changed in terminal\n',
    'created.txt': 'created in terminal\n'
  })
  assert.deepEqual(result.changedPaths, [
    'created.txt',
    'deleted.txt',
    'main.js'
  ])
  assert.deepEqual(result.runnerFiles, result.files)
})
