import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSourceControlRoute } from '../../services/api/src/sourceControlPolicy.js'

test('parses the supported source-control routes and methods', () => {
  assert.deepEqual(parseSourceControlRoute('GET', '/api/projects/project-a/commits'), {
    operation: 'list',
    projectId: 'project-a',
    commitId: ''
  })
  assert.deepEqual(parseSourceControlRoute('POST', '/api/projects/project-a/commits'), {
    operation: 'create',
    projectId: 'project-a',
    commitId: ''
  })
  assert.deepEqual(parseSourceControlRoute('GET', '/api/projects/project-a/commits/commit-a'), {
    operation: 'get',
    projectId: 'project-a',
    commitId: 'commit-a'
  })
  assert.deepEqual(parseSourceControlRoute('GET', '/api/projects/project-a/commits/commit-a/diff'), {
    operation: 'diff',
    projectId: 'project-a',
    commitId: 'commit-a'
  })
  assert.deepEqual(parseSourceControlRoute('POST', '/api/projects/project-a/commits/commit-a/restore'), {
    operation: 'restore',
    projectId: 'project-a',
    commitId: 'commit-a'
  })
})

test('rejects unknown, malformed and wrong-method source-control routes', () => {
  const invalid = [
    ['GET', '/api/projects/project-a/commits/commit-a/delete'],
    ['GET', '/api/projects/project-a/commits/commit-a/restore'],
    ['POST', '/api/projects/project-a/commits/commit-a/diff'],
    ['DELETE', '/api/projects/project-a/commits'],
    ['GET', '/api/projects//commits'],
    ['GET', '/api/projects/project-a/commits/'],
    ['GET', '/api/projects/project-a/commits/commit-a/extra/path'],
    ['GET', '/api/users/project-a/commits'],
    ['GET', '/api/projects/project-a/files']
  ]

  for (const [method, path] of invalid) {
    assert.equal(parseSourceControlRoute(method, path), null, method + ' ' + path)
  }

  assert.equal(parseSourceControlRoute(null, '/api/projects/project-a/commits'), null)
  assert.equal(parseSourceControlRoute('GET', null), null)
})
