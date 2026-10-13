import { useCallback, useEffect, useState } from 'react'

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

function ProjectCard({ project, onOpen, onToggle }) {
  return (
    <article className="community-project-card">
      <button className="community-card-main" onClick={() => onOpen(project)} type="button">
        <span className="community-project-language">{project.language || 'Other'}</span>
        {project.featured && <span className="community-featured-label">運営のおすすめ</span>}
        {project.visibility === 'private' && <span className="community-private-label">非公開</span>}
        <h3>{project.name}</h3>
        <p>{project.description || '説明はまだありません。'}</p>
        <span className="community-card-date">{shortDate(project.published_at)}</span>
      </button>
      <div className="community-card-footer">
        {project.visibility !== 'private' ? <>
          <button type="button" onClick={() => onToggle(project, 'star')} aria-pressed={Boolean(project.starred)} className={project.starred ? 'is-active' : ''}>★ {Number(project.stars || 0)} スター</button>
          <button type="button" onClick={() => onToggle(project, 'favorite')} aria-pressed={Boolean(project.favorited)} className={project.favorited ? 'is-active' : ''}>♥ {project.favorited ? 'お気に入り済み' : 'お気に入り'}</button>
        </> : <span className="community-private-note">非公開プロジェクト</span>}
        <span>⑂ {Number(project.forks || 0)} フォーク</span>
      </div>
    </article>
  )
}

export default function CommunityPage({ session }) {
  const [projects, setProjects] = useState([])
  const [ownedProjects, setOwnedProjects] = useState([])
  const [communityOwnedProjects, setCommunityOwnedProjects] = useState([])
  const [favorites, setFavorites] = useState([])
  const [featured, setFeatured] = useState([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
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

  const load = useCallback(async () => {
    setError('')
    try {
      const [feed, featuredFeed, own, mine, favoriteFeed] = await Promise.all([
        api('/api/community/projects?sort=' + encodeURIComponent(sort) + '&q=' + encodeURIComponent(query)),
        api('/api/community/featured'),
        session?.user ? api('/api/projects') : Promise.resolve({ projects: [] }),
        session?.user ? api('/api/community/mine') : Promise.resolve({ projects: [] }),
        session?.user && view === 'favorites' ? api('/api/community/favorites') : Promise.resolve({ projects: [] })
      ])
      setProjects(feed.projects || [])
      setFeatured(featuredFeed.projects || [])
      setOwnedProjects(own.projects || own || [])
      setCommunityOwnedProjects(mine.projects || [])
      setFavorites(favoriteFeed.projects || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'コミュニティを読み込めませんでした')
    }
  }, [query, sort, view, session?.user?.id])

  useEffect(() => { void load() }, [load])

  async function toggle(project, kind) {
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/' + kind, { method: 'POST' })
      const key = kind === 'star' ? 'starred' : 'favorited'
      const changes = {
        [key]: result.active,
        ...(kind === 'star' ? { stars: Math.max(0, Number(project.stars || 0) + (result.active ? 1 : -1)) } : {})
      }
      const update = items => items.map(item => item.id === project.id ? { ...item, ...changes } : item)
      setProjects(update)
      setFeatured(update)
      setFavorites(current => kind === 'favorite' && !result.active
        ? current.filter(item => item.id !== project.id)
        : update(current))
      setCommunityOwnedProjects(update)
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
        method: 'POST', body: JSON.stringify({ body: comment })
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
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '公開に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  async function changeVisibility(project) {
    const visibility = project.visibility === 'private' ? 'public' : 'private'
    const action = visibility === 'public' ? '公開' : '非公開'
    if (!window.confirm('「' + project.name + '」を' + action + 'に切り替えますか？')) return
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(project.id) + '/visibility', {
        method: 'POST',
        body: JSON.stringify({ visibility })
      })
      const changes = { ...result.project }
      setSelected(current => current?.id === project.id ? { ...current, ...changes } : current)
      setCommunityOwnedProjects(current => current.map(item => item.id === project.id ? { ...item, ...changes } : item))
      setNotice('「' + project.name + '」を' + action + 'に切り替えました。')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : action + 'に切り替えられませんでした')
    } finally {
      setBusy(false)
    }
  }

  const visibleProjects = view === 'favorites'
    ? favorites
    : view === 'mine' ? communityOwnedProjects : projects
  const emptyTitle = view === 'favorites'
    ? 'お気に入りはまだありません'
    : view === 'mine' ? '管理できる公開プロジェクトはありません' : 'まだ公開プロジェクトがありません'
  const emptyDescription = view === 'favorites'
    ? '気になるプロジェクトをお気に入りに追加すると、ここに表示されます。'
    : view === 'mine' ? 'プロジェクトを公開すると、公開状態をここから管理できます。' : '最初の作品を公開して、コミュニティを始めましょう。'

  return (
    <main className="community-page">
      <header className="community-header">
        <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>
        <nav>
          <button type="button" onClick={() => { window.location.hash = '/dashboard' }}>ダッシュボード</button>
          <button type="button" className="community-publish-top" onClick={() => setView(view === 'publish' ? 'explore' : 'publish')}>＋ プロジェクトを公開</button>
        </nav>
      </header>
      <div className="community-main">
        <section className="community-hero">
          <span className="community-eyebrow">BUILD IN PUBLIC</span>
          <h1>コードから、コミュニティへ。</h1>
          <p>作品を共有し、フォークして学び、改善案を交換する。エンジニアのためのPoligoコミュニティ。</p>
          <div className="community-tabs">
            <button type="button" className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}>探索</button>
            <button type="button" className={view === 'favorites' ? 'active' : ''} onClick={() => setView('favorites')}>お気に入り</button>
            {session?.user && <button type="button" className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}>自分のプロジェクト</button>}
            <button type="button" className={view === 'publish' ? 'active' : ''} onClick={() => setView('publish')}>公開する</button>
          </div>
        </section>

        {notice && <p className="community-notice" role="status">{notice}</p>}
        {error && <p className="community-error" role="alert">{error}</p>}

        {view === 'publish' ? (
          <section className="community-publish-panel">
            <h2>プロジェクトを公開</h2>
            <p>公開するとコードと説明が誰でも閲覧・フォークできるようになります。.envなどの秘密ファイルを含むプロジェクトは公開できません。</p>
            <form onSubmit={publishProject}>
              <label>プロジェクト<select required value={publishId} onChange={event => {
                const project = ownedProjects.find(item => item.id === event.target.value)
                setPublishId(event.target.value)
                setPublishName(project?.name || '')
              }}><option value="">公開するプロジェクトを選択</option>{ownedProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>表示名<input maxLength={120} value={publishName} onChange={event => setPublishName(event.target.value)} placeholder="プロジェクト名" required /></label>
              <label>説明<textarea maxLength={500} rows={4} value={publishDescription} onChange={event => setPublishDescription(event.target.value)} placeholder="何を作った？ 技術スタックや工夫した点など。" /></label>
              <button className="community-primary-button" type="submit" disabled={busy || !publishId}>{busy ? '処理中…' : 'コミュニティに公開'}</button>
            </form>
          </section>
        ) : (
          <>
            {view === 'explore' && featured.length > 0 && (
              <section className="community-featured">
                <div className="community-section-heading"><div><span>CURATED</span><h2>運営のおすすめ</h2></div></div>
                <div className="community-project-grid">{featured.map(project => <ProjectCard key={project.id} project={project} onOpen={openProject} onToggle={toggle} />)}</div>
              </section>
            )}
            <section className="community-explore">
              <div className="community-section-heading"><div><span>{view === 'mine' ? 'YOUR PROJECTS' : 'COMMUNITY'}</span><h2>{view === 'favorites' ? 'お気に入り' : view === 'mine' ? '自分のプロジェクト' : 'みんなのプロジェクト'}</h2></div></div>
              <div className="community-filters">
                <input aria-label="プロジェクトを検索" value={query} onChange={event => setQuery(event.target.value)} placeholder="名前・説明・言語で検索" />
                <select aria-label="並び順" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">おすすめ順</option><option value="stars">スター数順</option></select>
              </div>
              <div className="community-project-grid">
                {visibleProjects.map(project => (
                  <ProjectCard key={project.id} project={project} onOpen={openProject} onToggle={toggle} />
                ))}
              </div>
              {!visibleProjects.length && <div className="community-empty"><h3>{emptyTitle}</h3><p>{emptyDescription}</p>{view !== 'favorites' && <button type="button" onClick={() => setView('publish')}>プロジェクトを公開</button>}</div>}
            </section>
          </>
        )}
      </div>

      {selected && (
        <div className="community-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelected(null) }}>
          <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title">
            <header><div><span className="community-project-language">{selected.language}</span><h2 id="community-modal-title">{selected.name}</h2></div><button type="button" aria-label="閉じる" onClick={() => setSelected(null)}>×</button></header>
            <p>{selected.description || '説明はまだありません。'}</p>
            <div className="community-modal-actions">
              {selected.visibility !== 'private' && <>
                <button type="button" onClick={() => void toggle(selected, 'star')}>★ スター {selected.stars || 0}</button>
                <button type="button" onClick={() => void toggle(selected, 'favorite')}>♥ お気に入り</button>
                <button type="button" className="community-primary-button" disabled={busy} onClick={() => void forkProject()}>⑂ フォークして編集</button>
              </>}
            </div>
            <h3>ソースファイル</h3>
            <div className="community-file-list">{Object.keys(selected.files || {}).sort().map(path => <div key={path}><code>{path}</code><span>{String(selected.files[path]).split('\n').length} 行</span></div>)}</div>
            <h3>意見・改善案</h3>
            <form className="community-comment-form" onSubmit={submitComment}><textarea rows={3} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder={selected.visibility === 'private' ? '非公開中は意見を投稿できません' : session?.user ? '改善案やフィードバックを書く' : '投稿するにはログインしてください'} disabled={!session?.user || busy || selected.visibility === 'private'} /><button type="submit" disabled={!session?.user || busy || selected.visibility === 'private' || !comment.trim()}>投稿</button></form>
            <div className="community-comments">{comments.map(item => <article key={item.id}><p>{item.body}</p><time>{shortDate(item.createdAt)}</time></article>)}{!comments.length && <p className="community-muted">まだ意見はありません。建設的な最初のコメントをどうぞ。</p>}</div>
            {session?.user?.id === selected.owner_id && <button className="community-unpublish" type="button" disabled={busy} onClick={() => void changeVisibility(selected)}>{selected.visibility === 'private' ? 'コミュニティに公開する' : 'コミュニティから非公開にする'}</button>}
          </section>
        </div>
      )}
    </main>
  )
}
