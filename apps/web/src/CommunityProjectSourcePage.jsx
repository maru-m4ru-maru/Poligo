import { useCallback, useEffect, useState } from 'react'
import CommunityIcon from './CommunityIcon.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

const LANGUAGE_NAMES = {
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  jsx: 'JavaScript JSX',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript JSX',
  py: 'Python',
  java: 'Java',
  go: 'Go',
  rs: 'Rust',
  php: 'PHP',
  rb: 'Ruby',
  kt: 'Kotlin',
  cs: 'C#',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  json: 'JSON',
  md: 'Markdown',
  xml: 'XML',
  svg: 'SVG',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  sh: 'Shell',
  bash: 'Shell'
}

const LANGUAGE_ICONS = {
  html: '/icons/html5.svg',
  css: '/icons/css.svg',
  js: '/icons/javascript.svg',
  jsx: '/icons/javascript.svg',
  mjs: '/icons/javascript.svg',
  cjs: '/icons/javascript.svg',
  ts: '/icons/typescript.svg',
  tsx: '/icons/typescript.svg',
  py: '/icons/python.svg',
  java: '/icons/java.svg',
  go: '/icons/go.svg',
  rs: '/icons/rust.svg',
  php: '/icons/php.svg',
  rb: '/icons/ruby.svg',
  kt: '/icons/kotlin.svg',
  cs: 'https://learn.microsoft.com/en-us/dotnet/media/logo_csharp.png',
  c: '/icons/c.svg',
  h: '/icons/c.svg',
  cpp: '/icons/cplusplus.svg',
  cc: '/icons/cplusplus.svg',
  cxx: '/icons/cplusplus.svg',
  hpp: '/icons/cplusplus.svg'
}

async function api(path) {
  const response = await fetch(API_URL + path, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText || 'Source request failed')
  return body
}

function getFileExtension(path) {
  const name = path.split('/').pop() || path
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export default function CommunityProjectSourcePage({ projectId, filePath }) {
  const [project, setProject] = useState(null)
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSource = useCallback(async () => {
    setLoading(true)
    setError('')
    setProject(null)
    setSource(null)

    try {
      const result = await api('/api/community/projects/' + encodeURIComponent(projectId))
      setProject(result.project)
      const files = result.project?.files || {}
      if (!Object.prototype.hasOwnProperty.call(files, filePath) || typeof files[filePath] !== 'string') {
        setError('指定されたソースファイルは見つかりません。')
        return
      }
      setSource(files[filePath])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ソースコードを読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [filePath, projectId])

  useEffect(() => {
    void loadSource()
  }, [loadSource])

  const extension = getFileExtension(filePath)
  const languageName = LANGUAGE_NAMES[extension] || (filePath.startsWith('.env') ? 'Environment' : 'テキスト')
  const iconPath = LANGUAGE_ICONS[extension] || '/icons/file-code.svg'
  const lines = source === null ? [] : source.split(/\r?\n/)

  return (
    <main className="community-page community-source-page">
      <header className="community-header">
        <div className="community-header-inner">
          <button className="community-brand" type="button" onClick={() => { window.location.hash = '/dashboard' }} aria-label="Poligo ダッシュボード">
            <img src="/poligo-logo.svg" alt="Poligo" />
          </button>
          <strong className="community-header-title">ソースコード</strong>
          <button type="button" className="community-back-button" onClick={() => { window.location.hash = '/community/project/' + encodeURIComponent(projectId) }}>
            <CommunityIcon name="arrow-left" size={14} /> 作品へ戻る
          </button>
        </div>
      </header>

      <div className="community-main community-source-main">
        <button type="button" className="community-detail-back" onClick={() => { window.location.hash = '/community/project/' + encodeURIComponent(projectId) }}>
          <CommunityIcon name="arrow-left" size={14} /> {project?.name || '作品の詳細'}
        </button>

        {loading ? (
          <p className="community-simple-status" role="status">ソースコードを読み込んでいます...</p>
        ) : error ? (
          <div className="community-simple-empty" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => { window.location.hash = '/community/project/' + encodeURIComponent(projectId) }}>作品へ戻る</button>
          </div>
        ) : (
          <section className="community-source-viewer">
            <header className="community-source-heading">
              <div className="community-source-heading-file">
                <img src={iconPath} alt="" aria-hidden="true" />
                <div>
                  <h1>{filePath.split('/').pop() || filePath}</h1>
                  <p>{project?.name || 'プロジェクト'} <span>·</span> {languageName}</p>
                </div>
              </div>
              <span className="community-source-line-count">{lines.length} 行</span>
            </header>
            <div className="community-source-path">{filePath}</div>
            <div className="community-source-code" role="region" aria-label="ソースコード" tabIndex={0}>
              <ol className="community-source-lines">
                {lines.map((line, index) => (
                  <li key={index}><code>{line || ' '}</code></li>
                ))}
              </ol>
            </div>
          </section>
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
