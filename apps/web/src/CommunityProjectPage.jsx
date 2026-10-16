import { useCallback, useEffect, useState } from 'react'
import CommunityIcon from './CommunityIcon.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

async function api(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText || 'Community request failed')
  return body
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

function formatCount(value) {
  const count = Math.max(0, Number(value) || 0)
  return count >= 1000 ? (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k' : String(count)
}

export default function CommunityProjectPage({ session, projectId }) {
  const [project, setProject] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadProject = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(projectId))
      setProject(result.project)
      setComments(result.comments || [])
    } catch (reason) {
      setProject(null)
      setComments([])
      setError(reason instanceof Error ? reason.message : 'プロジェクトを開けませんでした')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProject()
  }, [loadProject])

  async function toggle(kind) {
    if (!project) return
    if (!session?.user) {
      window.location.href = '/signin'
      return
    }

    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/' + kind, { method: 'POST' })
      setProject(current => current ? {
        ...current,
        [kind === 'star' ? 'starred' : 'favorited']: result.active,
        ...(kind === 'star' ? {
          stars: Math.max(0, Number(current.stars || 0) + (result.active ? 1 : -1))
        } : {})
      } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作に失敗しました')
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!project || !comment.trim() || busy) return
    if (!session?.user) {
      window.location.href = '/signin'
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/comments', {
        method: 'POST',
        body: JSON.stringify({ body: comment.trim() })
      })
      if (result.comment) setComments(current => [result.comment, ...current])
      setComment('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'コメントを投稿できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function forkProject() {
    if (!project || busy) return
    if (!session?.user) {
      window.location.href = '/signin'
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/fork', { method: 'POST' })
      window.location.hash = '/ide/' + encodeURIComponent(result.project.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'フォークに失敗しました')
      setBusy(false)
    }
  }

  return (
    <main className="community-page community-project-detail-page">
      <header className="community-header">
        <div className="community-header-inner">
          <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
            <img src="/poligo-logo.svg" alt="Poligo" />
          </button>
          <strong className="community-header-title">コミュニティ</strong>
          <button type="button" className="community-back-button" onClick={() => { window.location.hash = '/community' }}>
            <CommunityIcon name="arrow-left" size={14} /> 一覧へ戻る
          </button>
        </div>
      </header>

      <div className="community-main community-detail-main">
        <button type="button" className="community-detail-back" onClick={() => { window.location.hash = '/community' }}>
          <CommunityIcon name="arrow-left" size={14} /> コミュニティ
        </button>

        {error && <p className="community-error" role="alert">{error}</p>}

        {loading ? (
          <p className="community-simple-status" role="status">プロジェクトを読み込んでいます...</p>
        ) : project ? (
          <>
            <article className="community-detail-project">
              <div className="community-detail-project-meta">
                <span>{project.language || 'Other'}</span>
                <span>公開日 {formatDate(project.published_at)}</span>
              </div>
              <h1>{project.name}</h1>
              <p className="community-detail-description">{project.description || '説明はありません。'}</p>

              <div className="community-detail-actions">
                <button type="button" onClick={() => void toggle('star')} className={project.starred ? 'is-active' : ''} aria-pressed={Boolean(project.starred)}>
                  <CommunityIcon name="star" size={15} />
                  {project.starred ? 'スター済み' : 'スター'}
                  <span>{formatCount(project.stars)}</span>
                </button>
                <button type="button" onClick={() => void toggle('favorite')} className={project.favorited ? 'is-active' : ''} aria-pressed={Boolean(project.favorited)}>
                  <CommunityIcon name="heart" size={15} />
                  {project.favorited ? 'お気に入り済み' : 'お気に入り'}
                </button>
                <button type="button" className="community-detail-fork" disabled={busy} onClick={() => void forkProject()}>
                  <CommunityIcon name="fork" size={15} /> フォークして編集
                </button>
              </div>
            </article>

            <section className="community-detail-section">
              <div className="community-detail-section-heading">
                <h2>ソースファイル</h2>
                <span>{Object.keys(project.files || {}).length} ファイル</span>
              </div>
              {Object.keys(project.files || {}).length ? (
                <div className="community-detail-files">
                  {Object.keys(project.files || {}).sort().map(path => (
                    <button
                      key={path}
                      type="button"
                      className="community-detail-file"
                      onClick={() => {
                        window.location.hash = '/community/project/' +
                          encodeURIComponent(project.id) +
                          '/source/' +
                          encodeURIComponent(path)
                      }}
                      aria-label={path + ' のソースコードを表示'}
                    >
                      <code><CommunityIcon name="file-code" size={14} /> {path}</code>
                      <span>{String(project.files[path]).split('\n').length} 行</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="community-detail-empty">公開されたファイルはありません。</p>
              )}
            </section>

            <section className="community-detail-section community-detail-comments">
              <div className="community-detail-section-heading">
                <h2>コメント</h2>
                <span>{comments.length} 件</span>
              </div>

              {session?.user ? (
                <form className="community-comment-form" onSubmit={submitComment}>
                  <textarea rows={3} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder="コメントを書く..." disabled={busy} />
                  <button type="submit" disabled={busy || !comment.trim()}>{busy ? '投稿中...' : 'コメントを投稿'}</button>
                </form>
              ) : (
                <div className="community-comment-login">
                  <p>ログインすると、作品にコメントできます。</p>
                  <button type="button" onClick={() => { window.location.href = '/signin' }}>ログインして投稿</button>
                </div>
              )}

              <div className="community-detail-comment-list">
                {comments.map(item => (
                  <article key={item.id}>
                    <p>{item.body}</p>
                    <time>{formatDate(item.createdAt)}</time>
                  </article>
                ))}
                {!comments.length && <p className="community-detail-empty">コメントはまだありません。</p>}
              </div>
            </section>
          </>
        ) : (
          <div className="community-simple-empty">
            <p>このプロジェクトは存在しないか、公開が終了しています。</p>
            <button type="button" onClick={() => { window.location.hash = '/community' }}>作品一覧に戻る</button>
          </div>
        )}

        <footer className="community-footer">
          <button type="button" onClick={() => { window.location.hash = '/dashboard' }}>IDEへ戻る</button>
          <nav className="community-legal-links" aria-label="規約">
            <button type="button" onClick={() => { window.location.href = '/terms' }}>利用規約</button>
            <button type="button" onClick={() => { window.location.href = '/privacy' }}>プライバシーポリシー</button>
          </nav>
        </footer>
      </div>
    </main>
  )
}
