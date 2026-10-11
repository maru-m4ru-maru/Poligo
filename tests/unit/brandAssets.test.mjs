import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sourceRoot = path.join(repoRoot, 'apps/web/src')
const publicRoot = path.join(repoRoot, 'apps/web/public')
const iconRoot = path.join(publicRoot, 'icons')
const brandDocumentation = readFileSync(
  path.join(repoRoot, 'docs/brand-assets.md'),
  'utf8'
)

function listSourceFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(target))
    } else if (/\.(?:js|jsx|ts|tsx|html)$/.test(entry.name)) {
      files.push(target)
    }
  }

  return files
}

test('every local icon referenced by the UI exists in the public asset directory', () => {
  const iconPattern = /['"`]\/icons\/([A-Za-z0-9._-]+\.(?:svg|png|webp|ico))['"`]/g
  const missing = []

  for (const file of listSourceFiles(sourceRoot)) {
    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(iconPattern)) {
      const iconName = match[1]
      const assetPath = path.join(iconRoot, iconName)

      if (!existsSync(assetPath)) {
        missing.push(path.relative(repoRoot, file) + ' -> /icons/' + iconName)
      }
    }
  }

  assert.deepEqual(missing, [])
})

test('language and runtime marks are real sourced brand assets, not hand-drawn placeholders', () => {
  const localBrandAssets = [
    'html5.svg',
    'css.svg',
    'javascript.svg',
    'typescript.svg',
    'python.svg',
    'nodejs.svg',
    'c.svg',
    'cplusplus.svg',
    'java.svg',
    'go.svg',
    'rust.svg',
    'php.svg',
    'ruby.svg',
    'kotlin.svg'
  ]

  for (const filename of localBrandAssets) {
    const asset = readFileSync(path.join(iconRoot, filename), 'utf8')
    assert.match(asset, /<svg\b/)
    assert.ok(
      brandDocumentation.includes('`' + filename + '`'),
      filename + ' must have a documented source'
    )
    assert.ok(
      brandDocumentation.includes('https://'),
      'brand documentation must retain source links'
    )
  }

  assert.ok(brandDocumentation.includes(
    'https://github.com/nodejs/nodejs.org/blob/main/apps/site/public/static/logos/nodejsHex.svg'
  ))
  assert.ok(brandDocumentation.includes(
    'https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png'
  ))

  const dashboard = readFileSync(path.join(sourceRoot, 'Dashboard.jsx'), 'utf8')
  const ide = readFileSync(path.join(sourceRoot, 'main.jsx'), 'utf8')
  const homepage = readFileSync(path.join(sourceRoot, 'HomePage.jsx'), 'utf8')
  const microsoftCSharpLogo = 'https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png'

  assert.ok(dashboard.includes("'C#': '" + microsoftCSharpLogo + "'"))
  assert.ok(ide.includes("csharp: '" + microsoftCSharpLogo + "'"))
  assert.ok(homepage.includes("icon: '" + microsoftCSharpLogo + "'"))
  assert.doesNotMatch(dashboard, /fill="#52647A"/)
})
