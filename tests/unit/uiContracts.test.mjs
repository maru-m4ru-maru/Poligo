import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const main = readFileSync(path.join(root, 'apps/web/src/main.jsx'), 'utf8')
const css = readFileSync(path.join(root, 'apps/web/src/styles.css'), 'utf8')
const iconRoot = path.join(root, 'apps/web/public/icons')

test('editor preferences change Monaco options and persist across reloads', () => {
  assert.match(main, /setEditorFontSize/)
  assert.match(main, /fontSize: editorFontSize/)
  assert.match(main, /wordWrap: editorWordWrap \? 'on' : 'off'/)
  assert.match(main, /poligo-editor-font-size/)
  assert.match(main, /poligo-editor-word-wrap/)
  assert.doesNotMatch(main, /ワークスペースの設定をここに表示します/)
})

test('controls with no implementation have been removed instead of left as decoration', () => {
  assert.doesNotMatch(main, /<button className="menu-button">(?:ファイル|編集|表示)<\/button>/)
  assert.doesNotMatch(main, /<button className="top-icon" title="設定">/)
  assert.doesNotMatch(main, /<button className="preview-control">[‹›]<\/button>/)
  assert.match(main, /onClick=\{refreshPreview\}/)
  assert.match(main, /onClick=\{openPreviewWindow\}/)
})

test('responsive CSS includes IDE and settings layouts', () => {
  for (const selector of [
    '.app-shell{', '.ide-body{', '.activity-bar{', '.explorer{',
    '.main-workspace{', '.editor-section{', '.preview-section{',
    '.settings-view{', '@media(max-width:720px)'
  ]) assert.ok(css.includes(selector), 'Missing CSS rule: ' + selector)
})

test('current sidebar pages are labels, not inert buttons', () => {
  const account = readFileSync(path.join(root, 'apps/web/src/AccountPage.jsx'), 'utf8')
  const admin = readFileSync(path.join(root, 'apps/web/src/AdminPage.jsx'), 'utf8')
  assert.match(account, /stack-sidebar-static-active" aria-current="page"[\s\S]*?アカウント/)
  assert.match(admin, /stack-sidebar-static-active" aria-current="page"[\s\S]*?管理画面/)
  assert.doesNotMatch(account, /<button className="active">[\s\S]*?アカウント[\s\S]*?<\/button>/)
  assert.doesNotMatch(admin, /<button className="active" type="button">[\s\S]*?管理画面[\s\S]*?<\/button>/)
  assert.match(account, /src="\/icons\/ui-plus\.svg"/)
  assert.match(admin, /src="\/icons\/ui-plus\.svg"/)
})

test('remaining UI symbols use official SVG assets, not Unicode stand-ins', () => {
  for (const asset of [
    '/icons/ui-chevron-right.svg',
    '/icons/ui-play.svg',
    '/icons/ui-circle-x.svg',
    '/icons/ui-circle-alert.svg',
    '/icons/ui-arrow-right.svg'
  ]) assert.ok(main.includes(asset), 'Missing icon reference: ' + asset)

  for (const glyph of [
    '<span>⌄</span>',
    '<span>›</span>',
    '<span>▶</span>',
    '<span>×</span>',
    '<span>→</span>'
  ]) assert.ok(!main.includes(glyph) && !readFileSync(path.join(root, 'apps/web/src/HomePage.jsx'), 'utf8').includes(glyph) &&
    !readFileSync(path.join(root, 'apps/web/src/Dashboard.jsx'), 'utf8').includes(glyph),
    'Unicode icon glyph should be replaced by SVG: ' + glyph)

  assert.ok(main.includes('role="group" aria-label="プロジェクトのルート"'))
})

test('official semantic file and utility SVGs are present', () => {
  const names = [
    'file-code.svg', 'file-braces.svg', 'file-key.svg', 'file-cog.svg',
    'file-text.svg', 'ui-pencil.svg', 'ui-trash-2.svg', 'ui-file-plus-2.svg',
    'ui-upload.svg', 'ui-folder.svg', 'ui-refresh.svg', 'ui-external-link.svg',
    'ui-chevron-down.svg', 'ui-chevron-up.svg', 'ui-x.svg', 'ui-plus.svg',
    'activity-files.svg', 'activity-search.svg', 'activity-source.svg',
    'activity-ai.svg', 'activity-preview.svg', 'activity-settings.svg'
  ]
  for (const name of names) {
    assert.ok(existsSync(path.join(iconRoot, name)), 'Missing icon: ' + name)
  }
  assert.match(main, /json: '\/icons\/file-braces\.svg'/)
  assert.match(main, /markdown: '\/icons\/file-text\.svg'/)
  assert.doesNotMatch(main, /python: '\/icons\/python\.svg'/)
})
