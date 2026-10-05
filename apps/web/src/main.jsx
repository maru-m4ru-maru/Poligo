import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Editor from '@monaco-editor/react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  initializeWorkspace,
  listProjects,
  saveProject,
  claimWorkspace
} from './projectStore'
import { authClient } from './auth-client'
import AuthPage from './AuthPage'
import {
  siC,
  siCplusplus,
  siCss3,
  siHtml5,
  siJavascript,
  siPython
} from 'simple-icons'

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

const FILE_ICONS = {
  html: siHtml5,
  css: siCss3,
  js: siJavascript,
  python: siPython,
  c: siC,
  cpp: siCplusplus
}

function FileIcon({ kind, size = 16 }) {
  const icon = FILE_ICONS[kind]

  if (!icon) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 3.5h9l5 5v12H5z"
          fill="#64748B"
        />
        <path
          d="M14 3.5v5h5"
          fill="#94A3B8"
        />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d={icon.path}
        fill={'#' + icon.hex}
      />
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

  return <svg {...common}><circle cx="10" cy="10" r="3" /><path d="m10 2.6.8 1.8 2 .5 1.6-1.1 1.8 1.8-1.1 1.6.5 2 1.8.8v2.6l-1.8.8-.5 2 1.1 1.6-1.8 1.8-1.6-1.1-2 .5-.8 1.8H7.4l-.8-1.8-2-.5L3 16.4l1.1-1.6-.5-2-1.8-.8V7.6l1.8-.8-.5-2L3 3.2l1.6 1.1 2-.5.8-1.8z" /></svg>
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
    credentials: 'include',
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

function firstFile(files) {
  return Object.keys(files)[0] || 'index.html'
}

function IDE() {
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState('')
  const [projectName, setProjectName] = useState('Untitled Project')
  const [files, setFiles] = useState({})
  const [activeFile, setActiveFile] = useState('index.html')
  const [openFiles, setOpenFiles] = useState(['index.html'])
  const [activeView, setActiveView] = useState('files')
  const [bottomTab, setBottomTab] = useState('terminal')
  const [bottomOpen, setBottomOpen] = useState(true)
  const [preview, setPreview] = useState('')
  const [apiStatus, setApiStatus] = useState('checking')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const terminalRef = useRef(null)
  const terminal = useRef(null)
  const filesRef = useRef(files)

  const { data: session } = authClient.useSession()
  const currentLanguage = FILE_META[activeFile]?.language || 'plaintext'
  const currentValue = files[activeFile] ?? ''
  const currentProject = projects.find(project => project.id === currentProjectId)

  useEffect(() => {
    let cancelled = false

    async function loadWorkspace() {
      try {
        await claimWorkspace()
      } catch {}

      try {
        const result = await initializeWorkspace(DEFAULT_FILES)

        if (cancelled) return

        setProjects(result.projects)
        setCurrentProjectId(result.currentProject.id)
        setProjectName(result.currentProject.name)
        setFiles(result.currentProject.files)
        setActiveFile(firstFile(result.currentProject.files))
        setOpenFiles([firstFile(result.currentProject.files)])
        setWorkspaceReady(true)
      } catch (error) {
        if (!cancelled) {
          setSaveStatus('storage error')
          console.error(error)
        }
      }
    }

    void loadWorkspace()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    if (!workspaceReady || !currentProjectId) return

    setSaveStatus('saving')

    const timer = window.setTimeout(async () => {
      try {
        const timestamp = Date.now()

        await saveProject({
          id: currentProjectId,
          name: projectName,
          files,
          createdAt: currentProject?.createdAt || timestamp,
          updatedAt: timestamp
        })

        setProjects(current => current.map(project => (
          project.id === currentProjectId
            ? {
                ...project,
                name: projectName,
                files,
                updatedAt: timestamp
              }
            : project
        )))

        setSaveStatus('saved')
      } catch {
        setSaveStatus('storage error')
      }
    }, 500)

    return () => window.clearTimeout(timer)
  }, [
    workspaceReady,
    currentProjectId,
    projectName,
    files
  ])

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

  async function handleSignOut() {
    await authClient.signOut()
    window.location.assign('/signin')
  }

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
        setActiveFile(next[next.length - 1] || firstFile(files))
      }

      return next.length ? next : [firstFile(files)]
    })
  }

  function refreshPreview() {
    setPreview(buildPreview(files))
    setPreviewKey(value => value + 1)
  }

  async function switchProject(id) {
    if (id === currentProjectId) {
      setProjectMenuOpen(false)
      return
    }

    try {
      const project = await getProject(id)

      if (!project) return

      const timestamp = Date.now()

      await saveProject({
        id: currentProjectId,
        name: projectName,
        files,
        createdAt: currentProject?.createdAt || timestamp,
        updatedAt: timestamp
      })

      setProjects(current => current.map(item => (
        item.id === currentProjectId
          ? { ...item, name: projectName, files, updatedAt: timestamp }
          : item
      )))

      setCurrentProjectId(project.id)
      setProjectName(project.name)
      setFiles(project.files)
      setActiveFile(firstFile(project.files))
      setOpenFiles([firstFile(project.files)])
      setPreview('')
      setPreviewKey(value => value + 1)
      localStorage.setItem('poligo-current-project', project.id)
      setProjectMenuOpen(false)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('storage error')
    }
  }

  async function newProject() {
    try {
      const project = await createProject('Untitled Project', DEFAULT_FILES)

      setProjects(current => [project, ...current])
      setCurrentProjectId(project.id)
      setProjectName(project.name)
      setFiles(project.files)
      setActiveFile('index.html')
      setOpenFiles(['index.html'])
      setPreview('')
      setPreviewKey(value => value + 1)
      setProjectMenuOpen(false)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('storage error')
    }
  }

  async function renameProject() {
    const name = window.prompt('Project name', projectName)?.trim()

    if (!name || name === projectName) return

    setProjectName(name)
    setProjectMenuOpen(false)
  }

  async function duplicateCurrentProject() {
    if (!currentProject) return

    try {
      const project = await duplicateProject({
        ...currentProject,
        name: projectName,
        files
      })

      setProjects(current => [project, ...current])
      setCurrentProjectId(project.id)
      setProjectName(project.name)
      setFiles(project.files)
      setActiveFile(firstFile(project.files))
      setOpenFiles([firstFile(project.files)])
      setPreview('')
      setPreviewKey(value => value + 1)
      setProjectMenuOpen(false)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('storage error')
    }
  }

  async function removeCurrentProject() {
    if (!currentProject) return

    const confirmed = window.confirm('Delete "' + projectName + '"?')

    if (!confirmed) return

    try {
      await saveProject({
        id: currentProjectId,
        name: projectName,
        files,
        createdAt: currentProject.createdAt,
        updatedAt: Date.now()
      })

      await deleteProject(currentProjectId)

      const remaining = await listProjects()

      if (!remaining.length) {
        await newProject()
        return
      }

      const nextProject = remaining[0]

      setProjects(remaining)
      setCurrentProjectId(nextProject.id)
      setProjectName(nextProject.name)
      setFiles(nextProject.files)
      setActiveFile(firstFile(nextProject.files))
      setOpenFiles([firstFile(nextProject.files)])
      setPreview('')
      setPreviewKey(value => value + 1)
      localStorage.setItem('poligo-current-project', nextProject.id)
      setProjectMenuOpen(false)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('storage error')
    }
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

  if (!workspaceReady) {
    return (
      <div className="app-loading">
        <img className="app-loading-logo" src="/poligo-mark.svg" alt="Poligo" />
        <div className="app-loading-text">Loading workspace...</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button className="product-button" aria-label="Poligo menu">
            <img src="/poligo-mark.svg" alt="" />
          </button>
          <button className="menu-button">File</button>
          <button className="menu-button">Edit</button>
          <button className="menu-button">View</button>
        </div>
        <div className="project-title-wrap">
          <button
            className={'project-picker ' + (projectMenuOpen ? 'open' : '')}
            onClick={() => setProjectMenuOpen(value => !value)}
          >
            <span className="project-title">{projectName}</span>
            <span className="project-picker-arrow">⌄</span>
            <span className="project-visibility">Private</span>
            <span className={'save-status ' + saveStatus.replace(/\s/g, '-').replace(' ', '-')}>
              {saveStatus}
            </span>
          </button>
          {projectMenuOpen && (
            <div className="project-menu">
              <div className="project-menu-head">PROJECTS</div>
              <div className="project-menu-list">
                {projects.map(project => (
                  <button
                    key={project.id}
                    className={'project-menu-item ' + (project.id === currentProjectId ? 'active' : '')}
                    onClick={() => switchProject(project.id)}
                  >
                    <span>{project.name}</span>
                    <small>{project.id === currentProjectId ? 'current' : ''}</small>
                  </button>
                ))}
              </div>
              <div className="project-menu-actions">
                <button onClick={newProject}>New</button>
                <button onClick={duplicateCurrentProject}>Duplicate</button>
                <button onClick={renameProject}>Rename</button>
                <button className="danger" onClick={removeCurrentProject}>Delete</button>
              </div>
            </div>
          )}
        </div>
        <div className="topbar-right">
          <button className="top-icon" title="Settings"><ActivityIcon type="settings" /></button>
          <span className="account-name">
            {session?.user?.name}
          </span>
          <button className="signout-button" onClick={handleSignOut}>
            Sign out
          </button>
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


function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppRouter() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const { data: session, isPending } = authClient.useSession()
  const authPath = pathname === '/signin' || pathname === '/createaccount'

  useEffect(() => {
    function updatePath() {
      setPathname(window.location.pathname)
    }

    window.addEventListener('popstate', updatePath)

    return () => {
      window.removeEventListener('popstate', updatePath)
    }
  }, [])

  useEffect(() => {
    if (isPending) return

    if (session?.user && authPath) {
      navigate('/')
      return
    }

    if (!session?.user && !authPath) {
      navigate('/signin')
    }
  }, [authPath, isPending, session])

  if (isPending || (!session?.user && !authPath)) {
    return (
      <div className="app-loading">
        <div className="app-loading-title">Poligo</div>
        <div className="app-loading-text">Checking account...</div>
      </div>
    )
  }

  if (pathname === '/signin') {
    return <AuthPage mode="signin" />
  }

  if (pathname === '/createaccount') {
    return <AuthPage mode="signup" />
  }

  return <IDE />
}

createRoot(document.getElementById('root')).render(<AppRouter />)
