import {
  hasProjectFilePathConflict,
  normalizeProjectFilePath
} from './projectFilePaths.js'

function isSecretEnvFile(path) {
  const name = path.split('/').pop() || path
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
}

export function applyAiEditsToFiles(files, edits) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return {
      ok: false,
      error: 'プロジェクトのファイル一覧が不正です。'
    }
  }

  if (!Array.isArray(edits) || !edits.length) {
    return {
      ok: true,
      files,
      changedFiles: []
    }
  }

  const next = Object.assign(Object.create(null), files)
  const changedFiles = []

  try {
    for (const edit of edits) {
      const rawPath = typeof edit?.path === 'string' ? edit.path.trim() : ''
      const oldText = typeof edit?.oldText === 'string' ? edit.oldText : null
      const newText = typeof edit?.newText === 'string' ? edit.newText : null

      if (!rawPath || oldText === null || newText === null) {
        throw new Error('AIが無効な変更情報を返しました。')
      }

      let path

      try {
        path = normalizeProjectFilePath(rawPath)
      } catch {
        throw new Error('AIが使用できないファイルパスを指定しました。')
      }

      if (isSecretEnvFile(path)) {
        throw new Error('環境変数ファイルはPoligo AIから直接変更できません。')
      }

      const exists = Object.prototype.hasOwnProperty.call(next, path)

      if (!exists && oldText !== '') {
        throw new Error(path + ' が見つからないため変更を適用できません。')
      }

      if (!exists && oldText === '') {
        if (hasProjectFilePathConflict(next, path)) {
          throw new Error(path + ' は既存のファイルまたはフォルダーと競合します。')
        }

        next[path] = newText
        changedFiles.push(path)
        continue
      }

      const current = next[path]

      if (typeof current !== 'string') {
        throw new Error(path + ' の現在の内容を読み取れません。')
      }

      const firstIndex = current.indexOf(oldText)
      const lastIndex = current.lastIndexOf(oldText)

      if (firstIndex < 0) {
        throw new Error(path + ' の対象コードが現在の内容と一致しません。')
      }

      if (firstIndex !== lastIndex) {
        throw new Error(path + ' の対象コードが複数箇所にあるため、安全のため適用を停止しました。')
      }

      next[path] =
        current.slice(0, firstIndex) +
        newText +
        current.slice(firstIndex + oldText.length)
      changedFiles.push(path)
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'AIの変更を適用できませんでした。'
    }
  }

  return {
    ok: true,
    files: next,
    changedFiles: [...new Set(changedFiles)]
  }
}
