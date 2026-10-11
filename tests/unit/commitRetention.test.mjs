import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COMMIT_HISTORY_STORAGE_MULTIPLIER,
  MAX_COMMITS_PER_ACCOUNT,
  MAX_COMMITS_PER_PROJECT,
  planCommitRetention
} from '../../services/api/src/commitRetention.js'

function makeCommit(id, projectId, createdAt, contentBytes) {
  return {
    id,
    project_id: projectId,
    created_at: createdAt,
    content_bytes: contentBytes
  }
}

test('keeps recent commits and removes the oldest snapshots when the history byte limit is reached', () => {
  const plan = planCommitRetention([
    makeCommit('old', 'project-a', 1, 60),
    makeCommit('recent', 'project-a', 2, 30),
    makeCommit('other', 'project-b', 3, 20)
  ], {
    projectId: 'project-a',
    newCommitBytes: 25,
    historyLimitBytes: 80
  })

  assert.equal(plan.ok, true)
  assert.deepEqual(plan.deleteIds, ['old'])
  assert.equal(plan.remainingBytes, 50)
})

test('prunes commits from the target project when its per-project count reaches the limit', () => {
  const commits = Array.from({ length: 4 }, (_, index) =>
    makeCommit('commit-' + index, 'project-a', index, 1)
  )
  const plan = planCommitRetention(commits, {
    projectId: 'project-a',
    newCommitBytes: 1,
    historyLimitBytes: 100,
    maxProjectCommits: 4,
    maxAccountCommits: 20
  })

  assert.equal(plan.ok, true)
  assert.deepEqual(plan.deleteIds, ['commit-0'])
})

test('prunes the oldest account commit when the account count limit is reached', () => {
  const plan = planCommitRetention([
    makeCommit('old', 'project-a', 1, 1),
    makeCommit('new', 'project-b', 2, 1)
  ], {
    projectId: 'project-c',
    newCommitBytes: 1,
    historyLimitBytes: 100,
    maxAccountCommits: 2
  })

  assert.equal(plan.ok, true)
  assert.deepEqual(plan.deleteIds, ['old'])
})

test('does not delete existing history if a single incoming snapshot can never fit', () => {
  const plan = planCommitRetention([
    makeCommit('keep', 'project-a', 1, 10)
  ], {
    projectId: 'project-a',
    newCommitBytes: 101,
    historyLimitBytes: 100
  })

  assert.deepEqual(plan, {
    ok: false,
    deleteIds: [],
    remainingBytes: 0
  })
})

test('history budget is explicitly bounded relative to configured account storage', () => {
  assert.equal(COMMIT_HISTORY_STORAGE_MULTIPLIER, 2)
  assert.equal(MAX_COMMITS_PER_PROJECT, 50)
  assert.equal(MAX_COMMITS_PER_ACCOUNT, 1000)
})
