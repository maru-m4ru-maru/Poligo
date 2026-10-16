import { useCallback, useEffect, useMemo, useState } from 'react'
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

function languageMark(language) {
  const normalized = String(language || '').toLowerCase()
  if (normalized.includes('python')) return 'Py'
  if (normalized.includes('typescript')) return 'TS'
  if (normalized.includes('javascript') || normalized === 'js' || normalized.includes('node')) return 'JS'
  if (normalized.includes('html')) return '</>'
  if (normalized.includes('css')) return '#'
  if (normalized.includes('rust')) return 'Rs'
  if (normalized.includes('go')) return 'Go'
  if (normalized.includes('java')) return 'J'
  if (normalized.includes('c++')) return 'C++'
  if (normalized.includes('php')) return 'php'
  if (normalized.includes('ruby')) return 'rb'
  return '</>'
}

function ProjectCard({ project, index, onOpen, onToggle }) {
  return (
    <article className="community-project-card">
      <span className="community-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span className="community-card-symbol" aria-hidden="true">{languageMark(project.language)}</span>
      <button className="community-card-open" onClick={() => onOpen(project)} type="button" aria-label={project.name + ' の詳細を開く'}>
        <div className="community-card-content">
          <div className="community-card-meta">
            <span className="community-project-language">{project.language || 'Other'}</span>
            {project.featured && <span className="community-featured-label">おすすめ</span>}
          </div>
          <h3>{project.name}</h3>
          <p>{project.description || '説明はまだありません。'}</p>
          <span className="community-card-date">{shortDate(project.published_at)}</span>
        </div>
        <span className="community-card-open-mark"><CommunityIcon name="arrow-up-right" size={15} /></span>
      </button>
      <div className="community-card-footer">
        <button type="button" onClick={() => onToggle(project, 'star')} aria-pressed={Boolean(project.starred)} className={project.starred ? 'is-active' : ''} aria-label={'スター ' + Number(project.stars || 0)}>
          <CommunityIcon name="star" size={14} /><span>{formatCount(project.stars)}</span>
        </button>
        <button type="button" onClick={() => onToggle(project, 'favorite')} aria-pressed={Boolean(project.favorited)} className={project.favorited ? 'is-active' : ''} aria-label={project.favorited ? 'お気に入りを解除' : 'お気に入りに追加'}>
          <CommunityIcon name="heart" size={14} /><span>{project.favorited ? '保存済み' : '保存'}</span>
        </button>
        <span className="community-card-forks"><CommunityIcon name="fork" size={14} /><span>{formatCount(project.forks)}</span></span>
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
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
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

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [feed, featuredFeed, recentFeed, popularFeed, sharedFeed] = await Promise.all([
        api('/api/community/projects?sort=' + encodeURIComponent(sort) + '&q=' + encodeURIComponent(query)),
        api('/api/community/featured'),
        api('/api/community/projects?sort=recent&limit=6'),
        api('/api/community/projects?sort=stars&limit=6'),
        session?.user?.id
          ? api('/api/community/projects?mine=true&limit=50')
          : Promise.resolve({ projects: [] })
      ])
      setProjects(feed.projects || [])
      setFeatured(featuredFeed.projects || [])
      setRecent(recentFeed.projects || [])
      setPopular(popularFeed.projects || [])
      setShared(sharedFeed.projects || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'コミュニティを読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [query, sort, session?.user?.id])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 180)
    return () => window.clearTimeout(timer)
  }, [load])

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
    return Array.from(new Set([...projects, ...featured, ...recent, ...popular, ...shared].map(project => String(project.language || 'Other'))))
      .sort((a, b) => a.localeCompare(b, 'ja'))
  }, [projects, featured, recent, popular, shared])

  const visibleProjects = useMemo(() => {
    const combined = [...projects, ...featured, ...recent, ...popular, ...shared]
    const unique = Array.from(new Map(combined.map(project => [project.id, project])).values())
    const source = view === 'favorites'
      ? unique.filter(project => project.favorited)
      : view === 'shared'
        ? shared
        : projects
    const normalizedQuery = query.trim().toLocaleLowerCase('ja')
    return source
      .filter(project => {
        if (!normalizedQuery || view === 'all') return true
        const searchable = [project.name, project.description, project.language].join(' ').toLocaleLowerCase('ja')
        return searchable.includes(normalizedQuery)
      })
      .filter(project => languageFilter === 'all' || String(project.language || 'Other') === languageFilter)
  }, [projects, featured, recent, popular, shared, view, languageFilter, query])


  return (
    <main className="community-page">
      <header className="community-header">
        <div className="community-header-brand">
          <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
            <img src="/poligo-logo.svg" alt="Poligo" />
          </button>
          <span className="community-header-divider" />
          <div className="community-header-context"><strong>コミュニティ</strong><small>PROJECT DISCOVERY</small></div>
        </div>
      </header>

      <div className="community-shell">
        <aside className="community-sidebar" aria-label="コミュニティメニュー">
          <span className="community-sidebar-caption">EXPLORE</span>
          <nav>
            <button type="button" className={section === 'projects' && view === 'explore' ? 'active' : ''} onClick={() => { setSection('projects'); setView('explore') }} aria-current={section === 'projects' && view === 'explore' ? 'page' : undefined}>
              <CommunityIcon name="grid" size={18} /><span>見る</span>
            </button>
            <button type="button" className={section === 'notifications' ? 'active' : ''} onClick={() => setSection('notifications')} aria-current={section === 'notifications' ? 'page' : undefined}>
              <CommunityIcon name="bell" size={18} /><span>通知</span>{notificationCount > 0 && <b className="community-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</b>}
            </button>
            <button type="button" className={section === 'projects' && view === 'favorites' ? 'active' : ''} onClick={() => { setSection('projects'); setView('favorites') }} aria-current={section === 'projects' && view === 'favorites' ? 'page' : undefined}>
              <CommunityIcon name="heart" size={18} /><span>お気に入り</span>
            </button>
            <button type="button" className={section === 'projects' && view === 'shared' ? 'active' : ''} onClick={() => { setSection('projects'); setView('shared') }} aria-current={section === 'projects' && view === 'shared' ? 'page' : undefined}>
              <CommunityIcon name="fork" size={18} /><span>共有した作品</span>
            </button>
          </nav>
          <div className="community-sidebar-bottom">
            <button type="button" onClick={() => { window.location.hash = '/dashboard' }}><CommunityIcon name="grid" size={17} /><span>ダッシュボード</span></button>
          </div>
        </aside>

        <div className="community-main">
          <div className="community-toolbar">
            <label className="community-search-box">
              <CommunityIcon name="search" size={18} />
              <input aria-label="コミュニティを検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="作品名、説明、言語で検索..." />
              {query ? <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><CommunityIcon name="close" size={15} /></button> : <span className="community-search-hint">PROJECT SEARCH</span>}
            </label>
            {session?.user && <span className="community-signed-in-label">{session.user.name || session.user.username || 'ログイン中'}</span>}
          </div>

          {error && <p className="community-error" role="alert"><span className="community-error-mark">!</span>{error}</p>}

          {section === 'notifications' ? (
            <CommunityNotifications session={session} onUnreadCountChange={setNotificationCount} />
          ) : view === 'explore' && !query.trim() ? (
            <>
              <section className="community-welcome">
                <span className="community-eyebrow"><span /> POLIGO COMMUNITY <span className="community-eyebrow-divider">/</span> DISCOVER</span>
                <h1>次のお気に入りを、<span>見つけよう。</span></h1>
                <p>みんなのプロジェクトを見て、気になった作品を保存したり、自分のプロジェクトにフォークしたりできます。</p>
              </section>

              <section className="community-feed-section">
                <div className="community-feed-heading"><div><span className="community-section-kicker">CURATED BY POLIGO</span><h2>運営のおすすめ</h2><p>Poligo 運営が選んだ、ぜひ見てほしいプロジェクト。</p></div></div>
                {loading ? (
                  <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>おすすめを読み込んでいます</span></div>
                ) : featured.length ? (
                  <div className="community-project-grid">{featured.slice(0, 3).map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}</div>
                ) : (
                  <div className="community-empty-inline"><span className="community-empty-inline-mark"><CommunityIcon name="star" size={18} /></span><div><strong>おすすめを準備中です</strong><p>運営がピックアップした作品は、ここに表示されます。</p></div></div>
                )}
              </section>

              <section className="community-feed-section">
                <div className="community-feed-heading">
                  <div><span className="community-section-kicker">FRESH PROJECTS</span><h2>最近のプロジェクト</h2><p>新しくコミュニティに公開された作品。</p></div>
                  <button type="button" className="community-view-all" onClick={() => setView('all')}>すべて見る <CommunityIcon name="arrow-up-right" size={14} /></button>
                </div>
                {loading ? (
                  <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>最近の作品を読み込んでいます</span></div>
                ) : recent.length ? (
                  <div className="community-project-grid">{recent.slice(0, 6).map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}</div>
                ) : (
                  <div className="community-empty-inline"><span className="community-empty-inline-mark"><CommunityIcon name="code" size={18} /></span><div><strong>まだ公開作品がありません</strong><p>最初のプロジェクトが共有されると、ここに表示されます。</p></div></div>
                )}
              </section>

              <section className="community-feed-section">
                <div className="community-feed-heading"><div><span className="community-section-kicker">COMMUNITY FAVORITES</span><h2>人気のプロジェクト</h2><p>スターが多い作品からチェック。</p></div></div>
                {loading ? (
                  <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>人気の作品を読み込んでいます</span></div>
                ) : popular.length ? (
                  <div className="community-project-grid">{popular.slice(0, 6).map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}</div>
                ) : (
                  <div className="community-empty-inline"><span className="community-empty-inline-mark"><CommunityIcon name="star" size={18} /></span><div><strong>人気ランキングは集計中です</strong><p>公開作品にスターが付くと、ここに並びます。</p></div></div>
                )}
              </section>
            </>
          ) : (
            <section className="community-explore" id="community-projects">
              <div className="community-feed-heading community-results-heading">
                <div>
                  <span className="community-section-kicker">{view === 'favorites' ? 'SAVED PROJECTS' : view === 'shared' ? 'YOUR PUBLICATIONS' : 'PROJECT LIBRARY'}</span>
                  <h1>{view === 'favorites' ? 'お気に入り' : view === 'shared' ? '共有した作品' : query.trim() ? '検索結果' : 'すべてのプロジェクト'}</h1>
                  <p>{view === 'favorites' ? '保存した作品を、いつでもここから開けます。' : view === 'shared' ? 'あなたがコミュニティに共有したプロジェクト。' : query.trim() ? 'タイトル・説明・プログラミング言語から検索しています。' : 'コミュニティで公開されているプロジェクト一覧。'}</p>
                </div>
                <span className="community-results-count"><strong>{visibleProjects.length}</strong> 件</span>
              </div>

              <div className="community-list-controls">
                <label className="community-sort-select"><span>並び順</span><select aria-label="並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">おすすめ順</option><option value="recent">新着順</option><option value="stars">スター数順</option></select></label>
                <div className="community-language-filter" aria-label="言語フィルター">
                  <button type="button" className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}>すべて</button>
                  {languageOptions.map(language => <button type="button" key={language} className={languageFilter === language ? 'active' : ''} onClick={() => setLanguageFilter(language)}>{language}</button>)}
                </div>
              </div>

              {loading ? (
                <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>作品を読み込んでいます</span></div>
              ) : visibleProjects.length ? (
                <div className="community-project-grid">{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}</div>
              ) : (
                <div className="community-empty">
                  <div className="community-empty-icon"><CommunityIcon name={view === 'favorites' ? 'heart' : view === 'shared' ? 'fork' : 'search'} size={24} /></div>
                  <span className="community-section-kicker">{view === 'favorites' ? 'SAVED PROJECTS' : view === 'shared' ? 'YOUR PUBLICATIONS' : 'SEARCH RESULTS'}</span>
                  <h3>{view === 'favorites' ? 'お気に入りはまだありません。' : view === 'shared' ? '共有した作品はまだありません。' : query.trim() ? '条件に合う作品がありません。' : '作品が見つかりませんでした。'}</h3>
                  <p>{view === 'favorites' ? 'カードの「保存」を押すと、ここに表示されます。' : view === 'shared' ? 'IDE の共有設定からプロジェクトを公開してください。' : '検索語や言語フィルターを変えて、もう一度探してみてください。'}</p>
                  <div className="community-empty-actions">{(query || languageFilter !== 'all') && <button type="button" className="community-secondary-button" onClick={() => { setQuery(''); setLanguageFilter('all') }}>検索条件をクリア</button>}</div>
                </div>
              )}
            </section>
          )}

          <footer className="community-footer"><button type="button" onClick={() => { window.location.hash = '/dashboard' }}><img src="/poligo-logo.svg" alt="" /> <span>ダッシュボードへ</span></button><span>Poligo コミュニティ</span></footer>
        </div>
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
