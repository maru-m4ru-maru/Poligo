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
  claimWorkspace,
  listCommits,
  getCommitDiff,
  createCommit,
  restoreCommit
} from './projectStore'
import { authClient } from './auth-client'
import AuthPage from './AuthPage'
import Dashboard from './Dashboard'
import HomePage from './HomePage'
import TermsPage from './TermsPage'

const DEFAULT_FILES = {
  'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>IDEベンダーに縛られずに開発できます。</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
  'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #10100e;\n  color: #ecece5;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
  'app.js': 'const title = document.querySelector("h1")\n\ntitle.addEventListener("click", () => {\n  title.textContent = "It works."\n})',
  'main.py': 'print("Hello from Python")',
  'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++\\n";\n    return 0;\n}'
}

const FILE_META = {
  html: { language: 'html', kind: 'html' },
  css: { language: 'css', kind: 'css' },
  js: { language: 'javascript', kind: 'js' },
  jsx: { language: 'javascript', kind: 'js' },
  ts: { language: 'typescript', kind: 'js' },
  tsx: { language: 'typescript', kind: 'js' },
  py: { language: 'python', kind: 'python' },
  java: { language: 'java', kind: 'text' },
  go: { language: 'go', kind: 'text' },
  rs: { language: 'rust', kind: 'text' },
  php: { language: 'php', kind: 'text' },
  rb: { language: 'ruby', kind: 'text' },
  kt: { language: 'kotlin', kind: 'text' },
  cs: { language: 'csharp', kind: 'text' },
  c: { language: 'c', kind: 'c' },
  h: { language: 'c', kind: 'c' },
  cpp: { language: 'cpp', kind: 'cpp' },
  cc: { language: 'cpp', kind: 'cpp' },
  cxx: { language: 'cpp', kind: 'cpp' },
  hpp: { language: 'cpp', kind: 'cpp' },
  json: { language: 'json', kind: 'text' },
  md: { language: 'markdown', kind: 'text' },
  txt: { language: 'plaintext', kind: 'text' }
}

const API_URL = import.meta.env.VITE_API_URL || ''

const SERVER_LANGUAGES = new Set([
  'python',
  'java',
  'go',
  'rust',
  'php',
  'ruby',
  'kotlin',
  'c',
  'cpp',
  'csharp'
])

const FILE_ICONS = {
  html: '/icons/html5.svg',
  css: '/icons/css.svg',
  js: '/icons/javascript.svg',
  python: '/icons/python.svg',
  c: '/icons/c.svg',
  cpp: '/icons/cplusplus.svg'
}

function getFileMeta(name) {
  const extension = name.includes('.')
    ? name.split('.').pop().toLowerCase()
    : ''

  return FILE_META[extension] || {
    language: 'plaintext',
    kind: 'text'
  }
}

function FileIcon({ kind, size = 16 }) {
  const src = FILE_ICONS[kind]

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="file-icon-image"
        aria-hidden="true"
      />
    )
  }

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

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      body?.error ||
      response.status + ' ' + response.statusText
    )
  }

  return body
}

function firstFile(files) {
  return Object.keys(files)[0] || 'index.html'
}

function IDE({ projectId }) {
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [projects, setProjects] = useState([])
  const [currentProjectId, setCurrentProjectId] = useState('')
  const [projectName, setProjectName] = useState('無題のプロジェクト')
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
  const [searchQuery, setSearchQuery] = useState('')
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [quickOpenQuery, setQuickOpenQuery] = useState('')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [execution, setExecution] = useState({
    id: '',
    status: 'idle',
    result: null,
    error: ''
  })
  const [sourceCommits, setSourceCommits] = useState([])
  const [sourceDiff, setSourceDiff] = useState([])
  const [sourceCommitMessage, setSourceCommitMessage] = useState('')
  const [sourceSelectedCommit, setSourceSelectedCommit] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const terminalRef = useRef(null)
  const terminal = useRef(null)
  const filesRef = useRef(files)

  const { data: session } = authClient.useSession()
  const currentLanguage = getFileMeta(activeFile).language
  const currentValue = files[activeFile] ?? ''
  const currentProject = projects.find(project => project.id === currentProjectId)

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return []

    const results = []

    for (const [name, value] of Object.entries(files)) {
      const lowerName = name.toLowerCase()
      const lowerValue = value.toLowerCase()

      if (lowerName.includes(query)) {
        results.push({
          name,
          type: 'file',
          preview: 'ファイル名の一致'
        })
        continue
      }

      const line = value
        .split('\n')
        .findIndex(item => item.toLowerCase().includes(query))

      if (line >= 0) {
        const text = value.split('\n')[line].trim()

        results.push({
          name,
          type: 'content',
          line: line + 1,
          preview: text.slice(0, 100)
        })
      }
    }

    return results
  }, [files, searchQuery])

  const quickOpenResults = useMemo(() => {
    const query = quickOpenQuery.trim().toLowerCase()

    return Object.keys(files).filter(name =>
      !query || name.toLowerCase().includes(query)
    )
  }, [files, quickOpenQuery])

  const commands = useMemo(() => [
    {
      id: 'new-file',
      title: '新しいファイル',
      hint: 'ファイルを作成',
      run: () => void createFile()
    },
    {
      id: 'save',
      title: 'プロジェクトを保存',
      hint: 'Ctrl+S',
      run: () => void saveCurrentProject()
    },
    {
      id: 'run',
      title: '実行',
      hint: '現在のファイルを実行',
      run: () => void runProject()
    },
    {
      id: 'terminal',
      title: 'ターミナルを表示/非表示',
      hint: 'ターミナルを開く',
      run: () => {
        setBottomTab('terminal')
        setBottomOpen(true)
      }
    },
    {
      id: 'output',
      title: '出力を開く',
      hint: '実行結果を表示',
      run: () => {
        setBottomTab('output')
        setBottomOpen(true)
      }
    },
    {
      id: 'problems',
      title: '問題を開く',
      hint: '実行エラーを表示',
      run: () => {
        setBottomTab('problems')
        setBottomOpen(true)
      }
    },
    {
      id: 'dashboard',
      title: 'ダッシュボードを開く',
      hint: 'Poligo Cloud',
      run: () => navigate('/dashboard')
    }
  ].filter(command =>
    !commandQuery.trim() ||
    command.title.toLowerCase().includes(commandQuery.trim().toLowerCase())
  ), [commandQuery])

  useEffect(() => {
    let cancelled = false

    async function loadWorkspace() {
      try {
        await claimWorkspace()
      } catch {}

      try {
        const result = projectId
          ? {
              projects: await listProjects(),
              currentProject: await getProject(projectId)
            }
          : await initializeWorkspace(DEFAULT_FILES)

        if (!result.currentProject) {
          throw new Error('Project not found')
        }

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
    if (activeView !== 'source' || !currentProjectId) {
      return
    }

    let cancelled = false

    async function loadSourceControl() {
      setSourceLoading(true)
      setSourceError('')

      try {
        const result = await listCommits(currentProjectId)
        const commits = Array.isArray(result.commits) ? result.commits : []

        if (cancelled) return

        setSourceCommits(commits)

        const selectedId = commits.some(commit => commit.id === sourceSelectedCommit)
          ? sourceSelectedCommit
          : commits[0]?.id || ''

        setSourceSelectedCommit(selectedId)

        if (selectedId) {
          const diff = await getCommitDiff(currentProjectId, selectedId)

          if (!cancelled) {
            setSourceDiff(diff.files || [])
          }
        } else {
          setSourceDiff([])
        }
      } catch (error) {
        if (!cancelled) {
          setSourceError(error instanceof Error ? error.message : 'ソース管理の読み込みに失敗しました')
        }
      } finally {
        if (!cancelled) {
          setSourceLoading(false)
        }
      }
    }

    void loadSourceControl()

    return () => {
      cancelled = true
    }
  }, [activeView, currentProjectId])

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
    instance.writeln('Poligo ターミナル')
    instance.writeln('利用可能なコマンドは「help」で確認できます。')
    instance.write('$ ')

    let buffer = ''

    instance.onData(data => {
      if (data === '\r') {
        instance.write('\r\n')

        if (buffer === 'clear') {
          instance.clear()
        } else if (buffer === 'help') {
          instance.writeln('commands: help, clear, run, files, ls, pwd, cat <file>, open <file>, health')
        } else if (buffer === 'files' || buffer === 'ls') {
          Object.keys(filesRef.current).forEach(name => instance.writeln(name))
        } else if (buffer === 'pwd') {
          instance.writeln('/workspace')
        } else if (buffer.startsWith('cat ')) {
          const target = buffer.slice(4).trim()

          if (Object.prototype.hasOwnProperty.call(filesRef.current, target)) {
            instance.writeln(filesRef.current[target])
          } else {
            instance.writeln('cat: ' + target + ': No such file')
          }
        } else if (buffer.startsWith('open ')) {
          const target = buffer.slice(5).trim()

          if (Object.prototype.hasOwnProperty.call(filesRef.current, target)) {
            openFile(target)
          } else {
            instance.writeln('open: ' + target + ': No such file')
          }
        } else if (buffer === 'health') {
          request('/api/health')
            .then(result => instance.writeln(JSON.stringify(result)))
            .catch(error => instance.writeln(error.message))
        } else if (buffer === 'run') {
          setPreview(buildPreview(filesRef.current))
          setPreviewKey(value => value + 1)
          instance.writeln('プレビューを更新しました。')
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

  async function refreshSourceControl(selectedCommitId = '') {
    if (!currentProjectId) return

    setSourceLoading(true)
    setSourceError('')

    try {
      const result = await listCommits(currentProjectId)
      const commits = Array.isArray(result.commits) ? result.commits : []
      const selectedId =
        commits.find(commit => commit.id === selectedCommitId)?.id ||
        commits.find(commit => commit.id === sourceSelectedCommit)?.id ||
        commits[0]?.id ||
        ''

      setSourceCommits(commits)
      setSourceSelectedCommit(selectedId)

      if (selectedId) {
        const diff = await getCommitDiff(currentProjectId, selectedId)
        setSourceDiff(diff.files || [])
      } else {
        setSourceDiff([])
      }
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : 'ソース管理の読み込みに失敗しました')
    } finally {
      setSourceLoading(false)
    }
  }

  async function commitChanges() {
    const message = sourceCommitMessage.trim()

    if (!message || !currentProjectId) return

    setSourceLoading(true)
    setSourceError('')

    try {
      await saveCurrentProject()
      const commit = await createCommit(currentProjectId, message)

      setSourceCommitMessage('')
      await refreshSourceControl(commit.id)
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : 'コミットに失敗しました')
      setSourceLoading(false)
    }
  }

  function openConfirmDialog({
    title,
    message,
    confirmLabel = '確認',
    danger = false,
    onConfirm
  }) {
    setDialog({
      type: 'confirm',
      title,
      message,
      confirmLabel,
      danger,
      onConfirm
    })
  }

  function openInputDialog({
    title,
    message,
    value = '',
    placeholder = '',
    confirmLabel = '保存',
    onConfirm
  }) {
    setDialog({
      type: 'input',
      title,
      message,
      value,
      placeholder,
      confirmLabel,
      onConfirm
    })
  }

  async function handleDialogConfirm() {
    if (!dialog || dialogBusy) return

    setDialogBusy(true)

    try {
      if (dialog.type === 'input') {
        const value = dialog.value.trim()

        if (!value) {
          setDialogBusy(false)
          return
        }

        await dialog.onConfirm(value)
      } else {
        await dialog.onConfirm()
      }

      setDialog(null)
    } finally {
      setDialogBusy(false)
    }
  }

  async function restoreSelectedCommit(commitId) {
    const commit = sourceCommits.find(item => item.id === commitId)

    if (!commit) return

    openConfirmDialog({
      title: '復元 commit',
      message: '"' + commit.message + '" will replace the current project files.',
      confirmLabel: '復元',
      danger: true,
      onConfirm: async () => {
        setSourceLoading(true)
        setSourceError('')

        try {
          const restored = await restoreCommit(currentProjectId, commitId)
          const nextFiles = restored.files

          setFiles(nextFiles)
          setActiveFile(firstFile(nextFiles))
          setOpenFiles([firstFile(nextFiles)])
          setPreview('')
          setPreviewKey(value => value + 1)
          setSaveStatus('saved')
          await refreshSourceControl(commitId)
        } catch (error) {
          setSourceError(error instanceof Error ? error.message : '復元 failed')
          setSourceLoading(false)
          throw error
        }
      }
    })
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

  async function saveCurrentProject() {
    if (!currentProjectId) return

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
  }

  async function createFile() {
    openInputDialog({
      title: 'ファイルを作成',
      message: 'Choose a file name for the new file.',
      placeholder: 'example.py',
      confirmLabel: 'Create',
      onConfirm: async value => {
        const normalized = value.trim()

        if (!normalized || normalized.includes('/') || normalized.includes('\\')) {
          return
        }

        if (Object.prototype.hasOwnProperty.call(files, normalized)) {
          setActiveFile(normalized)
          setOpenFiles(current => current.includes(normalized) ? current : [...current, normalized])
          return
        }

        setFiles(current => ({
          ...current,
          [normalized]: ''
        }))
        setActiveFile(normalized)
        setOpenFiles(current => [...current, normalized])
        setSaveStatus('saving')
      }
    })
  }

  async function deleteFile(name = activeFile) {
    if (Object.keys(files).length <= 1) return

    openConfirmDialog({
      title: 'Delete file',
      message: '"' + name + '" will be removed from this project.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const remainingNames = Object.keys(files).filter(file => file !== name)
        const nextFile = remainingNames[0]

        setFiles(current => {
          const next = { ...current }
          delete next[name]
          return next
        })

        setOpenFiles(current => current.filter(file => file !== name))
        setActiveFile(current => current === name ? nextFile : current)
      }
    })
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
      const project = await createProject('無題のプロジェクト', DEFAULT_FILES)

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
    openInputDialog({
      title: 'プロジェクト名を変更',
      message: 'Choose a new name for this project.',
      value: projectName,
      placeholder: 'プロジェクト名',
      confirmLabel: 'Rename',
      onConfirm: async name => {
        if (name === projectName) return

        setProjectName(name)
        setProjectMenuOpen(false)
      }
    })
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

    openConfirmDialog({
      title: 'プロジェクトを削除',
      message: '"' + projectName + '" and all of its files will be permanently removed.',
      confirmLabel: 'プロジェクトを削除',
      danger: true,
      onConfirm: async () => {
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

          const nextProject = await getProject(remaining[0].id)

          if (!nextProject) {
            throw new Error('next project could not be loaded')
          }

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
    })
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (modifier && key === 's') {
        event.preventDefault()
        void saveCurrentProject()
        return
      }

      if (modifier && key === 'p' && !event.shiftKey) {
        event.preventDefault()
        setQuickOpenQuery('')
        setQuickOpenOpen(true)
        setCommandPaletteOpen(false)
        return
      }

      if (modifier && event.shiftKey && key === 'p') {
        event.preventDefault()
        setCommandQuery('')
        setCommandPaletteOpen(true)
        setQuickOpenOpen(false)
        return
      }

      if (event.key === 'Escape') {
        setQuickOpenOpen(false)
        setCommandPaletteOpen(false)

        if (dialog && !dialogBusy) {
          setDialog(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentProjectId, projectName, files, dialog, dialogBusy])

  async function runProject() {
    refreshPreview()
    setBottomOpen(true)
    setBottomTab('output')
    setExecution({
      id: '',
      status: SERVER_LANGUAGES.has(currentLanguage) ? 'queued' : 'succeeded',
      result: SERVER_LANGUAGES.has(currentLanguage)
        ? null
        : {
            stdout: 'ブラウザプレビューを更新しました。',
            stderr: '',
            exitCode: 0
          },
      error: ''
    })

    if (!SERVER_LANGUAGES.has(currentLanguage)) {
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

      setExecution({
        id: result.id,
        status: result.status || 'queued',
        result: null,
        error: ''
      })

      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 500))

        const status = await request(
          '/api/executions/' + encodeURIComponent(result.id)
        )

        if (status.status === 'running' || status.status === 'queued') {
          setExecution(current => ({
            ...current,
            status: status.status
          }))
          continue
        }

        if (
          status.status === 'succeeded' ||
          status.status === 'failed' ||
          status.status === 'timeout'
        ) {
          setExecution({
            id: result.id,
            status: status.status,
            result: status.result || null,
            error: ''
          })
          return
        }
      }

      setExecution(current => ({
        ...current,
        status: 'timeout',
        result: {
          stdout: '',
          stderr: 'Execution polling timed out.',
          exitCode: null,
          timedOut: true
        }
      }))
    } catch (error) {
      setExecution({
        id: '',
        status: 'failed',
        result: null,
        error: error instanceof Error ? error.message : 'Execution failed'
      })
    }
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
        <div className="app-loading-text">ワークスペースを読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      {dialog && (
        <div className="poligo-dialog-overlay" onMouseDown={() => {
          if (!dialogBusy) setDialog(null)
        }}>
          <div
            className="poligo-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="poligo-dialog-header">
              <div>
                <span className="poligo-dialog-eyebrow">POLIGO</span>
                <h2>{dialog.title}</h2>
              </div>
              <button
                className="poligo-dialog-close"
                type="button"
                onClick={() => setDialog(null)}
                disabled={dialogBusy}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <p className="poligo-dialog-message">{dialog.message}</p>

            {dialog.type === 'input' && (
              <input
                autoFocus
                className="poligo-dialog-input"
                value={dialog.value}
                onChange={event => setDialog(current => (
                  current ? { ...current, value: event.target.value } : current
                ))}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleDialogConfirm()
                  }
                }}
                placeholder={dialog.placeholder}
                disabled={dialogBusy}
              />
            )}

            <div className="poligo-dialog-actions">
              <button
                className="poligo-dialog-cancel"
                type="button"
                onClick={() => setDialog(null)}
                disabled={dialogBusy}
              >
                Cancel
              </button>
              <button
                className={'poligo-dialog-confirm' + (dialog.danger ? ' danger' : '')}
                type="button"
                onClick={() => void handleDialogConfirm()}
                disabled={dialogBusy}
              >
                {dialogBusy ? 'Working...' : dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {quickOpenOpen && (
      <div className="ide-overlay" onClick={() => setQuickOpenOpen(false)}>
        <div className="quick-open" onClick={event => event.stopPropagation()}>
          <input
            autoFocus
            value={quickOpenQuery}
            onChange={event => setQuickOpenQuery(event.target.value)}
            placeholder="開く file..."
          />
          <div className="quick-open-list">
            {quickOpenResults.map(name => (
              <button
                key={name}
                className="quick-open-item"
                onClick={() => {
                  openFile(name)
                  setQuickOpenOpen(false)
                }}
              >
                <FileIcon kind={getFileMeta(name).kind} size={15} />
                <span>{name}</span>
              </button>
            ))}
            {!quickOpenResults.length && (
              <div className="quick-open-empty">一致するファイルがありません。</div>
            )}
          </div>
        </div>
      </div>
    )}

    {commandPaletteOpen && (
      <div className="ide-overlay" onClick={() => setCommandPaletteOpen(false)}>
        <div className="command-palette" onClick={event => event.stopPropagation()}>
          <input
            autoFocus
            value={commandQuery}
            onChange={event => setCommandQuery(event.target.value)}
            placeholder="Type a command..."
          />
          <div className="command-list">
            {commands.map(command => (
              <button
                key={command.id}
                className="command-item"
                onClick={() => {
                  setCommandPaletteOpen(false)
                  command.run()
                }}
              >
                <strong>{command.title}</strong>
                <span>{command.hint}</span>
              </button>
            ))}
            {!commands.length && (
              <div className="quick-open-empty">一致するコマンドがありません。</div>
            )}
          </div>
        </div>
      </div>
    )}

    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="product-button"
            aria-label="開く dashboard"
            title="ダッシュボード"
            onClick={() => navigate('/dashboard')}
          >
            <img src="/poligo-mark.svg" alt="" />
          </button>
          <button className="menu-button">ファイル</button>
          <button className="menu-button">編集</button>
          <button className="menu-button">表示</button>
        </div>
        <div className="project-title-wrap">
          <button
            className={'project-picker ' + (projectMenuOpen ? 'open' : '')}
            onClick={() => setProjectMenuOpen(value => !value)}
          >
            <span className="project-title">{projectName}</span>
            <span className="project-picker-arrow">⌄</span>
            <span className="project-visibility">非公開</span>
            <span className={'save-status ' + saveStatus.replace(/\s/g, '-').replace(' ', '-')}>
              {saveStatus}
            </span>
          </button>
          {projectMenuOpen && (
            <div className="project-menu">
              <div className="project-menu-head">プロジェクト</div>
              <div className="project-menu-list">
                {projects.map(project => (
                  <button
                    key={project.id}
                    className={'project-menu-item ' + (project.id === currentProjectId ? 'active' : '')}
                    onClick={() => switchProject(project.id)}
                  >
                    <span>{project.name}</span>
                    <small>{project.id === currentProjectId ?  '現在' : ''}</small>
                  </button>
                ))}
              </div>
              <div className="project-menu-actions">
                <button onClick={newProject}>新規</button>
                <button onClick={duplicateCurrentProject}>複製</button>
                <button onClick={renameProject}>名前を変更</button>
                <button className="danger" onClick={removeCurrentProject}>削除</button>
              </div>
            </div>
          )}
        </div>
        <div className="topbar-right">
          <button className="top-icon" title="設定"><ActivityIcon type="settings" /></button>
          <span className="account-name">
            {session?.user?.name}
          </span>
          <button className="dashboard-button" onClick={() => navigate('/dashboard')}>
            ダッシュボード
          </button>
          <button className="signout-button" onClick={handleSignOut}>
            サインアウト
          </button>
          <span className="connection-status">
            <span className={'status-dot ' + apiStatus} />
            {apiStatus}
          </span>
          <button className="top-button" onClick={resetProject}>リセット</button>
          <button className="run-button" onClick={runProject}><span>▶</span> 実行</button>
        </div>
      </header>

      <div className="ide-body">
        <aside className="activity-bar">
          <div className="activity-top">
            {[
              ['files', 'ファイル'],
              ['search', '検索'],
              ['source', 'ソース管理']
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
            title="設定"
          >
            <ActivityIcon type="settings" />
          </button>
        </aside>

        <aside className="explorer">
          <div className="explorer-head">
            <span>{activeView === 'files' ? 'EXPLORER' : activeView.toUpperCase()}</span>
            {activeView === 'files' && (
              <div className="explorer-actions">
                <button className="more-button" onClick={() => void createFile()} title="新しいファイル">＋</button>
                <button className="more-button" onClick={() => void deleteFile()} title="ファイルを削除">−</button>
              </div>
            )}
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
                    <FileIcon kind={getFileMeta(name).kind} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activeView === 'search' && (
            <div className="search-view">
              <input
                autoFocus
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="ファイルを検索"
              />
              {!searchQuery && (
                <div className="search-hint">
                  Search file names and contents.
                </div>
              )}
              {searchQuery && !searchResults.length && (
                <div className="search-hint">
                  一致する項目がありません。
                </div>
              )}
              {searchResults.map(result => (
                <button
                  key={result.name + ':' + (result.line || 0)}
                  className="search-result"
                  onClick={() => {
                    openFile(result.name)
                    if (result.line) {
                      setActiveView('files')
                    }
                  }}
                >
                  <FileIcon kind={getFileMeta(result.name).kind} size={14} />
                  <div className="search-result-copy">
                    <strong>{result.name}</strong>
                    <span>
                      {result.line ? '行 ' + result.line + ' · ' : ''}
                      {result.preview}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeView === 'source' && (
            <div className="source-control-view">
              <div className="source-control-commit">
                <input
                  value={sourceCommitMessage}
                  onChange={event => setSourceCommitMessage(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && sourceCommitMessage.trim()) {
                      void commitChanges()
                    }
                  }}
                  placeholder="コミットメッセージ"
                  disabled={sourceLoading}
                />
                <button
                  className="source-commit-button"
                  onClick={() => void commitChanges()}
                  disabled={sourceLoading || !sourceCommitMessage.trim()}
                >
                  コミット
                </button>
              </div>

              {sourceError && (
                <div className="source-control-error">{sourceError}</div>
              )}

              <div className="source-control-section">
                <div className="source-control-section-title">
                  <span>変更</span>
                  <span>{sourceDiff.length}</span>
                </div>

                {sourceLoading && (
                  <div className="source-control-empty">読み込み中...</div>
                )}

                {!sourceLoading && !sourceDiff.length && (
                  <div className="source-control-empty">変更はありません。</div>
                )}

                {!sourceLoading && sourceDiff.map(file => (
                  <button
                    key={file.path}
                    className="source-file-row"
                    onClick={() => openFile(file.path)}
                  >
                    <span className={'source-file-status source-file-status-' + file.status}>
                      {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
                    </span>
                    <span>{file.path}</span>
                  </button>
                ))}
              </div>

              <div className="source-control-section">
                <div className="source-control-section-title">
                  <span>履歴</span>
                  <span>{sourceCommits.length}</span>
                </div>

                {!sourceCommits.length && !sourceLoading && (
                  <div className="source-control-empty">コミットはありません。</div>
                )}

                {sourceCommits.map(commit => (
                  <div
                    key={commit.id}
                    className={'source-commit-row ' + (
                      sourceSelectedCommit === commit.id ? 'active' : ''
                    )}
                  >
                    <button
                      className="source-commit-select"
                      onClick={async () => {
                        setSourceSelectedCommit(commit.id)
                        try {
                          const diff = await getCommitDiff(currentProjectId, commit.id)
                          setSourceDiff(diff.files || [])
                        } catch (error) {
                          setSourceError(
                            error instanceof Error ? error.message : '差分の取得に失敗しました'
                          )
                        }
                      }}
                    >
                      <strong>{commit.message}</strong>
                      <small>
                        {new Intl.DateTimeFormat('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(commit.createdAt))}
                      </small>
                    </button>
                    <button
                      className="source-restore-button"
                      title="復元 this commit"
                      onClick={() => void restoreSelectedCommit(commit.id)}
                    >
                      ↶
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="empty-view">
              <div className="empty-title">設定</div>
              <div className="empty-text">ワークスペースの設定をここに表示します。</div>
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
                  <FileIcon kind={getFileMeta(name).kind} size={14} />
                  <span>{name}</span>
                  <button
                    className="tab-close"
                    onClick={event => {
                      event.stopPropagation()
                      closeFile(name)
                    }}
                    aria-label={'閉じる ' + name}
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
                  ['terminal', 'ターミナル'],
                  ['output', '出力'],
                  ['problems', '問題']
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
                  {bottomTab === 'output' && (
                    <div className="output-panel">
                      {execution.error && (
                        <pre className="output-raw output-error-raw">{execution.error}</pre>
                      )}

                      {!execution.error && execution.result && (
                        <pre className="output-raw">
                          {(execution.result.stdout || '') +
                            (execution.result.stderr
                              ? (execution.result.stdout ? '\n' : '') + execution.result.stderr
                              : '')}
                        </pre>
                      )}
                    </div>
                  )}
                  {bottomTab === 'problems' && (
                    <div className="problems-panel">
                      {execution.error && (
                        <button
                          className="problem-item problem-item-error"
                          onClick={() => setBottomTab('output')}
                        >
                          <span>×</span>
                          <div>
                            <strong>{execution.error}</strong>
                            <small>実行エラー</small>
                          </div>
                        </button>
                      )}

                      {!execution.error && execution.result?.stderr && (
                        <button
                          className="problem-item problem-item-error"
                          onClick={() => setBottomTab('output')}
                        >
                          <span>!</span>
                          <div>
                            <strong>{execution.result.stderr.split('\n')[0]}</strong>
                            <small>実行出力</small>
                          </div>
                        </button>
                      )}

                      {!execution.error && !execution.result?.stderr && (
                        <div className="panel-empty">問題はありません。</div>
                      )}
                    </div>
                  )}
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
                <span>プレビュー</span>
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
    </>
  )
}


function getRoutePath() {
  const hashPath = window.location.hash.replace(/^#/, '')

  if (
    hashPath === '/dashboard' ||
    hashPath === '/ide' ||
    /^\/ide\/[^/]+$/.test(hashPath)
  ) {
    return hashPath
  }

  return window.location.pathname
}

function navigate(path) {
  if (
    path === '/dashboard' ||
    path === '/ide' ||
    path.startsWith('/ide/')
  ) {
    window.history.pushState({}, '', '/')
    window.location.hash = path
    return
  }

  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppRouter() {
  const [pathname, setPathname] = useState(getRoutePath())
  const [authResolved, setAuthResolved] = useState(false)
  const { data: session, isPending } = authClient.useSession()
  const authPath = pathname === '/signin' || pathname === '/createaccount'
  const publicPath = pathname === '/' || pathname === '/terms'
  const idePath = pathname === '/ide' || pathname.startsWith('/ide/')

  useEffect(() => {
    if (!isPending) {
      setAuthResolved(true)
    }
  }, [isPending])

  useEffect(() => {
    function updatePath() {
      setPathname(getRoutePath())
    }

    window.addEventListener('popstate', updatePath)
    window.addEventListener('hashchange', updatePath)

    return () => {
      window.removeEventListener('popstate', updatePath)
      window.removeEventListener('hashchange', updatePath)
    }
  }, [])

  useEffect(() => {
    if (isPending) return

    if (session?.user && authPath) {
      window.location.replace('/#/dashboard')
      return
    }

    if (!session?.user && !authPath && !publicPath) {
      navigate('/signin')
    }
  }, [authPath, isPending, session])

  if (
    !authResolved &&
    isPending &&
    !authPath &&
    !publicPath
  ) {
    return (
      <div className="app-loading">
        <div className="app-loading-title">Poligo</div>
        <div className="app-loading-text">アカウントを確認中...</div>
      </div>
    )
  }

  if (pathname === '/terms') {
    return <TermsPage />
  }

  if (pathname === '/signin') {
    return <AuthPage mode="signin" />
  }

  if (pathname === '/createaccount') {
    return <AuthPage mode="signup" />
  }

  if (pathname === '/dashboard') {
    return <Dashboard session={session} />
  }

  if (idePath) {
    const projectId = pathname.startsWith('/ide/')
      ? pathname.slice('/ide/'.length)
      : ''

    return <IDE projectId={projectId} />
  }

  return <HomePage session={session} />
}

createRoot(document.getElementById('root')).render(<AppRouter />)
