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

function ProjectRow({ project, index, onOpen, onToggle, ranked = false }) {
  return (
    <article className={'community-project-row' + (ranked ? ' is-ranked' : '')}>
      <span className="community-row-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="community-row-language" aria-hidden="true">{languageMark(project.language)}</span>
      <button className="community-row-open" type="button" onClick={() => onOpen(project)} aria-label={project.name + ' の詳細を開く'}>
        <span className="community-row-copy">
          <span className="community-row-meta">{project.language || 'Other'} <span>·</span> {shortDate(project.published_at) || '公開日不明'}</span>
          <strong>{project.name}</strong>
          <small>{project.description || '説明はまだありません。'}</small>
        </span>
        <CommunityIcon name="arrow-up-right" size={17} />
      </button>
      <div className="community-row-actions">
        <button type="button" onClick={() => onToggle(project, 'star')} aria-pressed={Boolean(project.starred)} className={project.starred ? 'is-active' : ''} aria-label={'スター ' + Number(project.stars || 0)}>
          <CommunityIcon name="star" size={14} /><span>{formatCount(project.stars)}</span>
        </button>
        <button type="button" onClick={() => onToggle(project, 'favorite')} aria-pressed={Boolean(project.favorited)} className={project.favorited ? 'is-active' : ''} aria-label={project.favorited ? 'お気に入りを解除' : 'お気に入りに追加'}>
          <CommunityIcon name="heart" size={14} />
        </button>
      </div>
    </article>
  )
}

function SpotlightProject({ project, onOpen, onToggle }) {
  if (!project) {
    return (
      <div className="community-spotlight-empty">
        <span className="community-spotlight-empty-mark"><CommunityIcon name="sparkles" size={20} /></span>
        <strong>ピックアップ作品を準備中</strong>
        <p>運営が紹介するプロジェクトは、ここに大きく掲載されます。</p>
      </div>
    )
  }

  return (
    <article className="community-spotlight">
      <div className="community-spotlight-visual" aria-hidden="true">
        <span className="community-spotlight-edition">POLIGO PICK / 01</span>
        <span className="community-spotlight-giant">{languageMark(project.language)}</span>
        <span className="community-spotlight-visual-foot">{String(project.language || 'PROJECT').toUpperCase()}</span>
      </div>
      <div className="community-spotlight-copy">
        <div className="community-spotlight-meta"><span>運営のおすすめ</span><span>{project.language || 'Other'}</span></div>
        <h3>{project.name}</h3>
        <p>{project.description || '運営が選んだ注目のプロジェクトです。'}</p>
        <div className="community-spotlight-details">
          <span><CommunityIcon name="star" size={14} /> {formatCount(project.stars)} スター</span>
          <span><CommunityIcon name="fork" size={14} /> {formatCount(project.forks)} フォーク</span>
          <span>{shortDate(project.published_at)}</span>
        </div>
        <div className="community-spotlight-actions">
          <button type="button" className="community-spotlight-open" onClick={() => onOpen(project)}>作品を見てみる <CommunityIcon name="arrow-up-right" size={16} /></button>
          <button type="button" className={'community-spotlight-icon-button' + (project.starred ? ' is-active' : '')} onClick={() => onToggle(project, 'star')} aria-label="スターを切り替え" aria-pressed={Boolean(project.starred)}><CommunityIcon name="star" size={16} /></button>
          <button type="button" className={'community-spotlight-icon-button' + (project.favorited ? ' is-active' : '')} onClick={() => onToggle(project, 'favorite')} aria-label="お気に入りを切り替え" aria-pressed={Boolean(project.favorited)}><CommunityIcon name="heart" size={16} /></button>
        </div>
      </div>
    </article>
  )
}

function EditorPickLink({ project, index, onOpen }) {
  return (
    <button type="button" className="community-editor-pick" onClick={() => onOpen(project)}>
      <span className="community-editor-pick-index">{String(index + 1).padStart(2, '0')}</span>
      <span className="community-editor-pick-mark">{languageMark(project.language)}</span>
      <span className="community-editor-pick-copy"><strong>{project.name}</strong><small>{project.language || 'Other'} · {formatCount(project.stars)} スター</small></span>
      <CommunityIcon name="arrow-up-right" size={14} />
    </button>
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
        if (!normalizedQuery) return true
        const searchable = [project.name, project.description, project.language].join(' ').toLocaleLowerCase('ja')
        return searchable.includes(normalizedQuery)
      })
      .filter(project => languageFilter === 'all' || String(project.language || 'Other') === languageFilter)
  }, [projects, featured, recent, popular, shared, view, languageFilter, query])


  const spotlight = featured[0] || null
  const editorPicks = featured.slice(1, 4)

  function navigateTo(path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <main className="community-page">
      <header className="community-header">
        <div className="community-header-inner">
          <div className="community-header-brand">
            <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
              <img src="/poligo-logo.svg" alt="Poligo" />
            </button>
            <div className="community-header-wordmark"><span>THE PROJECT INDEX</span><strong>コミュニティ</strong></div>
          </div>
          <label className="community-search-box community-header-search">
            <CommunityIcon name="search" size={18} />
            <input aria-label="コミュニティを検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="作品名・説明・言語を検索" />
            {query ? <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><CommunityIcon name="close" size={15} /></button> : <kbd>⌘ K</kbd>}
          </label>
          <div className="community-header-actions">
            {session?.user && <span className="community-signed-in-label">{session.user.name || session.user.username || 'ログイン中'}</span>}
            <button type="button" onClick={() => { window.location.hash = '/dashboard' }}><CommunityIcon name="grid" size={15} /><span>IDEへ戻る</span></button>
          </div>
        </div>
      </header>

      <div className="community-shell">
        <aside className="community-sidebar" aria-label="コミュニティナビゲーション">
          <nav className="community-nav">
            <button type="button" className={section === 'projects' && view === 'explore' ? 'active' : ''} onClick={() => { setSection('projects'); setView('explore') }} aria-current={section === 'projects' && view === 'explore' ? 'page' : undefined}>
              <CommunityIcon name="globe" size={17} /><span>見つける</span>
            </button>
            <button type="button" className={section === 'projects' && view === 'all' && sort === 'recent' ? 'active' : ''} onClick={() => { setSection('projects'); setView('all'); setSort('recent') }} aria-current={section === 'projects' && view === 'all' && sort === 'recent' ? 'page' : undefined}>
              <CommunityIcon name="code" size={17} /><span>新着</span>
            </button>
            <button type="button" className={section === 'projects' && view === 'favorites' ? 'active' : ''} onClick={() => { setSection('projects'); setView('favorites') }} aria-current={section === 'projects' && view === 'favorites' ? 'page' : undefined}>
              <CommunityIcon name="heart" size={17} /><span>お気に入り</span>
            </button>
            <button type="button" className={section === 'projects' && view === 'shared' ? 'active' : ''} onClick={() => { setSection('projects'); setView('shared') }} aria-current={section === 'projects' && view === 'shared' ? 'page' : undefined}>
              <CommunityIcon name="layers" size={17} /><span>共有した作品</span>
            </button>
            <button type="button" className={section === 'notifications' ? 'active' : ''} onClick={() => setSection('notifications')} aria-current={section === 'notifications' ? 'page' : undefined}>
              <CommunityIcon name="bell" size={17} /><span>通知</span>{notificationCount > 0 && <b className="community-notification-count">{notificationCount > 99 ? '99+' : notificationCount}</b>}
            </button>
          </nav>
        </aside>

        <div className="community-main">
          {error && <p className="community-error" role="alert"><span className="community-error-mark">!</span>{error}</p>}

          {section === 'notifications' ? (
            <CommunityNotifications session={session} onUnreadCountChange={setNotificationCount} />
          ) : view === 'explore' && !query.trim() ? (
            <>
              <section className="community-intro">
                <div className="community-intro-copy">
                  <span className="community-section-kicker">OPEN PROJECTS · NEW IDEAS</span>
                  <h1>作品から、<br /><em>ひらめきを拾う。</em></h1>
                  <p>Poligoで作られたプロジェクトを探そう。気になるコードを読み、スターを送り、自分のアイデアへつなげられます。</p>
                </div>
                <div className="community-intro-side">
                  <div className="community-index-stamp"><span>POLIGO</span><strong>01</strong><small>COMMUNITY INDEX</small></div>
                  <div className="community-index-stats">
                    <div><strong>{featured.length}</strong><span>運営ピック</span></div>
                    <div><strong>{recent.length}</strong><span>最近の作品</span></div>
                    <div><strong>{popular.length}</strong><span>人気作品</span></div>
                  </div>
                </div>
              </section>

              <div className="community-spotlight-layout">
                <section className="community-feature-section">
                  <div className="community-section-heading">
                    <div><span>01 / EDITOR'S CHOICE</span><h2>今週のピックアップ</h2></div>
                    <span className="community-heading-rule" />
                  </div>
                  {loading ? (
                    <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>おすすめ作品を探しています...</span></div>
                  ) : (
                    <SpotlightProject project={spotlight} onOpen={openProject} onToggle={toggle} />
                  )}
                </section>

                <aside className="community-editors-desk">
                  <span className="community-editors-label">FROM THE EDITORS</span>
                  <div className="community-editors-mark" aria-hidden="true"><span>;</span><span>{'{}'}</span><span>01</span></div>
                  <h2>いいコードには、<br />それぞれの物語がある。</h2>
                  <p>完成度だけでなく、工夫や学びのあるプロジェクトにも出会える場所に。</p>
                  <div className="community-editor-picks">
                    {editorPicks.length ? editorPicks.map((project, index) => <EditorPickLink key={project.id} project={project} index={index} onOpen={openProject} />) : (
                      <div className="community-editor-empty"><span>NOTE</span><p>運営のセレクションを順次追加します。</p></div>
                    )}
                  </div>
                  <span className="community-editors-signoff">POLIGO COMMUNITY / VOL. 01</span>
                </aside>
              </div>

              <section className="community-feed-section community-feed-latest">
                <div className="community-section-heading">
                  <div><span>02 / JUST PUBLISHED</span><h2>最近のプロジェクト</h2><p>新しく公開された作品から見てみよう。</p></div>
                  <button type="button" className="community-view-all" onClick={() => { setView('all'); setSort('recent') }}>新着をすべて見る <CommunityIcon name="arrow-up-right" size={15} /></button>
                </div>
                {loading ? (
                  <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>新着作品を読み込んでいます...</span></div>
                ) : recent.length ? (
                  <div className="community-project-list">{recent.slice(0, 5).map((project, index) => <ProjectRow key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}</div>
                ) : (
                  <div className="community-empty-inline"><span className="community-empty-inline-mark"><CommunityIcon name="code" size={18} /></span><div><strong>まだ公開作品がありません</strong><p>プロジェクトが公開されると、ここに新着順で表示されます。</p></div></div>
                )}
              </section>

              <section className="community-feed-section community-feed-popular">
                <div className="community-section-heading">
                  <div><span>03 / COMMUNITY FAVORITES</span><h2>人気のプロジェクト</h2><p>スターで選ばれている作品。</p></div>
                  <button type="button" className="community-view-all" onClick={() => { setView('all'); setSort('stars') }}>ランキングを見る <CommunityIcon name="arrow-up-right" size={15} /></button>
                </div>
                {loading ? (
                  <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>人気作品を集計しています...</span></div>
                ) : popular.length ? (
                  <div className="community-project-list community-ranked-list">{popular.slice(0, 5).map((project, index) => <ProjectRow key={project.id} project={project} index={index} ranked onOpen={openProject} onToggle={toggle} />)}</div>
                ) : (
                  <div className="community-empty-inline"><span className="community-empty-inline-mark"><CommunityIcon name="star" size={18} /></span><div><strong>人気ランキングは準備中です</strong><p>作品にスターが付くと、ここにランキングが表示されます。</p></div></div>
                )}
              </section>
            </>
          ) : (
            <section className="community-explore" id="community-projects">
              <header className="community-results-intro">
                <span className="community-section-kicker">{view === 'favorites' ? 'YOUR BOOKMARKS' : view === 'shared' ? 'YOUR RELEASES' : 'PROJECT ARCHIVE'}</span>
                <div className="community-results-titleline">
                  <h1>{view === 'favorites' ? 'お気に入り' : view === 'shared' ? '共有した作品' : query.trim() ? '検索結果' : sort === 'stars' ? '人気のプロジェクト' : sort === 'recent' ? '最近のプロジェクト' : 'すべてのプロジェクト'}</h1>
                  <span><strong>{visibleProjects.length}</strong> 件</span>
                </div>
                <p>{view === 'favorites' ? 'あとで読みたい作品をまとめています。' : view === 'shared' ? 'あなたがコミュニティに公開したプロジェクト。' : query.trim() ? 'タイトル、説明、プログラミング言語から検索しています。' : '公開されているプロジェクトの一覧です。'}</p>
              </header>

              <div className="community-list-controls">
                <label className="community-sort-select"><span>並び順</span><select aria-label="並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">おすすめ順</option><option value="recent">新着順</option><option value="stars">スター数順</option></select></label>
                <div className="community-language-filter" aria-label="言語フィルター">
                  <button type="button" className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}>すべて</button>
                  {languageOptions.map(language => <button type="button" key={language} className={languageFilter === language ? 'active' : ''} onClick={() => setLanguageFilter(language)}>{language}</button>)}
                </div>
              </div>

              {loading ? (
                <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>プロジェクトを読み込んでいます...</span></div>
              ) : visibleProjects.length ? (
                <div className="community-project-list">{visibleProjects.map((project, index) => <ProjectRow key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} ranked={sort === 'stars'} />)}</div>
              ) : (
                <div className="community-empty">
                  <div className="community-empty-icon"><CommunityIcon name={view === 'favorites' ? 'heart' : view === 'shared' ? 'layers' : 'search'} size={24} /></div>
                  <span className="community-section-kicker">{view === 'favorites' ? 'YOUR BOOKMARKS' : view === 'shared' ? 'YOUR RELEASES' : 'NO MATCHES'}</span>
                  <h3>{view === 'favorites' ? 'お気に入りはまだありません。' : view === 'shared' ? '共有した作品はまだありません。' : query.trim() ? '条件に合う作品がありません。' : '作品が見つかりませんでした。'}</h3>
                  <p>{view === 'favorites' ? '作品行のハートを押すと、ここに保存されます。' : view === 'shared' ? 'IDEの共有設定からプロジェクトを公開してください。' : '検索語や言語フィルターを変えて、もう一度探してみてください。'}</p>
                  <div className="community-empty-actions">{(query || languageFilter !== 'all') && <button type="button" className="community-secondary-button" onClick={() => { setQuery(''); setLanguageFilter('all') }}>検索条件をクリア</button>}</div>
                </div>
              )}
            </section>
          )}

          <footer className="community-footer">
            <button type="button" onClick={() => { window.location.hash = '/dashboard' }}><img src="/poligo-logo.svg" alt="" /> <span>IDEへ戻る</span></button>
            <nav className="community-legal-links" aria-label="規約とポリシー">
              <button type="button" onClick={() => navigateTo('/terms')}>利用規約</button>
              <button type="button" onClick={() => navigateTo('/privacy')}>プライバシーポリシー</button>
            </nav>
            <span>POLIGO / PROJECT INDEX</span>
          </footer>
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
