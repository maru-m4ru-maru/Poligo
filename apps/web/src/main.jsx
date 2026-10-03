import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Editor from '@monaco-editor/react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

const DEFAULT_FILES = {
  'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>Build without an IDE vendor lock-in.</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
  'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #10100e;\n  color: #ecece5;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
  'app.js': 'const title = document.querySelector("h1")\n\ntitle.addEventListener("click", () => {\n  title.textContent = "It works."\n})',
  'main.py': 'print("Hello from Python")',
  'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++\\n";\n    return 0;\n}'
}

const FILE_META = {
  'index.html': { language: 'html', kind: 'html' },
  'style.css': { language: 'css', kind: 'css' },
  'app.js': { language: 'javascript', kind: 'js' },
  'main.py': { language: 'python', kind: 'python' },
  'main.cpp': { language: 'cpp', kind: 'cpp' }
}

const API_URL = import.meta.env.VITE_API_URL || ''

const SERVER_LANGUAGES = new Set([
  'python',
  'c',
  'cpp'
])

function FileIcon({ kind, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (kind === 'html') {
    return (
      <svg {...common}>
        <path d="M3.5 3.5 5 16.5l5 1.5 5-1.5 1.5-13z" />
        <path d="m7 7.2 2 2.3-2 2.3m6-4.6-2 2.3 2 2.3" />
      </svg>
    )
  }

  if (kind === 'css') {
    return (
      <svg {...common}>
        <path d="M3.5 3.5h13L15 16l-5 2-5-2z" />
        <path d="M6 7.2h8M6 10h6.5M6 12.8h4.5" />
      </svg>
    )
  }

  if (kind === 'js') {
    return (
      <svg {...common}>
        <rect x="2.8" y="2.8" width="14.4" height="14.4" rx="1.5" />
        <path d="M8 8v4.8c0 1-.5 1.5-1.4 1.5-.7 0-1.2-.3-1.5-.8m5.8 1.5c.5.5 1 .8 1.8.8 1.1 0 1.8-.6 1.8-1.4 0-1-.7-1.3-1.6-1.7l-.3-.1c-.7-.3-1-.6-1-1 0-.4.3-.7.8-.7.5 0 .9.2 1.2.5" />
      </svg>
    )
  }

  if (kind === 'python') {
    return (
      <svg {...common}>
        <path d="M10 2.7c-2.9 0-3.1 1.3-3.1 2.5v1.7h3.8v1H5.2c-1.6 0-2.8 1.8-2.8 4 0 2.3 1.1 3.7 2.8 3.7h1.7v-2.1c0-1.4.8-2.4 2.2-2.4h3.2c1.2 0 2.1-1 2.1-2.2V5.2c0-1.5-1.1-2.5-2.5-2.5z" />
        <path d="M10 17.3c2.9 0 3.1-1.3 3.1-2.5v-1.7H9.3v-1h5.5c1.6 0 2.8-1.8 2.8-4 0-2.3-1.1-3.7-2.8-3.7h-1.7v2.1c0 1.4-.8 2.4-2.2 2.4H7.7c-1.2 0-2.1 1-2.1 2.2v1.7c0 1.5 1.1 2.5 2.5 2.5z" />
        <circle cx="8" cy="4.8" r=".7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="15.2" r=".7" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (kind === 'cpp') {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7" />
        <path d="M5.2 10h4m-2-2v4m4.2-2h4m-2-2v4" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M4 2.8h7l4 4v10.4H4z" />
      <path d="M11 2.8v4h4" />
    </svg>
  )
}

function ActivityIcon({ type }) {
  const common = {
    width: 19,
    height: 19,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (type === 'files') {
    return <svg {...common}><path d="M3 5h5l1.5 1.7H17v8.3H3z" /><path d="M3 6.7h14" /></svg>
  }

  if (type === 'search') {
    return <svg {...common}><circle cx="8.4" cy="8.4" r="4.8" /><path d="m12 12 4 4" /></svg>
  }

  if (type === 'source') {
    return <svg {...common}><circle cx="5" cy="5" r="2" /><circle cx="15" cy="15" r="2" /><path d="M7 6.3 13 13.7M7 15h4a4 4 0 0 0 4-4V7" /></svg>
  }

  return <svg {...common}><circle cx="10" cy="10" r="3" /><path d="m10 2.6.8 1.8 2 .5 1.6-1.1 1.8 1.8-1.1 1.6.5 2 1.8.8v2.6l-1.8.8-.5 2 1.1 1.6-1.8 1.8-1.6-1.1-2 .5-.8 1.8H7.4l-.8-1.8-2-.5L3 16.4l-1.8-1.8 1.1-1.6-.5-2-1.8-.8V7.6l1.8-.8.5-2-1.1-1.6L3 1.4l1.6 1.1 2-.5.8-1.8z" /></svg>
}

function setupEditor(monaco) {
  monaco.editor.defineTheme('poligo-neutral', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '77776F' },
      { token: 'keyword', foreground: 'D0D0C7' },
      { token: 'keyword.control', foreground: 'D0D0C7' },
      { token: 'type', foreground: 'C0BAB0' },
      { token: 'type.identifier', foreground: 'C0BAB0' },
      { token: 'string', foreground: 'B8AD91' },
      { token: 'number', foreground: 'C3BFAE' },
      { token: 'regexp', foreground: 'B8AD91' },
      { token: 'delimiter', foreground: 'A6A69F' },
      { token: 'identifier', foreground: 'D9D9D2' }
    ],
    colors: {
      'editor.background': '#11110F',
      'editor.foreground': '#E1E1DC',
      'editorLineNumber.foreground': '#5F5F59',
      'editorLineNumber.activeForeground': '#A7A79F',
      'editorCursor.foreground': '#EEEEEA',
      'editor.selectionBackground': '#383834',
      'editor.inactiveSelectionBackground': '#292925',
      'editor.lineHighlightBackground': '#181815',
      'editorIndentGuide.background1': '#20201C',
      'editorIndentGuide.activeBackground1': '#30302B',
      'editorWidget.background': '#181814',
      'editorWidget.border': '#33332D',
      'editorSuggestWidget.background': '#181814',
      'editorSuggestWidget.border': '#33332D',
      'editorSuggestWidget.selectedBackground': '#2B2B26',
      'editorHoverWidget.background': '#181814',
      'editorHoverWidget.border': '#33332D',
      'scrollbarSlider.background': '#3A3A35',
      'scrollbarSlider.hoverBackground': '#4A4A43',
      'scrollbarSlider.activeBackground': '#55554E'
    }
  })
}

function loadFiles() {
  try {
    const stored = localStorage.getItem('poligo-files')
    return stored ? { ...DEFAULT_FILES, ...JSON.parse(stored) } : DEFAULT_FILES
  } catch {
    return DEFAULT_FILES
  }
}

function buildPreview(files) {
  const html = files['index.html'] || ''
  const css = files['style.css'] || ''
  const js = files['app.js'] || ''
  const withCss = html.replace('</head>', '<style>' + css + '</style></head>')

  if (withCss.includes('</body>')) {
    return withCss.replace('</body>', '<script>' + js + '\n</script></body>')
  }

  return withCss + '<script>' + js + '</script>'
}

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    throw new Error(response.status + ' ' + response.statusText)
  }

  return response.json()
}

function App() {
  const [files, setFiles] = useState(loadFiles)
  const [activeFile, setActiveFile] = useState('index.html')
  const [openFiles, setOpenFiles] = useState(['index.html'])
  const [activeView, setActiveView] = useState('files')
  const [bottomTab, setBottomTab] = useState('terminal')
  const [bottomOpen, setBottomOpen] = useState(true)
  const [preview, setPreview] = useState('')
  const [apiStatus, setApiStatus] = useState('checking')
  const [previewKey, setPreviewKey] = useState(0)
  const terminalRef = useRef(null)
  const terminal = useRef(null)
  const filesRef = useRef(files)

  const currentLanguage = FILE_META[activeFile]?.language || 'plaintext'
  const currentValue = files[activeFile] ?? ''

  useEffect(() => {
    localStorage.setItem('poligo-files', JSON.stringify(files))
    filesRef.current = files
  }, [files])

  useEffect(() => {
    request('/api/health')
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  useEffect(() => {
    if (!terminalRef.current || terminal.current) return

    const instance = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 12.5,
      theme: {
        background: '#10100E',
        foreground: '#D9D9D2',
        cursor: '#EEEEEA'
      }
    })

    const fit = new FitAddon()
    instance.loadAddon(fit)
    instance.open(terminalRef.current)
    fit.fit()
    instance.writeln('Poligo terminal')
    instance.writeln('Type "help" for available commands.')
    instance.write('$ ')

    let buffer = ''

    instance.onData(data => {
      if (data === '\r') {
        instance.write('\r\n')

        if (buffer === 'clear') {
          instance.clear()
        } else if (buffer === 'help') {
          instance.writeln('commands: help, clear, run, files, health')
        } else if (buffer === 'files') {
          Object.keys(filesRef.current).forEach(name => instance.writeln(name))
        } else if (buffer === 'health') {
          request('/api/health')
            .then(result => instance.writeln(JSON.stringify(result)))
            .catch(error => instance.writeln(error.message))
        } else if (buffer === 'run') {
          setPreview(buildPreview(filesRef.current))
          setPreviewKey(value => value + 1)
          instance.writeln('Preview refreshed.')
        } else if (buffer) {
          instance.writeln(buffer + ': command not found')
        }

        buffer = ''
        instance.write('$ ')
        return
      }

      if (data === '\u007f') {
        if (buffer.length) {
          buffer = buffer.slice(0, -1)
          instance.write('\b \b')
        }
        return
      }

      if (data >= ' ') {
        buffer += data
        instance.write(data)
      }
    })

    terminal.current = instance

    const resize = () => fit.fit()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      instance.dispose()
      terminal.current = null
    }
  }, [])

  const previewDoc = useMemo(() => preview || buildPreview(files), [files, preview])

  function updateFile(value) {
    setFiles(previous => ({
      ...previous,
      [activeFile]: value ?? ''
    }))
  }

  function openFile(name) {
    setActiveFile(name)
    setOpenFiles(current => current.includes(name) ? current : [...current, name])
  }

  function closeFile(name) {
    setOpenFiles(current => {
      const next = current.filter(file => file !== name)

      if (name === activeFile) {
        setActiveFile(next[next.length - 1] || 'index.html')
      }

      return next.length ? next : ['index.html']
    })
  }

  function refreshPreview() {
    setPreview(buildPreview(files))
    setPreviewKey(value => value + 1)
  }

  async function runProject() {
    refreshPreview()
    setBottomOpen(true)
    setBottomTab('terminal')

    if (!SERVER_LANGUAGES.has(currentLanguage)) {
      terminal.current?.writeln('')
      terminal.current?.writeln('Browser preview updated.')
      terminal.current?.write('$ ')
      return
    }

    try {
      const result = await request('/api/executions', {
        method: 'POST',
        body: JSON.stringify({
          language: currentLanguage,
          entrypoint: activeFile,
          files
        })
      })

      terminal.current?.writeln('')
      terminal.current?.writeln('Execution queued: ' + result.id)

      let completed = false

      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 500))

        const status = await request('/api/executions/' + encodeURIComponent(result.id))

        if (status.status === 'running') {
          terminal.current?.writeln('Running...')
          continue
        }

        if (
          status.status === 'succeeded' ||
          status.status === 'failed' ||
          status.status === 'timeout'
        ) {
          const executionResult = status.result || {}
          terminal.current?.writeln('')
          terminal.current?.writeln('Status: ' + status.status)
          terminal.current?.writeln('Exit code: ' + executionResult.exitCode)
          terminal.current?.writeln(executionResult.stdout || executionResult.stderr || '')
          completed = true
          break
        }
      }

      if (!completed) {
        terminal.current?.writeln('')
        terminal.current?.writeln('Execution polling timed out.')
      }
    } catch (error) {
      terminal.current?.writeln('')
      terminal.current?.writeln('Execution error: ' + error.message)
    }

    terminal.current?.write('$ ')
  }

  function resetProject() {
    setFiles(DEFAULT_FILES)
    setOpenFiles(['index.html'])
    setActiveFile('index.html')
    setPreview('')
    setPreviewKey(value => value + 1)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="product-button" aria-label="Poligo menu">P</button>
          <button className="menu-button">File</button>
          <button className="menu-button">Edit</button>
          <button className="menu-button">View</button>
        </div>
        <div className="project-title-wrap">
          <span className="project-title">Untitled Project</span>
          <span className="project-visibility">Private</span>
        </div>
        <div className="topbar-right">
          <button className="top-icon" title="Settings"><ActivityIcon type="settings" /></button>
          <span className="connection-status">
            <span className={'status-dot ' + apiStatus} />
            {apiStatus}
          </span>
          <button className="top-button" onClick={resetProject}>Reset</button>
          <button className="run-button" onClick={runProject}><span>▶</span> Run</button>
        </div>
      </header>

      <div className="ide-body">
        <aside className="activity-bar">
          <div className="activity-top">
            {[
              ['files', 'Files'],
              ['search', 'Search'],
              ['source', 'Source control']
            ].map(([type, label]) => (
              <button
                key={type}
                className={'activity-button ' + (activeView === type ? 'active' : '')}
                onClick={() => setActiveView(type)}
                title={label}
              >
                <ActivityIcon type={type} />
              </button>
            ))}
          </div>
          <button
            className={'activity-button ' + (activeView === 'settings' ? 'active' : '')}
            onClick={() => setActiveView('settings')}
            title="Settings"
          >
            <ActivityIcon type="settings" />
          </button>
        </aside>

        <aside className="explorer">
          <div className="explorer-head">
            <span>{activeView === 'files' ? 'EXPLORER' : activeView.toUpperCase()}</span>
            <button className="more-button">•••</button>
          </div>

          {activeView === 'files' && (
            <>
              <div className="project-folder"><span>⌄</span><span>POLIGO</span></div>
              <div className="file-list">
                {Object.keys(files).map(name => (
                  <button
                    key={name}
                    className={'explorer-file ' + (activeFile === name ? 'active' : '')}
                    onClick={() => openFile(name)}
                  >
                    <FileIcon kind={FILE_META[name]?.kind} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeView !== 'files' && (
            <div className="empty-view">
              <div className="empty-title">{activeView === 'search' ? 'Search' : activeView === 'source' ? 'Source Control' : 'Settings'}</div>
              <div className="empty-text">This view is part of the Poligo workspace.</div>
            </div>
          )}
        </aside>

        <main className="main-workspace">
          <section className="editor-section">
            <div className="editor-tabs">
              {openFiles.map(name => (
                <div
                  key={name}
                  className={'editor-tab ' + (activeFile === name ? 'active' : '')}
                  onClick={() => setActiveFile(name)}
                >
                  <FileIcon kind={FILE_META[name]?.kind} size={14} />
                  <span>{name}</span>
                  <button
                    className="tab-close"
                    onClick={event => {
                      event.stopPropagation()
                      closeFile(name)
                    }}
                    aria-label={'Close ' + name}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="editor-pane">
              <Editor
                height="100%"
                language={currentLanguage}
                value={currentValue}
                onChange={updateFile}
                theme="poligo-neutral"
                beforeMount={setupEditor}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  smoothScrolling: true,
                  wordWrap: 'off',
                  renderWhitespace: 'selection'
                }}
              />
            </div>

            <div className={'bottom-panel ' + (bottomOpen ? 'open' : '')}>
              <div className="bottom-tabs">
                {[
                  ['terminal', 'TERMINAL'],
                  ['output', 'OUTPUT'],
                  ['problems', 'PROBLEMS']
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={'bottom-tab ' + (bottomTab === id ? 'active' : '')}
                    onClick={() => {
                      setBottomTab(id)
                      setBottomOpen(true)
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button className="bottom-collapse" onClick={() => setBottomOpen(value => !value)}>
                  {bottomOpen ? '⌄' : '⌃'}
                </button>
              </div>
              {bottomOpen && (
                <div className="bottom-content">
                  {bottomTab === 'terminal' && <div className="terminal" ref={terminalRef} />}
                  {bottomTab === 'output' && <div className="panel-empty">Execution output will appear here.</div>}
                  {bottomTab === 'problems' && <div className="panel-empty">No problems reported.</div>}
                </div>
              )}
            </div>
          </section>

          <section className="preview-section">
            <div className="preview-toolbar">
              <button className="preview-control">‹</button>
              <button className="preview-control">›</button>
              <button className="preview-control" onClick={refreshPreview}>↻</button>
              <div className="preview-address">
                <span>○</span>
                <span>preview</span>
              </div>
              <button className="preview-control">↗</button>
            </div>
            <iframe
              key={previewKey}
              title="Poligo preview"
              srcDoc={previewDoc}
              sandbox="allow-scripts"
            />
          </section>
        </main>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
