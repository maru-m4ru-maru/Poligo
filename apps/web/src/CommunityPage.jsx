import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CommunityIcon from './CommunityIcon.jsx'
import CommunityNotifications from './CommunityNotifications.jsx'

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

function shortDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function formatCount(value) {
  const count = Math.max(0, Number(value) || 0)
  return count >= 1000 ? (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k' : String(count)
}

function ProjectRow({ project, onOpen, onToggle }) {
  return (
    <article className="community-project-row">
      <button className="community-row-open" type="button" onClick={() => onOpen(project)}>
        <span className="community-row-copy">
          <strong>{project.name}</strong>
          <span>{project.description || '説明はまだありません。'}</span>
          <small>{project.language || 'Other'} · {shortDate(project.published_at) || '公開日不明'}</small>
        </span>
      </button>
      <div className="community-row-actions">
        <button type="button" onClick={() => onToggle(project, 'star')} aria-pressed={Boolean(project.starred)} className={project.starred ? 'is-active' : ''} aria-label={'スター ' + Number(project.stars || 0)}>
          <CommunityIcon name="star" size={14} />
          <span>{formatCount(project.stars)}</span>
        </button>
        <button type="button" onClick={() => onToggle(project, 'favorite')} aria-pressed={Boolean(project.favorited)} className={project.favorited ? 'is-active' : ''} aria-label={project.favorited ? 'お気に入りを解除' : 'お気に入りに追加'}>
          <CommunityIcon name="heart" size={14} />
        </button>
      </div>
    </article>
  )
}

export default function CommunityPage({ session }) {
  const [projects, setProjects] = useState([])
  const [featured, setFeatured] = useState([])
  const [recent, setRecent] = useState([])
  const [popular, setPopular] = useState([])
  const [shared, setShared] = useState([])
  const [favorites, setFavorites] = useState([])
  const [query, setQuery] = useState('')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [view, setView] = useState('explore')
  const [section, setSection] = useState('projects')
  const [notificationCount, setNotificationCount] = useState(0)
  const [selected, setSelected] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const feedCache = useRef(new Map())
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    if (section === 'notifications') return
    setError('')

    const normalizedQuery = query.trim()
    let cacheKey
    let endpoint
    let updateFeed

    if (normalizedQuery) {
      cacheKey = 'search:' + normalizedQuery.toLocaleLowerCase('ja')
      endpoint = '/api/community/projects?sort=recent&limit=50&q=' + encodeURIComponent(normalizedQuery)
      updateFeed = setProjects
    } else if (view === 'recent') {
      cacheKey = 'recent'
      endpoint = '/api/community/projects?sort=recent&limit=30'
      updateFeed = setRecent
    } else if (view === 'popular') {
      cacheKey = 'popular'
      endpoint = '/api/community/projects?sort=stars&limit=30'
      updateFeed = setPopular
    } else if (view === 'favorites') {
      cacheKey = 'favorites:' + (session?.user?.id || 'signed-out')
      endpoint = '/api/community/favorites'
      updateFeed = setFavorites
    } else if (view === 'shared') {
      cacheKey = 'shared:' + (session?.user?.id || 'signed-out')
      endpoint = '/api/community/projects?mine=true&limit=50'
      updateFeed = setShared
    } else if (view === 'all') {
      cacheKey = 'all'
      endpoint = '/api/community/projects?sort=featured&limit=50'
      updateFeed = setProjects
    } else {
      cacheKey = 'featured'
      endpoint = '/api/community/featured'
      updateFeed = setFeatured
    }

    if ((view === 'favorites' || view === 'shared') && !session?.user?.id) {
      updateFeed([])
      setLoading(false)
      return
    }

    const cached = feedCache.current.get(cacheKey)
    const cacheIsFresh = cached && Date.now() - cached.savedAt < 30_000

    if (cached) {
      updateFeed(cached.projects)
      setLoading(false)
      if (cacheIsFresh) return
    } else {
      setLoading(true)
    }

    const requestId = ++requestSequence.current

    try {
      const response = await api(endpoint)
      if (requestId !== requestSequence.current) return

      const nextProjects = response.projects || []
      updateFeed(nextProjects)
      feedCache.current.set(cacheKey, {
        projects: nextProjects,
        savedAt: Date.now()
      })
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setError(reason instanceof Error ? reason.message : 'コミュニティを読み込めませんでした')
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [query, section, session?.user?.id, view])

  useEffect(() => {
    if (section === 'notifications') return undefined

    const timer = window.setTimeout(() => { void load() }, 140)
    return () => {
      window.clearTimeout(timer)
      requestSequence.current += 1
    }
  }, [load, section])

  useEffect(() => {
    if (!session?.user?.id) {
      setNotificationCount(0)
      return
    }

    let cancelled = false
    const refreshUnreadCount = () => {
      api('/api/community/notifications?unreadOnly=true')
        .then(result => {
          if (!cancelled) setNotificationCount(Number(result.unreadCount || 0))
        })
        .catch(() => {
          if (!cancelled) setNotificationCount(0)
        })
    }

    refreshUnreadCount()
    const interval = window.setInterval(refreshUnreadCount, 30_000)
    window.addEventListener('focus', refreshUnreadCount)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshUnreadCount)
    }
  }, [session?.user?.id])

  async function toggle(project, kind) {
    if (!session?.user) {
      window.location.href = '/signin'
      return
    }

    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/' + kind, { method: 'POST' })
      const key = kind === 'star' ? 'starred' : 'favorited'
      const changes = {
        [key]: result.active,
        ...(kind === 'star' ? { stars: Math.max(0, Number(project.stars || 0) + (result.active ? 1 : -1)) } : {})
      }
      setProjects(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setFeatured(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setRecent(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setPopular(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setShared(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setFavorites(current => kind === 'favorite'
        ? (result.active
            ? [{ ...project, ...changes }, ...current.filter(item => item.id !== project.id)]
            : current.filter(item => item.id !== project.id))
        : current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      feedCache.current.clear()
      setSelected(current => current?.id === project.id ? { ...current, ...changes } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作に失敗しました')
    }
  }

  async function openProject(project) {
    setSelected(project)
    setComments([])
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id))
      setSelected(result.project)
      setComments(result.comments || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'プロジェクトを開けませんでした')
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!selected || !comment.trim()) return
    setBusy(true)
    try {
      await api('/api/community/projects/' + encodeURIComponent(selected.id) + '/comments', {
        method: 'POST',
        body: JSON.stringify({ body: comment })
      })
      setComment('')
      await openProject(selected)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'コメントを投稿できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function forkProject() {
    if (!selected) return
    if (!session?.user) {
      window.location.href = '/signin'
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(selected.id) + '/fork', { method: 'POST' })
      window.location.hash = '/ide/' + encodeURIComponent(result.project.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'フォークに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const languageOptions = useMemo(() => {
    return Array.from(new Set([...projects, ...featured, ...recent, ...popular, ...shared, ...favorites].map(project => String(project.language || 'Other'))))
      .sort((a, b) => a.localeCompare(b, 'ja'))
  }, [projects, featured, recent, popular, shared, favorites])

  const visibleProjects = useMemo(() => {
    const combined = [...projects, ...featured, ...recent, ...popular, ...shared, ...favorites]
    const unique = Array.from(new Map(combined.map(project => [project.id, project])).values())
    const normalizedQuery = query.trim().toLocaleLowerCase('ja')
    const source = normalizedQuery
      ? projects
      : view === 'recent'
        ? recent
        : view === 'popular'
          ? popular
          : view === 'favorites'
            ? favorites
            : view === 'shared'
              ? shared
              : view === 'all'
                ? projects
                : featured

    return source
      .filter(project => {
        if (!normalizedQuery) return true
        const searchable = [project.name, project.description, project.language].join(' ').toLocaleLowerCase('ja')
        return searchable.includes(normalizedQuery)
      })
      .filter(project => languageFilter === 'all' || String(project.language || 'Other') === languageFilter)
  }, [projects, featured, recent, popular, shared, favorites, view, languageFilter, query])

  function navigateTo(path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const pageTitle = query.trim()
    ? '検索結果'
    : view === 'recent'
      ? '新着'
      : view === 'popular'
        ? '人気'
        : view === 'favorites'
          ? 'お気に入り'
          : view === 'shared'
            ? '共有した作品'
            : view === 'all'
              ? 'すべての作品'
              : 'おすすめ'

  return (
    <main className="community-page">
      <header className="community-header">
        <div className="community-header-inner">
          <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
            <img src="/poligo-logo.svg" alt="Poligo" />
          </button>
          <strong className="community-header-title">コミュニティ</strong>
          <label className="community-search-box community-header-search">
            <CommunityIcon name="search" size={16} />
            <input aria-label="コミュニティを検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="作品を検索" />
            {query && <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><CommunityIcon name="close" size={14} /></button>}
          </label>
          <button type="button" className="community-back-button" onClick={() => { window.location.hash = '/dashboard' }}>IDEへ戻る</button>
        </div>
      </header>

      <nav className="community-nav" aria-label="コミュニティ">
        <button type="button" className={section === 'projects' && view === 'explore' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('explore') }}>おすすめ</button>
        <button type="button" className={section === 'projects' && view === 'recent' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('recent') }}>新着</button>
        <button type="button" className={section === 'projects' && view === 'popular' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('popular') }}>人気</button>
        <button type="button" className={section === 'projects' && view === 'all' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('all') }}>すべて</button>
        <button type="button" className={section === 'projects' && view === 'favorites' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('favorites') }}>お気に入り</button>
        <button type="button" className={section === 'projects' && view === 'shared' && !query.trim() ? 'active' : ''} onClick={() => { setSection('projects'); setView('shared') }}>共有した作品</button>
        <button type="button" className={section === 'notifications' ? 'active' : ''} onClick={() => setSection('notifications')}>通知{notificationCount > 0 ? ' (' + (notificationCount > 99 ? '99+' : notificationCount) + ')' : ''}</button>
      </nav>

      <div className="community-main">
        {error && <p className="community-error" role="alert">{error}</p>}

        {section === 'notifications' ? (
          <CommunityNotifications session={session} onUnreadCountChange={setNotificationCount} />
        ) : (
          <section className="community-projects">
            <div className="community-projects-toolbar">
              <h1>{pageTitle}</h1>
              <div className="community-project-filters">
                <span>{visibleProjects.length} 件</span>
                <label>
                  <span className="community-filter-label">言語</span>
                  <select aria-label="言語で絞り込む" value={languageFilter} onChange={event => setLanguageFilter(event.target.value)}>
                    <option value="all">すべて</option>
                    {languageOptions.map(language => <option value={language} key={language}>{language}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <p className="community-simple-status" role="status">読み込み中...</p>
            ) : visibleProjects.length ? (
              <div className="community-project-list">
                {visibleProjects.map(project => <ProjectRow key={project.id} project={project} onOpen={openProject} onToggle={toggle} />)}
              </div>
            ) : (
              <div className="community-simple-empty">
                <p>{query.trim() ? '条件に合う作品はありません。' : view === 'favorites' ? 'お気に入りはまだありません。' : view === 'shared' ? '共有した作品はまだありません。' : view === 'explore' ? 'おすすめの作品はまだありません。' : '作品はまだありません。'}</p>
                {(query || languageFilter !== 'all') && <button type="button" onClick={() => { setQuery(''); setLanguageFilter('all') }}>条件をクリア</button>}
              </div>
            )}
          </section>
        )}

        <footer className="community-footer">
          <button type="button" onClick={() => { window.location.hash = '/dashboard' }}>IDEへ戻る</button>
          <nav className="community-legal-links" aria-label="規約">
            <button type="button" onClick={() => navigateTo('/terms')}>利用規約</button>
            <button type="button" onClick={() => navigateTo('/privacy')}>プライバシーポリシー</button>
          </nav>
        </footer>
      </div>

      {selected && (
        <div className="community-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) { setSelected(null);  } }}>
          <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title">
            <header className="community-modal-header">
              <div><span className="community-section-kicker">作品の詳細</span><h2 id="community-modal-title">{selected.name}</h2><span className="community-project-language">{selected.language || 'Other'}</span></div>
              <button type="button" aria-label="閉じる" onClick={() => { setSelected(null);  }}><CommunityIcon name="close" size={17} /></button>
            </header>
            <p className="community-modal-description">{selected.description || '説明はまだありません。'}</p>
            <div className="community-modal-actions">
              <button type="button" onClick={() => void toggle(selected, 'star')} className={selected.starred ? 'is-active' : ''}><CommunityIcon name="star" size={15} /> {selected.starred ? 'スター済み' : 'スター'} <strong>{formatCount(selected.stars)}</strong></button>
              <button type="button" onClick={() => void toggle(selected, 'favorite')} className={selected.favorited ? 'is-active' : ''}><CommunityIcon name="heart" size={15} /> {selected.favorited ? '保存済み' : 'お気に入り'}</button>
              <button type="button" className="community-primary-button" disabled={busy} onClick={() => void forkProject()}><CommunityIcon name="fork" size={15} /> フォークして編集</button>
            </div>
            <section className="community-modal-section">
              <div className="community-modal-section-heading"><h3>ソースファイル</h3><span>{Object.keys(selected.files || {}).length.toString().padStart(2, '0')} FILES</span></div>
              <div className="community-file-list">{Object.keys(selected.files || {}).sort().map(path => <div key={path}><code><CommunityIcon name="code" size={13} /> {path}</code><span>{String(selected.files[path]).split('\n').length} 行</span></div>)}</div>
            </section>
            <section className="community-modal-section">
              <div className="community-modal-section-heading"><h3>意見・改善案</h3><span>{comments.length} 件</span></div>
              {session?.user ? (
                <form className="community-comment-form" onSubmit={submitComment}>
                  <textarea rows={3} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder="改善案やフィードバックを書く..." disabled={busy} />
                  <button type="submit" disabled={busy || !comment.trim()}>{busy ? '投稿中…' : '意見を投稿'} <CommunityIcon name="arrow-up-right" size={14} /></button>
                </form>
              ) : (
                <div className="community-comment-login"><p>ログインすると、作品への感想や改善案を投稿できます。</p><button type="button" onClick={() => { window.location.href = '/signin' }}>ログインして投稿</button></div>
              )}
              <div className="community-comments">{comments.map(item => <article key={item.id}><p>{item.body}</p><time>{shortDate(item.createdAt)}</time></article>)}{!comments.length && <p className="community-muted">コメントはまだありません。</p>}</div>
            </section>

          </section>
        </div>
      )}
    </main>
  )
}
