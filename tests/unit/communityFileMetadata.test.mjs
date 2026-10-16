import assert from 'node:assert/strict'
import test from 'node:test'
import { getCommunityFileMetadata } from '../../apps/web/src/communityFileMetadata.js'

test('maps common language files to their matching language names, Monaco languages, and icons', () => {
  assert.deepEqual(getCommunityFileMetadata('src/app.js'), {
    name: 'JavaScript',
    language: 'javascript',
    icon: '/icons/javascript.svg',
    extension: 'js'
  })
  assert.equal(getCommunityFileMetadata('main.py').language, 'python')
  assert.equal(getCommunityFileMetadata('index.tsx').language, 'typescript')
  assert.equal(getCommunityFileMetadata('Program.cs').icon, 'https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png')
  assert.equal(getCommunityFileMetadata('Main.C').icon, '/icons/cplusplus.svg')
})

test('uses specific file-type icons for configuration and document files', () => {
  assert.equal(getCommunityFileMetadata('package.json').icon, '/icons/file-braces.svg')
  assert.equal(getCommunityFileMetadata('.env').icon, '/icons/file-key.svg')
  assert.equal(getCommunityFileMetadata('.gitignore').icon, '/icons/file-cog.svg')
  assert.equal(getCommunityFileMetadata('LICENSE').icon, '/icons/file-text.svg')
})

test('keeps unknown extensions readable with a plain-text source fallback', () => {
  assert.equal(getCommunityFileMetadata('assets/data.unknown').language, 'plaintext')
  assert.equal(getCommunityFileMetadata('assets/data.unknown').icon, '/icons/file-code.svg')
})
