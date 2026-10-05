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
    viewBox: '0 0 32 32',
    'aria-hidden': true
  }

  if (kind === 'html') {
    return (
      <svg {...common}>
        <path d="M4 3h24l-2.3 24L16 29 6.3 27Z" fill="#E44D26" />
        <path d="m7 7 1.8 16.5 7.2 2.2V7Z" fill="#F16529" />
        <path d="M16 10h8.8l-.8 8.8L16 21.2Z" fill="#FFFFFF" opacity=".95" />
        <path d="M11 11h8v3h-4.8l.2 2h4.6l-.5 5-2.5.8V19l-1.9.6-.4-4.6H11Z" fill="#E44D26" />
      </svg>
    )
  }

  if (kind === 'css') {
    return (
      <svg {...common}>
        <path d="M4 3h24l-2.3 24L16 29 6.3 27Z" fill="#1572B6" />
        <path d="M16 7v19l7.1-2.2L25 7Z" fill="#33A9DC" opacity=".92" />
        <path d="M10 10h12v3h-8.8l.2 2h8.2l-.5 6.4-5.1 1.6v-3l2.4-.7.1-1.3h-7.1Z" fill="#FFFFFF" />
      </svg>
    )
  }

  if (kind === 'js') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="26" height="26" rx="3" fill="#F7DF1E" />
        <path d="M10 11v7.3c0 1.6-.6 2.6-2.5 2.6-1.3 0-2.1-.5-2.6-1l1.6-1.8c.4.4.8.7 1.2.7.5 0 .7-.2.7-.9V11Zm7.1-.2c1.7 0 3 .6 4 1.7l-1.7 1.9c-.6-.6-1.3-1-2.1-1-.6 0-.9.2-.9.6 0 .5.4.7 1.7 1.2 2.1.8 3.1 1.8 3.1 3.8 0 2-1.6 3.4-4 3.4-2.1 0-3.6-.8-4.7-2.1l1.9-1.8c.7.8 1.5 1.3 2.6 1.3.7 0 1-.2 1-.7 0-.5-.4-.7-1.8-1.2-2-.8-2.8-1.8-2.8-3.6 0-2 1.5-3.5 3.7-3.5Z" fill="#111827" />
      </svg>
    )
  }

  if (kind === 'python') {
    return (
      <svg {...common}>
        <path d="M15.6 3.1c-4.8 0-4.9 2.2-4.9 4.2v2.1h7v1.5H9.8C6 10.9 4 13.5 4 17c0 3.3 1.8 5.2 5.2 5.2h2.3v-3.1c0-1.8 1.2-3 3-3h4.7c2.8 0 4.8-2 4.8-4.9V7.5c0-2.9-2-4.4-4.4-4.4Zm-1.3 2.1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill="#3776AB" />
        <path d="M16.4 28.9c4.8 0 4.9-2.2 4.9-4.2v-2.1h-7v-1.5h7.9c3.8 0 5.8-2.6 5.8-6.1 0-3.3-1.8-5.2-5.2-5.2h-2.3v3.1c0 1.8-1.2 3-3 3h-4.7c-2.8 0-4.8 2-4.8 4.9v3.7c0 2.9 2 4.4 4.4 4.4Zm1.3-2.1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="#FFD43B" transform="translate(-1 -1)" />
      </svg>
    )
  }

  if (kind === 'cpp') {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="13" fill="#00599C" />
        <path d="M9 17.6c1.2 2.1 2.9 3.1 5.1 3.1 1.6 0 3-.5 4.2-1.5l-1.8-2.1c-.7.6-1.5.9-2.4.9-1.6 0-2.6-1-2.6-3s1-3 2.6-3c.9 0 1.7.3 2.4.9l1.8-2.1C17.1 9.8 15.7 9.3 14.1 9.3c-2.2 0-3.9 1-5.1 3.1Z" fill="#FFFFFF" />
        <path d="M19 11.5h2v2h2v1.7h-2v2h-2v-2h-2v-1.7h2Zm3.4 0h2v2h1.6v1.7h-1.6v2h-2v-2h-1.5v-1.7h1.5Z" fill="#FFFFFF" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M7 3h12l6 6v20H7Z" fill="#64748B" />
      <path d="M19 3v6h6" fill="#94A3B8" />
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
