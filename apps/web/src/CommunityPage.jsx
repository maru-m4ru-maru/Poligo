import { useCallback, useEffect, useMemo, useState } from 'react'

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

function Icon({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
  if (name === 'grid') return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
  if (name === 'star') return <svg {...common}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></svg>
  if (name === 'heart') return <svg {...common}><path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 8.8 2.3Z" /></svg>
  if (name === 'fork') return <svg {...common}><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M6 7v4a4 4 0 0 0 4 4h6" /><path d="M18 7v10" /></svg>
  if (name === 'arrow-up-right') return <svg {...common}><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (name === 'chevron-right') return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
  if (name === 'layers') return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg>
  if (name === 'code') return <svg {...common}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></svg>
  if (name === 'close') return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>
  if (name === 'shield') return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
}

function ProjectArtwork({ project, index = 0 }) {
  return (
    <div className={'community-card-art community-art-variant-' + (index % 4)} aria-hidden="true">
      <div className="community-art-toolbar">
        <span className="community-art-brand"><span className="community-art-led" /> POLIGO / PROJECT</span>
        <span>0{(index % 9) + 1}</span>
      </div>
      <div className="community-art-center">
        <div className="community-art-frame">
          <span className="community-art-mark">{languageMark(project.language)}</span>
          <span className="community-art-cross community-art-cross-a" />
          <span className="community-art-cross community-art-cross-b" />
        </div>
        <div className="community-art-lines"><i /><i /><i /><i /></div>
      </div>
      <div className="community-art-footer">
        <span>{String(project.language || 'OTHER').toUpperCase()}</span>
        <span className="community-art-mini-bars"><i /><i /><i /><i /><i /></span>
      </div>
    </div>
  )
}

function ProjectCard({ project, index, onOpen, onToggle }) {
  return (
    <article className="community-project-card">
      <button className="community-card-open" onClick={() => onOpen(project)} type="button" aria-label={project.name + ' の詳細を開く'}>
        <ProjectArtwork project={project} index={index} />
        <div className="community-card-content">
          <div className="community-card-meta">
            <span className="community-project-language">{project.language || 'Other'}</span>
            {project.featured && <span className="community-featured-label"><span /> 運営のおすすめ</span>}
          </div>
          <h3>{project.name}</h3>
          <p>{project.description || '説明はまだありません。作品の中身を見てみましょう。'}</p>
          <span className="community-card-date">{shortDate(project.published_at)}</span>
        </div>
      </button>
      <div className="community-card-footer">
        <button type="button" onClick={() => onToggle(project, 'star')} aria-pressed={Boolean(project.starred)} className={project.starred ? 'is-active' : ''} aria-label={'スター ' + Number(project.stars || 0)}>
          <Icon name="star" size={14} /><span>{formatCount(project.stars)}</span>
        </button>
        <button type="button" onClick={() => onToggle(project, 'favorite')} aria-pressed={Boolean(project.favorited)} className={project.favorited ? 'is-active' : ''} aria-label={project.favorited ? 'お気に入りを解除' : 'お気に入りに追加'}>
          <Icon name="heart" size={14} /><span>{project.favorited ? '保存済み' : '保存'}</span>
        </button>
        <span className="community-card-forks"><Icon name="fork" size={14} /><span>{formatCount(project.forks)}</span></span>
        <button type="button" className="community-card-arrow" onClick={() => onOpen(project)} aria-label={project.name + ' を開く'}><Icon name="arrow-up-right" size={15} /></button>
      </div>
    </article>
  )
}

export default function CommunityPage({ session }) {
  const [projects, setProjects] = useState([])
  const [ownedProjects, setOwnedProjects] = useState([])
  const [featured, setFeatured] = useState([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [languageFilter, setLanguageFilter] = useState('all')
  const [view, setView] = useState('explore')
  const [selected, setSelected] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [publishId, setPublishId] = useState('')
  const [publishDescription, setPublishDescription] = useState('')
  const [publishName, setPublishName] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const [feed, featuredFeed, own] = await Promise.all([
        api('/api/community/projects?sort=' + encodeURIComponent(sort) + '&q=' + encodeURIComponent(query)),
        api('/api/community/featured'),
        session?.user ? api('/api/projects') : Promise.resolve({ projects: [] })
      ])
      setProjects(feed.projects || [])
      setFeatured(featuredFeed.projects || [])
      setOwnedProjects(own.projects || own || [])
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

  async function toggle(project, kind) {
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/' + kind, { method: 'POST' })
      const key = kind === 'star' ? 'starred' : 'favorited'
      const changes = {
        [key]: result.active,
        ...(kind === 'star' ? { stars: Math.max(0, Number(project.stars || 0) + (result.active ? 1 : -1)) } : {})
      }
      setProjects(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setFeatured(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setSelected(current => current?.id === project.id ? { ...current, ...changes } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作に失敗しました')
    }
  }

  async function openProject(project) {
    setSelected(project)
    setConfirmUnpublish(false)
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

  async function publishProject(event) {
    event.preventDefault()
    if (!publishId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api('/api/community/projects', {
        method: 'POST',
        body: JSON.stringify({ projectId: publishId, name: publishName, description: publishDescription })
      })
      setNotice('「' + result.project.name + '」をコミュニティに公開しました。')
      setPublishId('')
      setPublishName('')
      setPublishDescription('')
      setView('explore')
      setQuery('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '公開に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function unpublish(project) {
    setBusy(true)
    setError('')
    try {
      await api('/api/community/projects/' + encodeURIComponent(project.id), { method: 'DELETE' })
      setProjects(current => current.filter(item => item.id !== project.id))
      setFeatured(current => current.filter(item => item.id !== project.id))
      setSelected(null)
      setConfirmUnpublish(false)
      setNotice('コミュニティから非公開にしました。プロジェクト本体は削除されていません。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '非公開にできませんでした')
    } finally {
      setBusy(false)
    }
  }

  const languageOptions = useMemo(() => {
    return Array.from(new Set([...projects, ...featured].map(project => String(project.language || 'Other'))))
      .sort((a, b) => a.localeCompare(b, 'ja'))
  }, [projects, featured])

  const visibleProjects = useMemo(() => {
    return (view === 'favorites' ? projects.filter(project => project.favorited) : projects)
      .filter(project => languageFilter === 'all' || String(project.language || 'Other') === languageFilter)
  }, [projects, view, languageFilter])

  const totalStars = projects.reduce((sum, project) => sum + Number(project.stars || 0), 0)
  const totalForks = projects.reduce((sum, project) => sum + Number(project.forks || 0), 0)
  const spotlight = featured[0]

  return (
    <main className="community-page">
      <header className="community-header">
        <div className="community-header-brand">
          <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
            <img src="/poligo-logo.svg" alt="Poligo" />
          </button>
          <span className="community-header-divider" />
          <span className="community-header-context">COMMUNITY <span>PUBLIC WORKSPACE</span></span>
        </div>
        <nav>
          <button type="button" className="community-dashboard-link" onClick={() => { window.location.hash = '/dashboard' }}><Icon name="grid" size={15} /> ダッシュボード</button>
          <button type="button" className="community-publish-top" onClick={() => setView(view === 'publish' ? 'explore' : 'publish')}><Icon name="plus" size={16} /> プロジェクトを公開</button>
        </nav>
      </header>

      <div className="community-main">
        <section className="community-hero">
          <div className="community-hero-copy">
            <div className="community-eyebrow"><span /> POLIGO COMMUNITY <span className="community-eyebrow-divider">/</span> OPEN WORKSPACE</div>
            <h1>作品を公開し、<br /><span>次のアイデアへ。</span></h1>
            <p>作ったものを共有する。誰かのコードから学ぶ。フォークして、改善して、また公開する。開発の続きを、ここから。</p>
            <div className="community-hero-actions">
              <button type="button" className="community-primary-button" onClick={() => { setView('explore'); document.getElementById('community-projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>作品を探す <Icon name="arrow-up-right" size={16} /></button>
              <button type="button" className="community-secondary-button" onClick={() => setView('publish')}><Icon name="plus" size={15} /> 作品を公開する</button>
            </div>
            <div className="community-hero-footnote"><span className="community-status-dot" /> 公開プロジェクトを探索中 <span className="community-hero-footnote-separator" /> FOR BUILDERS, BY BUILDERS</div>
          </div>

          <aside className="community-spotlight">
            <div className="community-spotlight-top"><span><i /> EDITOR'S SELECTION</span><span>FEATURE 001</span></div>
            {spotlight ? (
              <button type="button" className="community-spotlight-project" onClick={() => void openProject(spotlight)}>
                <ProjectArtwork project={spotlight} index={3} />
                <div className="community-spotlight-detail">
                  <span className="community-spotlight-label">今月のピックアップ</span>
                  <h2>{spotlight.name}</h2>
                  <p>{spotlight.description || '運営が選んだ、コミュニティで見つけたプロジェクト。'}</p>
                  <div className="community-spotlight-meta"><span>{spotlight.language || 'Other'}</span><span><Icon name="star" size={13} /> {formatCount(spotlight.stars)}</span><span><Icon name="fork" size={13} /> {formatCount(spotlight.forks)}</span></div>
                  <span className="community-spotlight-open">プロジェクトを見る <Icon name="arrow-up-right" size={15} /></span>
                </div>
              </button>
            ) : (
              <div className="community-spotlight-empty">
                <div className="community-spotlight-empty-mark"><Icon name="layers" size={24} /></div>
                <span>THE NEXT FEATURED PROJECT</span>
                <h2>次の主役は、ここから。</h2>
                <p>作品を公開して、Poligoコミュニティの最初の一歩を作りましょう。</p>
                <button type="button" onClick={() => setView('publish')}>最初の作品を公開 <Icon name="arrow-up-right" size={14} /></button>
              </div>
            )}
            <div className="community-spotlight-bottom"><span>CURATED BY POLIGO</span><span>CODE. SHARE. GROW.</span></div>
          </aside>
          <div className="community-hero-index"><span>01</span><span /> COMMUNITY / DISCOVER</div>
        </section>

        <section className="community-statbar" aria-label="コミュニティの概要">
          <div><span>PROJECTS IN VIEW</span><strong>{formatCount(projects.length)}</strong><small>表示中の作品</small></div>
          <div><span>CURATED PICKS</span><strong>{formatCount(featured.length)}</strong><small>運営のおすすめ</small></div>
          <div><span>COMMUNITY STARS</span><strong>{formatCount(totalStars)}</strong><small>表示中のスター合計</small></div>
          <div><span>FORK ACTIVITY</span><strong>{formatCount(totalForks)}</strong><small>表示中のフォーク合計</small></div>
        </section>

        {notice && <p className="community-notice" role="status"><span className="community-notice-mark">✓</span>{notice}</p>}
        {error && <p className="community-error" role="alert"><span className="community-error-mark">!</span>{error}</p>}

        <div className="community-workspace">
          <aside className="community-sidebar">
            <span className="community-sidebar-label">WORKSPACE</span>
            <nav aria-label="コミュニティメニュー">
              <button type="button" className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}><Icon name="grid" size={16} /><span>作品を探す</span><Icon name="chevron-right" size={14} /></button>
              <button type="button" className={view === 'favorites' ? 'active' : ''} onClick={() => setView('favorites')}><Icon name="heart" size={16} /><span>お気に入り</span><Icon name="chevron-right" size={14} /></button>
              <button type="button" className={view === 'publish' ? 'active' : ''} onClick={() => setView('publish')}><Icon name="plus" size={16} /><span>作品を公開</span><Icon name="chevron-right" size={14} /></button>
            </nav>
            <div className="community-sidebar-rule" />
            <div className="community-sidebar-note">
              <div className="community-sidebar-note-icon"><Icon name="code" size={17} /></div>
              <span className="community-sidebar-label">BUILD IN PUBLIC</span>
              <h3>共有から、開発を前へ。</h3>
              <p>気になる作品をフォークして、自分のプロジェクトとして発展させましょう。</p>
              <span className="community-sidebar-note-index">POLIGO / 01</span>
            </div>
            <div className="community-sidebar-bottom"><span className="community-status-dot" /> COMMUNITY IS OPEN</div>
          </aside>

          <div className="community-workspace-content">
            {view === 'publish' ? (
              <section className="community-publish-layout">
                <div className="community-content-heading">
                  <div><span className="community-section-kicker">SHARE YOUR WORK / 03</span><h2>作品を公開する</h2><p>作ったものを、次のアイデアにつなげよう。</p></div>
                </div>
                <div className="community-publish-grid">
                  <section className="community-publish-panel">
                    <div className="community-panel-topline"><span>NEW PUBLICATION</span><span>STEP 01 — 03</span></div>
                    <form onSubmit={publishProject}>
                      <label>公開するプロジェクト
                        <select required value={publishId} onChange={event => {
                          const project = ownedProjects.find(item => item.id === event.target.value)
                          setPublishId(event.target.value)
                          setPublishName(project?.name || '')
                        }}>
                          <option value="">プロジェクトを選択してください</option>
                          {ownedProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select>
                      </label>
                      <label>コミュニティでの表示名
                        <input maxLength={120} value={publishName} onChange={event => setPublishName(event.target.value)} placeholder="プロジェクト名" required />
                      </label>
                      <label>説明 <span className="community-label-optional">OPTIONAL / 500文字まで</span>
                        <textarea maxLength={500} rows={5} value={publishDescription} onChange={event => setPublishDescription(event.target.value)} placeholder="何を作った？ 技術スタックや工夫した点など。" />
                      </label>
                      <div className="community-publish-warning"><Icon name="shield" size={17} /><p>公開後は誰でもソースを閲覧・フォークできます。.envなどの秘密ファイルを含むプロジェクトは公開できません。</p></div>
                      <button className="community-primary-button community-publish-submit" type="submit" disabled={busy || !publishId}>{busy ? '公開処理中…' : 'コミュニティに公開する'} <Icon name="arrow-up-right" size={16} /></button>
                    </form>
                  </section>
                  <aside className="community-publish-aside">
                    <span className="community-section-kicker">BEFORE YOU SHARE</span>
                    <h3>公開前に、3つだけ。</h3>
                    <div className="community-publish-check"><span>01</span><div><strong>秘密情報を含めない</strong><p>APIキー、パスワード、.envの値を確認。</p></div></div>
                    <div className="community-publish-check"><span>02</span><div><strong>作品の目的を伝える</strong><p>説明に機能、技術、工夫した点を書く。</p></div></div>
                    <div className="community-publish-check"><span>03</span><div><strong>フォークを歓迎する</strong><p>改善や学びにつながる共有にしよう。</p></div></div>
                    <div className="community-publish-aside-footer"><Icon name="shield" size={15} /> YOUR PROJECTS. YOUR CONTROL.</div>
                  </aside>
                </div>
              </section>
            ) : (
              <>
                {featured.length > 1 && view === 'explore' && (
                  <section className="community-curated">
                    <div className="community-curated-heading"><div><span className="community-section-kicker">HANDPICKED / 02</span><h2>運営のセレクション</h2></div><span>SELECTED BY POLIGO</span></div>
                    <div className="community-curated-list">
                      {featured.slice(1, 4).map((project, index) => (
                        <button type="button" className="community-curated-item" key={project.id} onClick={() => void openProject(project)}>
                          <span className="community-curated-number">0{index + 2}</span>
                          <span className="community-curated-symbol">{languageMark(project.language)}</span>
                          <span className="community-curated-copy"><strong>{project.name}</strong><small>{project.language || 'Other'} <span /> {formatCount(project.stars)} stars</small></span>
                          <Icon name="arrow-up-right" size={16} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="community-explore" id="community-projects">
                  <div className="community-content-heading">
                    <div><span className="community-section-kicker">{view === 'favorites' ? 'YOUR COLLECTION / 02' : 'OPEN PROJECTS / 02'}</span><h2>{view === 'favorites' ? 'お気に入り' : 'コミュニティを探索'}</h2><p>{view === 'favorites' ? 'あとで見返したい作品をまとめて確認できます。' : '言語やキーワードから、新しい作品を見つけましょう。'}</p></div>
                    <span className="community-results-count"><strong>{visibleProjects.length.toString().padStart(2, '0')}</strong> RESULTS</span>
                  </div>

                  <div className="community-filters">
                    <label className="community-search-box"><Icon name="search" size={17} /><input aria-label="プロジェクトを検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="作品名、説明、言語で検索..." /><span>⌕</span></label>
                    <label className="community-sort-select"><span>並び順</span><select aria-label="並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">おすすめ順</option><option value="stars">スター数順</option></select></label>
                  </div>

                  <div className="community-language-filter" aria-label="言語フィルター">
                    <button type="button" className={languageFilter === 'all' ? 'active' : ''} onClick={() => setLanguageFilter('all')}>すべて <span>{projects.length}</span></button>
                    {languageOptions.map(language => (
                      <button type="button" key={language} className={languageFilter === language ? 'active' : ''} onClick={() => setLanguageFilter(language)}>{language}</button>
                    ))}
                  </div>

                  {loading ? (
                    <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>作品を読み込んでいます</span><small>LOADING COMMUNITY INDEX</small></div>
                  ) : visibleProjects.length ? (
                    <div className="community-project-grid">
                      {visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} onToggle={toggle} />)}
                    </div>
                  ) : (
                    <div className="community-empty">
                      <div className="community-empty-icon"><Icon name={view === 'favorites' ? 'heart' : 'search'} size={24} /></div>
                      <span className="community-section-kicker">{view === 'favorites' ? 'COLLECTION EMPTY' : 'NO MATCHING PROJECTS'}</span>
                      <h3>{view === 'favorites' ? 'お気に入りはまだありません。' : projects.length ? '条件に合う作品がありません。' : 'まだ公開プロジェクトがありません。'}</h3>
                      <p>{view === 'favorites' ? '作品カードのハートを押すと、ここに保存されます。' : projects.length ? '検索語や言語フィルターを変えて、もう一度探してみてください。' : '最初の作品を公開して、コミュニティを始めましょう。'}</p>
                      <div className="community-empty-actions">
                        {(query || languageFilter !== 'all') && <button type="button" className="community-secondary-button" onClick={() => { setQuery(''); setLanguageFilter('all') }}>検索条件をクリア</button>}
                        {view !== 'favorites' && <button type="button" className="community-primary-button" onClick={() => setView('publish')}>作品を公開する <Icon name="arrow-up-right" size={15} /></button>}
                      </div>
                    </div>
                  )}
                  <div className="community-grid-footer"><span>END OF CURRENT LIST</span><span>POLIGO COMMUNITY <i /></span></div>
                </section>
              </>
            )}
          </div>
        </div>

        <footer className="community-footer"><button type="button" onClick={() => { window.location.hash = '/dashboard' }}><img src="/poligo-logo.svg" alt="" /> <span>BACK TO WORKSPACE</span></button><span>BUILD SOMETHING WORTH SHARING.</span><span>POLIGO COMMUNITY <strong>©</strong> 2026</span></footer>
      </div>

      {selected && (
        <div className="community-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) { setSelected(null); setConfirmUnpublish(false) } }}>
          <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title">
            <header className="community-modal-header">
              <div><span className="community-section-kicker">PROJECT DETAILS / COMMUNITY</span><h2 id="community-modal-title">{selected.name}</h2><span className="community-project-language">{selected.language || 'Other'}</span></div>
              <button type="button" aria-label="閉じる" onClick={() => { setSelected(null); setConfirmUnpublish(false) }}><Icon name="close" size={17} /></button>
            </header>
            <p className="community-modal-description">{selected.description || '説明はまだありません。'}</p>
            <div className="community-modal-actions">
              <button type="button" onClick={() => void toggle(selected, 'star')} className={selected.starred ? 'is-active' : ''}><Icon name="star" size={15} /> {selected.starred ? 'スター済み' : 'スター'} <strong>{formatCount(selected.stars)}</strong></button>
              <button type="button" onClick={() => void toggle(selected, 'favorite')} className={selected.favorited ? 'is-active' : ''}><Icon name="heart" size={15} /> {selected.favorited ? '保存済み' : 'お気に入り'}</button>
              <button type="button" className="community-primary-button" disabled={busy} onClick={() => void forkProject()}><Icon name="fork" size={15} /> フォークして編集</button>
            </div>
            <section className="community-modal-section">
              <div className="community-modal-section-heading"><h3>ソースファイル</h3><span>{Object.keys(selected.files || {}).length.toString().padStart(2, '0')} FILES</span></div>
              <div className="community-file-list">{Object.keys(selected.files || {}).sort().map(path => <div key={path}><code><Icon name="code" size={13} /> {path}</code><span>{String(selected.files[path]).split('\n').length} 行</span></div>)}</div>
            </section>
            <section className="community-modal-section">
              <div className="community-modal-section-heading"><h3>意見・改善案</h3><span>{comments.length.toString().padStart(2, '0')} COMMENTS</span></div>
              <form className="community-comment-form" onSubmit={submitComment}>
                <textarea rows={3} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder={session?.user ? '改善案やフィードバックを書く...' : '投稿するにはログインしてください'} disabled={!session?.user || busy} />
                <button type="submit" disabled={!session?.user || busy || !comment.trim()}>{busy ? '投稿中…' : '意見を投稿'} <Icon name="arrow-up-right" size={14} /></button>
              </form>
              <div className="community-comments">{comments.map(item => <article key={item.id}><p>{item.body}</p><time>{shortDate(item.createdAt)}</time></article>)}{!comments.length && <p className="community-muted">まだ意見はありません。建設的な最初のコメントをどうぞ。</p>}</div>
            </section>
            {session?.user?.id === selected.owner_id && (
              <div className="community-unpublish-wrap">
                {confirmUnpublish ? (
                  <div className="community-unpublish-confirm" role="group" aria-label="非公開の確認">
                    <div><strong>この作品を非公開にしますか？</strong><p>コミュニティからは消えますが、プロジェクト本体は削除されません。</p></div>
                    <button type="button" className="community-danger-button" disabled={busy} onClick={() => void unpublish(selected)}>{busy ? '処理中…' : '非公開にする'}</button>
                    <button type="button" className="community-secondary-button" onClick={() => setConfirmUnpublish(false)} disabled={busy}>キャンセル</button>
                  </div>
                ) : (
                  <button className="community-unpublish" type="button" onClick={() => setConfirmUnpublish(true)}>コミュニティから非公開にする</button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
