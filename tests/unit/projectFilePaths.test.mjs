import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasProjectFilePathConflict,
  normalizeProjectFileMap,
  normalizeProjectFilePath
} from '../../apps/web/src/projectFilePaths.js'

test('accepts normal relative paths and international text', () => {
  assert.equal(normalizeProjectFilePath('src/main.js'), 'src/main.js')
  assert.deepEqual({ ...normalizeProjectFileMap({ '資料/説明.txt': '日本語' }) }, {
    '資料/説明.txt': '日本語'
  })
})

test('rejects traversal, absolute, drive, control and reserved paths', () => {
  for (const path of [
    '../escape.js',
    'src/../escape.js',
    '/etc/passwd',
    'C:/Windows/system.ini',
    'src\\main.js',
    'src//main.js',
    'bad\u0000name.js',
    'bad\u0001name.js',
    '__proto__',
    'constructor',
    'prototype',
    'src/node_modules/pkg/index.js',
    '.git/config'
  ]) {
    assert.throws(() => normalizeProjectFilePath(path), /不正|使用できない/, path)
  }
})

test('detects duplicate files and file-directory collisions', () => {
  assert.equal(hasProjectFilePathConflict({ 'src/main.js': '' }, 'src'), true)
  assert.equal(hasProjectFilePathConflict({ src: '' }, 'src/main.js'), true)
  assert.equal(hasProjectFilePathConflict({ 'src/main.js': '' }, 'src/main.js'), true)
  assert.equal(hasProjectFilePathConflict({ 'src/main.js': '' }, 'src/main.ts'), false)
})

test('enforces UTF-8 bytes and file count', () => {
  assert.throws(() => normalizeProjectFileMap({ file: '日本語' }, { maxBytes: 5 }), /上限/)
  assert.throws(() => normalizeProjectFileMap({ a: '', b: '' }, { maxFiles: 1 }), /上限/)
})

test('rejects UTF-8 paths that exceed the filesystem-safe byte limit', () => {
  const path = '界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界界.js'
  assert.ok(path.length < 240)
  assert.ok(new TextEncoder().encode(path).byteLength > 240)
  assert.throws(() => normalizeProjectFilePath(path), /不正/)
})
