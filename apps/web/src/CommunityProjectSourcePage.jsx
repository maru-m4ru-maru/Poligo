import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import CommunityIcon from './CommunityIcon.jsx'
import { getCommunityFileMetadata } from './communityFileMetadata.js'

const Editor = lazy(() => import('@monaco-editor/react'))
const API_URL = import.meta.env.VITE_API_URL || ''

async function api(path) {
  const response = await fetch(API_URL + path, {
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText || 'Source request failed')
  return body
}

export default function CommunityProjectSourcePage({ projectId, filePath }) {
  const [project, setProject] = useState(null)
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [matchCount, setMatchCount] = useState(0)
  const [wordWrap, setWordWrap] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const editorRef = useRef(null)
  const searchMatchesRef = useRef([])
  const decorationIdsRef = useRef([])

  const fileMetadata = getCommunityFileMetadata(filePath)
  const sourceLineCount = source === null ? 0 : source.split(/\r?\n/).length

  const loadSource = useCallback(async () => {
    setLoading(true)
    setError('')
    setProject(null)
    setSource(null)
    setSearchQuery('')
    setSearchMatchIndex(0)
    setMatchCount(0)

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

  const handleEditorMount = useCallback(editor => {
    editorRef.current = editor
    setEditorReady(true)
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()

    if (!editorReady || !editor || !model || source === null) return

    const term = searchQuery.trim()
    if (!term) {
      searchMatchesRef.current = []
      setMatchCount(0)
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [])
      return
    }

    const matches = model.findMatches(term, false, false, false, null, false, 5000)
    searchMatchesRef.current = matches
    setMatchCount(matches.length)

    const activeIndex = matches.length
      ? Math.min(searchMatchIndex, matches.length - 1)
      : 0

    if (activeIndex !== searchMatchIndex) {
      setSearchMatchIndex(activeIndex)
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      matches.map((match, index) => ({
        range: match.range,
        options: {
          inlineClassName: index === activeIndex
            ? 'community-search-match-current'
            : 'community-search-match'
        }
      }))
    )

    const activeMatch = matches[activeIndex]
    if (activeMatch) {
      editor.revealRangeInCenter(activeMatch.range)
      editor.setSelection(activeMatch.range)
    }
  }, [editorReady, searchMatchIndex, searchQuery, source])

  function moveSearchMatch(direction) {
    const count = searchMatchesRef.current.length
    if (!count) return
    setSearchMatchIndex(current => (current + direction + count) % count)
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source || '')
      setCopyStatus('コピーしました')
    } catch {
      setCopyStatus('コピーできませんでした')
    }
  }

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
                <img src={fileMetadata.icon} alt="" aria-hidden="true" />
                <div>
                  <h1>{filePath.split('/').pop() || filePath}</h1>
                  <p>{project?.name || 'プロジェクト'} <span>·</span> {fileMetadata.name}</p>
                </div>
              </div>
              <span className="community-source-line-count">{sourceLineCount} 行</span>
            </header>

            <div className="community-source-path">{filePath}</div>

            <div className="community-source-toolbar">
              <label className="community-source-search">
                <CommunityIcon name="search" size={15} />
                <input
                  type="search"
                  aria-label="ソースコード内を検索"
                  placeholder="コード内を検索"
                  value={searchQuery}
                  onChange={event => {
                    setSearchQuery(event.target.value)
                    setSearchMatchIndex(0)
                  }}
                />
                {searchQuery && (
                  <button type="button" aria-label="検索をクリア" onClick={() => {
                    setSearchQuery('')
                    setSearchMatchIndex(0)
                  }}>
                    <CommunityIcon name="close" size={13} />
                  </button>
                )}
              </label>
              <span className="community-source-match-count" aria-live="polite">
                {searchQuery.trim()
                  ? matchCount ? (searchMatchIndex + 1) + ' / ' + matchCount : '一致なし'
                  : '検索'}
              </span>
              <button type="button" className="community-source-tool-button" disabled={!matchCount} onClick={() => moveSearchMatch(-1)} aria-label="前の検索結果">
                <CommunityIcon name="chevron-up" size={14} /> 前へ
              </button>
              <button type="button" className="community-source-tool-button" disabled={!matchCount} onClick={() => moveSearchMatch(1)} aria-label="次の検索結果">
                <CommunityIcon name="chevron-down" size={14} /> 次へ
              </button>
              <button type="button" className="community-source-tool-button" aria-pressed={wordWrap} onClick={() => setWordWrap(current => !current)}>
                折り返し {wordWrap ? 'ON' : 'OFF'}
              </button>
              <button type="button" className="community-source-tool-button" onClick={() => void copySource()}>
                {copyStatus || 'コードをコピー'}
              </button>
            </div>

            <div className="community-source-editor" role="region" aria-label="読み取り専用ソースコード">
              <Suspense fallback={<p className="community-source-editor-loading">コードエディターを読み込んでいます...</p>}>
                <Editor
                  height="100%"
                  width="100%"
                  language={fileMetadata.language}
                  theme="vs"
                  value={source || ''}
                  onMount={handleEditorMount}
                  options={{
                    readOnly: true,
                    domReadOnly: true,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 4,
                    glyphMargin: false,
                    folding: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: wordWrap ? 'on' : 'off',
                    renderLineHighlight: 'line',
                    selectionHighlight: true,
                    occurrencesHighlight: 'off',
                    contextmenu: true,
                    fontSize: 13,
                    lineHeight: 22,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    stickyScroll: { enabled: false },
                    guides: { indentation: true, bracketPairs: true }
                  }}
                />
              </Suspense>
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
