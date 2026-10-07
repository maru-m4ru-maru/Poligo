import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Editor from '@monaco-editor/react'
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
import AccountPage from './AccountPage'

const DEFAULT_FILES = {
  'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>IDEベンダーに縛られずに開発できます。</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
  'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #10100e;\n  color: #ecece5;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
  'app.js': 'const title = document.querySelector("h1")\n\ntitle.addEventListener("click", () => {\n  title.textContent = "It works."\n})',
  'main.py': 'print("Hello from Python")',
  'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++\\n";\n    return 0;\n  }',
  '.env': '',
  '.env.example': 'APP_ENV=development\nAPI_KEY=',
  '.gitignore': 'node_modules/\n.env\n.env.*\n!.env.example\n__pycache__/\n'
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

function isSecretEnvFile(path) {
  const name = path.split('/').pop() || path
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example')
}

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
  if (name === '.env' || name.startsWith('.env.')) {
    return {
      language: 'plaintext',
      kind: 'env'
    }
  }

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

  if (type === 'ai') {
    return <svg {...common}><path d="M5 6.5h10v7H5z" /><path d="M8 13.5v2M12 13.5v2M8.5 9h.01M11.5 9h.01" /></svg>
  }

  if (type === 'preview') {
    return <svg {...common}><rect x="3.5" y="5" width="13" height="10" rx="1.5" /><path d="M6 8h2M6 11h8M11 8h2" /></svg>
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

function normalizeVirtualPath(path) {
  const parts = path.replace(/\\/g, '/').split('/')
  const result = []

  for (const part of parts) {
    if (!part || part === '.') continue

    if (part === '..') {
      result.pop()
      continue
    }

    result.push(part)
  }

  return result.join('/')
}

function resolveVirtualPath(fromFile, reference) {
  const clean = reference
    .trim()
    .replace(/^['"]|['"]$/g, '')

  if (
    !clean ||
    clean.startsWith('#') ||
    clean.startsWith('data:') ||
    clean.startsWith('blob:') ||
    /^[a-z][a-z0-9+.-]*:/i.test(clean)
  ) {
    return null
  }

  const withoutQuery = clean.split('#')[0].split('?')[0]

  if (withoutQuery.startsWith('/')) {
    return normalizeVirtualPath(withoutQuery.slice(1))
  }

  const directory = fromFile.includes('/')
    ? fromFile.slice(0, fromFile.lastIndexOf('/'))
    : ''

  return normalizeVirtualPath(
    directory
      ? directory + '/' + withoutQuery
      : withoutQuery
  )
}

function fileExtension(path) {
  const clean = path.split('?')[0].split('#')[0]
  const index = clean.lastIndexOf('.')

  return index >= 0
    ? clean.slice(index + 1).toLowerCase()
    : ''
}

function createSvgDataUrl(source) {
  return 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(source)
}

function createTextDataUrl(source, mime) {
  return 'data:' + mime + ';charset=utf-8,' +
    encodeURIComponent(source)
}

function escapeInlineScript(source) {
  return source.replace(/<\/script/gi, '<\\/script')
}

function escapeInlineStyle(source) {
  return source.replace(/<\/style/gi, '<\\/style')
}

function inlineCssReferences(source, filePath, files, seen = new Set()) {
  if (seen.has(filePath)) {
    return source
  }

  const nextSeen = new Set(seen)
  nextSeen.add(filePath)

  let css = source.replace(
    /@import\s+(?:url\(\s*)?["']?([^"'\)\s]+)["']?\s*\)?\s*([^;]*);/gi,
    (match, reference, media) => {
      const resolved = resolveVirtualPath(filePath, reference)
      const imported = resolved ? files[resolved] : null

      if (typeof imported !== 'string' || fileExtension(resolved) !== 'css') {
        return match
      }

      const expanded = inlineCssReferences(
        imported,
        resolved,
        files,
        nextSeen
      )

      const condition = media.trim()

      if (!condition) {
        return expanded
      }

      return '@media ' + condition + '{' + expanded + '}'
    }
  )

  css = css.replace(
    /url\(\s*["']?([^"'\)]+)["']?\s*\)/gi,
    (match, reference) => {
      const resolved = resolveVirtualPath(filePath, reference)
      const asset = resolved ? files[resolved] : null

      if (typeof asset !== 'string') {
        return match
      }

      if (asset.startsWith('data:')) {
        return 'url("' + asset + '")'
      }

      if (fileExtension(resolved) === 'svg') {
        return 'url("' + createSvgDataUrl(asset) + '")'
      }

      return match
    }
  )

  return css
}

function rewriteModuleImports(source, filePath, files, seen = new Set()) {
  if (seen.has(filePath)) {
    return source
  }

  const nextSeen = new Set(seen)
  nextSeen.add(filePath)

  return source.replace(
    /((?:import\s+(?:[^'"]+?\s+from\s+)?|export\s+(?:[^'"]+?\s+from\s+)?|import\s*\(\s*))(["'])([^"']+)(\2)/g,
    (match, prefix, quote, reference) => {
      const resolved = resolveVirtualPath(filePath, reference)
      const module = resolved ? files[resolved] : null

      if (
        typeof module !== 'string' ||
        !['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(fileExtension(resolved))
      ) {
        return match
      }

      const rewritten = rewriteModuleImports(module, resolved, files, nextSeen)
      const dataUrl = createTextDataUrl(rewritten, 'text/javascript')

      return prefix + quote + dataUrl + quote
    }
  )
}

function getPreviewEntryFile(files, requestedFile) {
  if (requestedFile && fileExtension(requestedFile) === 'html' && files[requestedFile]) {
    return requestedFile
  }

  if (files['index.html']) {
    return 'index.html'
  }

  return Object.keys(files).find(name => fileExtension(name) === 'html') || ''
}

function buildPreview(files, requestedFile = 'index.html', depth = 0) {
  const entryFile = getPreviewEntryFile(files, requestedFile)

  if (!entryFile || typeof files[entryFile] !== 'string') {
    return '<!doctype html><html lang="ja"><body style="margin:0;background:#f8fafc;color:#334155"><main style="font-family:system-ui;padding:40px;max-width:680px;margin:0 auto"><div style="font-size:12px;color:#64748b;letter-spacing:.08em">POLIGO PREVIEW</div><h1 style="font-size:24px;margin:12px 0 8px">プレビュー対象がありません</h1><p style="font-size:14px;line-height:1.7;color:#64748b;margin:0">このプロジェクトにはHTMLファイルがないため、ブラウザプレビューを表示できません。サーバー実行言語の結果はターミナルに表示されます。</p></main></body></html>'
  }

  let html = files[entryFile]

  if (!/<!doctype\s+html/i.test(html)) {
    html = '<!doctype html>\n' + html
  }

  if (!/<html[\s>]/i.test(html)) {
    html =
      '<!doctype html><html lang="ja"><head></head><body>' +
      html.replace(/^<!doctype[^>]*>/i, '') +
      '</body></html>'
  }

  if (!/<head[\s>]/i.test(html)) {
    html = html.replace(
      /<html([^>]*)>/i,
      '<html$1><head></head>'
    )
  }

  if (!/<body[\s>]/i.test(html)) {
    html = html.replace(
      /<\/html>/i,
      '<body></body></html>'
    )
  }

  html = html.replace(
    /<link\b[^>]*>/gi,
    tag => {
      const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]

      if (rel === 'stylesheet' && href) {
        const resolved = resolveVirtualPath(entryFile, href)
        const css = resolved ? files[resolved] : null

        if (typeof css === 'string' && fileExtension(resolved) === 'css') {
          return '<style data-poligo-file="' +
            resolved +
            '">' +
            escapeInlineStyle(inlineCssReferences(css, resolved, files)) +
            '</style>'
        }
      }

      if (href && fileExtension(resolveVirtualPath(entryFile, href) || '') === 'svg') {
        const resolved = resolveVirtualPath(entryFile, href)
        const svg = resolved ? files[resolved] : null

        if (typeof svg === 'string') {
          return '<link rel="icon" href="' + createSvgDataUrl(svg) + '">'
        }
      }

      return tag
    }
  )

  if (
    entryFile === 'index.html' &&
    typeof files['style.css'] === 'string' &&
    !html.includes('data-poligo-file="style.css"')
  ) {
    const css = inlineCssReferences(files['style.css'], 'style.css', files)

    html = html.replace(
      /<\/head>/i,
      '<style data-poligo-file="style.css">' +
        escapeInlineStyle(css) +
        '</style></head>'
    )
  }

  html = html.replace(
    /<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/script>/gi,
    (match, before, reference, after) => {
      const resolved = resolveVirtualPath(entryFile, reference)
      const script = resolved ? files[resolved] : null

      if (typeof script !== 'string') {
        return match
      }

      const typeMatch = (before + after).match(/\btype\s*=\s*["']([^"']+)["']/i)
      const type = typeMatch?.[1]?.toLowerCase()

      if (type === 'module') {
        return '<script' +
          before +
          after +
          '>' +
          escapeInlineScript(
            rewriteModuleImports(script, resolved, files)
          ) +
          '</script>'
      }

      return '<script' +
        before +
        after +
        '>' +
        escapeInlineScript(script) +
        '</script>'
    }
  )

  html = html.replace(
    /<(img|source|video|audio|track|image|use)\b([^>]*)>/gi,
    (match, tagName, attributes) => {
      const sourceMatch = attributes.match(/\b(src|href)\s*=\s*["']([^"']+)["']/i)

      if (!sourceMatch) {
        return match
      }

      const resolved = resolveVirtualPath(entryFile, sourceMatch[2])
      const asset = resolved ? files[resolved] : null

      if (typeof asset === 'string' && asset.startsWith('data:')) {
        const replacement = sourceMatch[1] +
          '="' +
          asset +
          '"'

        return '<' +
          tagName +
          attributes.replace(sourceMatch[0], replacement) +
          '>'
      }

      if (
        typeof asset === 'string' &&
        fileExtension(resolved) === 'svg'
      ) {
        const replacement = sourceMatch[1] +
          '="' +
          createSvgDataUrl(asset) +
          '"'

        return '<' +
          tagName +
          attributes.replace(sourceMatch[0], replacement) +
          '>'
      }

      return match
    }
  )

  html = html.replace(
    /<a\b([^>]*)href\s*=\s*["']([^"']+\.html?)["']([^>]*)>/gi,
    (match, before, reference, after) => {
      if (depth >= 2) {
        return match
      }

      const resolved = resolveVirtualPath(entryFile, reference)
      const page = resolved ? files[resolved] : null

      if (typeof page !== 'string' || fileExtension(resolved) !== 'html') {
        return match
      }

      const data = buildPreview(files, resolved, depth + 1)
      const href = createTextDataUrl(data, 'text/html')

      return '<a' +
        before +
        'href="' +
        href +
        '"' +
        after +
        '>'
    }
  )

  if (!/<meta[^>]+charset=/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      '<head$1><meta charset="UTF-8">'
    )
  }

  const runtimeBridge = '<script>' +
    'window.addEventListener("error",function(event){parent.postMessage({source:"poligo-preview",type:"error",message:event.message||"JavaScript error",stack:event.error&&event.error.stack||""},"*")});' +
    'window.addEventListener("unhandledrejection",function(event){var reason=event.reason||{};parent.postMessage({source:"poligo-preview",type:"error",message:reason.message||String(reason),stack:reason.stack||""},"*")});' +
    '</script>'

  html = html.replace(/<head([^>]*)>/i, '<head$1>' + runtimeBridge)

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      '<head$1><meta name="viewport" content="width=device-width, initial-scale=1">'
    )
  }

  return html
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

function isServerLanguage(language) {
  return SERVER_LANGUAGES.has(language)
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
  const [rightPaneView, setRightPaneView] = useState('preview')
  const [bottomTab, setBottomTab] = useState('terminal')
  const [bottomOpen, setBottomOpen] = useState(true)
  const [terminalLines, setTerminalLines] = useState([])
  const [debugOutput, setDebugOutput] = useState({
    status: 'idle',
    file: '',
    language: '',
    stdout: '',
    stderr: '',
    exitCode: null,
    error: ''
  })
  const [preview, setPreview] = useState('')
  const [apiStatus, setApiStatus] = useState('checking')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [quickOpenQuery, setQuickOpenQuery] = useState('')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [editorMarkers, setEditorMarkers] = useState([])
  const [newFileName, setNewFileName] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [execution, setExecution] = useState({
    id: '',
    status: 'idle',
    result: null,
    error: ''
  })
  const [executionStdin, setExecutionStdin] = useState('')
  const [runtimeProblems, setRuntimeProblems] = useState([])
  const [sourceCommits, setSourceCommits] = useState([])
  const [sourceDiff, setSourceDiff] = useState([])
  const [sourceCommitMessage, setSourceCommitMessage] = useState('')
  const [sourceSelectedCommit, setSourceSelectedCommit] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [aiMessages, setAiMessages] = useState([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiMode, setAiMode] = useState('auto')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAutoApply, setAiAutoApply] = useState(() => localStorage.getItem('poligo-ai-auto-apply') === 'true')
  const [dialog, setDialog] = useState(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const terminalRef = useRef(null)
  const terminal = useRef(null)
  const terminalPendingLines = useRef([])
  const terminalInputBuffer = useRef('')
  const terminalModeRef = useRef('')
  const activeFileRef = useRef(activeFile)
  const editorRef = useRef(null)
  const fileUploadRef = useRef(null)
  const filesRef = useRef(files)

  const { data: session } = authClient.useSession()
  const currentLanguage = getFileMeta(activeFile).language
  const currentValue = files[activeFile] ?? ''

  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])
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
      id: 'debug',
      title: 'デバッグ出力を開く',
      hint: 'Python Debug / 実行結果',
      run: () => {
        setBottomTab('debug')
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
      id: 'ai',
      title: 'Poligo AIを開く',
      hint: 'コード支援AI',
      run: () => {
        setRightPaneView('ai')
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
    const serverLanguage = isServerLanguage(getFileMeta(activeFileRef.current).language)
    const prompt = serverLanguage ? 'stdin> ' : '$ '

    setTerminalLines([
      'Poligo ターミナル',
      '通常のシェル操作は「$」、標準入力は「stdin>」から入力できます。',
      prompt
    ])

    terminalModeRef.current = serverLanguage ? 'stdin' : 'shell'
    terminalInputBuffer.current = ''
  }, [])

  const previewDoc = useMemo(
    () => preview || buildPreview(files, activeFile),
    [files, preview, activeFile]
  )

  useEffect(() => {
    const nextMode = isServerLanguage(currentLanguage)
      ? 'stdin'
      : 'shell'

    if (terminalModeRef.current === nextMode) {
      return
    }

    terminalModeRef.current = nextMode
    terminalInputBuffer.current = ''

    setTerminalLines(current => [
      ...current,
      '',
      nextMode === 'stdin' ? 'stdin> ' : '$ '
    ])
  }, [currentLanguage])

  useEffect(() => {
    setEditorMarkers([])
    setRuntimeProblems([])
    setPreview('')
  }, [activeFile])

  useEffect(() => {
    function handlePreviewMessage(event) {
      if (event.data?.source !== 'poligo-preview') {
        return
      }

      const problem = {
        message: event.data.message || 'JavaScriptの実行中にエラーが発生しました。',
        stack: event.data.stack || '',
        type: event.data.type || 'error'
      }

      setRuntimeProblems(current => [
        ...current.slice(-19),
        problem
      ])

      setBottomOpen(true)
      setBottomTab('problems')
    }

    window.addEventListener('message', handlePreviewMessage)

    return () => {
      window.removeEventListener('message', handlePreviewMessage)
    }
  }, [])

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
    setRuntimeProblems([])
    setPreview(buildPreview(files, activeFile))
    setPreviewKey(value => value + 1)
  }

  function openPreviewWindow() {
    const html = buildPreview(files, activeFile)
    const blob = new Blob([html], {
      type: 'text/html;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const popup = window.open(url, '_blank', 'noopener,noreferrer')

    if (!popup) {
      URL.revokeObjectURL(url)
      return
    }

    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 60_000)
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

  function createFile() {
    setNewFileName('')
    setNewFileOpen(true)
  }

  function openFileUpload() {
    fileUploadRef.current?.click()
  }

  async function handleFileUpload(event) {
    const uploaded = Array.from(event.target.files || [])

    event.target.value = ''

    for (const file of uploaded) {
      const path = file.name.replace(/\\/g, '/').replace(/^\/+/, '')

      if (
        !path ||
        path.split('/').some(part => !part || part === '.' || part === '..')
      ) {
        continue
      }

      const extension = fileExtension(path)
      const textExtensions = new Set([
        'html',
        'htm',
        'css',
        'js',
        'mjs',
        'jsx',
        'ts',
        'tsx',
        'json',
        'md',
        'txt',
        'svg',
        'xml'
      ])

      let value

      if (textExtensions.has(extension) || file.type.startsWith('text/')) {
        value = await file.text()
      } else {
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''

        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + 8192)
          )
        }

        value =
          'data:' +
          (file.type || 'application/octet-stream') +
          ';base64,' +
          btoa(binary)
      }

      setFiles(current => ({
        ...current,
        [path]: value
      }))
      setActiveFile(path)
      setOpenFiles(current =>
        current.includes(path)
          ? current
          : [...current, path]
      )
    }

    if (uploaded.length) {
      setSaveStatus('saving')
    }
  }

  function cancelCreateFile() {
    setNewFileOpen(false)
    setNewFileName('')
  }

  function commitCreateFile() {
    const normalized = newFileName.trim()

    const safeName = normalized
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')

    if (
      !safeName ||
      safeName.split('/').some(part => !part || part === '.' || part === '..')
    ) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(files, safeName)) {
      setActiveFile(safeName)
      setOpenFiles(current =>
        current.includes(safeName)
          ? current
          : [...current, safeName]
      )
      cancelCreateFile()
      return
    }

    setFiles(current => ({
      ...current,
      [safeName]: ''
    }))
    setActiveFile(safeName)
    setOpenFiles(current => [...current, safeName])
    setSaveStatus('saving')
    cancelCreateFile()
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

  function applyAiEdits(edits) {
    if (!Array.isArray(edits) || !edits.length) {
      return {
        ok: true,
        changedFiles: []
      }
    }

    const next = { ...filesRef.current }
    const changedFiles = []

    try {
      for (const edit of edits) {
        const path = typeof edit?.path === 'string' ? edit.path.trim() : ''

        if (isSecretEnvFile(path)) {
          throw new Error('環境変数ファイルはPoligo AIから直接変更できません。')
        }

        const oldText = typeof edit?.oldText === 'string' ? edit.oldText : null
        const newText = typeof edit?.newText === 'string' ? edit.newText : null

        if (!path || oldText === null || newText === null) {
          throw new Error('AIが無効な変更情報を返しました。')
        }

        const exists = Object.prototype.hasOwnProperty.call(next, path)

        if (!exists && oldText !== '') {
          throw new Error(path + ' が見つからないため変更を適用できません。')
        }

        if (!exists && oldText === '') {
          next[path] = newText
          changedFiles.push(path)
          continue
        }

        const current = next[path]
        const firstIndex = current.indexOf(oldText)
        const lastIndex = current.lastIndexOf(oldText)

        if (firstIndex < 0) {
          throw new Error(path + ' の対象コードが現在の内容と一致しません。')
        }

        if (firstIndex !== lastIndex) {
          throw new Error(path + ' の対象コードが複数箇所にあるため、安全のため適用を停止しました。')
        }

        next[path] =
          current.slice(0, firstIndex) +
          newText +
          current.slice(firstIndex + oldText.length)
        changedFiles.push(path)
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'AIの変更を適用できませんでした。'
      }
    }

    filesRef.current = next
    setFiles(next)

    const firstChangedFile = changedFiles[0]

    if (firstChangedFile && !openFiles.includes(firstChangedFile)) {
      setOpenFiles(current => current.includes(firstChangedFile)
        ? current
        : [...current, firstChangedFile]
      )
    }

    if (firstChangedFile) {
      setActiveFile(firstChangedFile)
    }

    setPreview('')
    setPreviewKey(value => value + 1)

    return {
      ok: true,
      changedFiles: [...new Set(changedFiles)]
    }
  }

  function applyAiMessage(index, automatic = false) {
    const message = aiMessages[index]

    if (!message?.edits?.length || message.applied) {
      return
    }

    if (automatic) {
      localStorage.setItem('poligo-ai-auto-apply', 'true')
      setAiAutoApply(true)
    }

    const result = applyAiEdits(message.edits)

    setAiMessages(current => current.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...item,
            applied: result.ok,
            applyError: result.ok ? '' : result.error
          }
        : item
    )))
  }

  async function submitAiRequest() {
    const prompt = aiPrompt.trim()

    if (!prompt || aiBusy) {
      return
    }

    const selection = editorRef.current?.getSelection()
    const rawSelectedText = selection
      ? editorRef.current?.getModel()?.getValueInRange(selection) || ''
      : ''
    const selectedText = isSecretEnvFile(activeFile)
      ? ''
      : rawSelectedText
    const contextFiles = {}
    let contextBytes = 0

    for (const [path, content] of Object.entries(filesRef.current)) {
      if (isSecretEnvFile(path)) {
        continue
      }

      if (path !== activeFile && contextBytes > 90_000) {
        break
      }

      const limitedContent = content.slice(0, path === activeFile ? 60_000 : 12_000)
      contextFiles[path] = limitedContent
      contextBytes += limitedContent.length
    }

    setAiMessages(current => [
      ...current,
      {
        role: 'user',
        text: prompt
      }
    ])
    setAiPrompt('')
    setAiBusy(true)
    setBottomOpen(true)
    setRightPaneView('ai')

    try {
      const result = await request('/api/ai/assist', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          mode: aiMode,
          action: 'assist',
          projectName,
          currentFile: activeFile,
          language: currentLanguage,
          selectedText: selectedText.slice(0, 20_000),
          files: contextFiles
        })
      })

      const messageIndex = aiMessages.length + 1
      const responseMessage = {
        role: 'assistant',
        text: result.reply || 'AIから応答がありませんでした。',
        edits: Array.isArray(result.edits) ? result.edits : [],
        model: result.model || '',
        applied: false,
        applyError: ''
      }

      setAiMessages(current => [...current, responseMessage])

      if (aiAutoApply && responseMessage.edits.length) {
        const applied = applyAiEdits(responseMessage.edits)

        setAiMessages(current => current.map((item, index) => (
          index === messageIndex
            ? {
                ...item,
                applied: applied.ok,
                applyError: applied.ok ? '' : applied.error
              }
            : item
        )))
      }
    } catch (error) {
      setAiMessages(current => [
        ...current,
        {
          role: 'assistant',
          text: error instanceof Error ? error.message : 'AIリクエストに失敗しました。',
          edits: [],
          model: '',
          applied: false,
          applyError: ''
        }
      ])
    } finally {
      setAiBusy(false)
    }
  }

  function writeTerminalLines(text) {
    const lines = String(text || '').split('\n')

    setTerminalLines(current => [
      ...current,
      ...lines
    ])
  }

  function replaceTerminalInput(prompt, input) {
    setTerminalLines(current => {
      const next = [...current]

      if (!next.length) {
        return [prompt + input]
      }

      next[next.length - 1] = prompt + input
      return next
    })
  }

  function appendTerminalPrompt(prompt) {
    setTerminalLines(current => [
      ...current,
      prompt
    ])
  }

  function clearTerminal() {
    setTerminalLines([])
  }

  function handleTerminalKeyDown(event) {
    const serverLanguage = isServerLanguage(currentLanguage)
    const prompt = serverLanguage ? 'stdin> ' : '$ '

    if (event.key === 'Enter') {
      event.preventDefault()

      const inputLine = terminalInputBuffer.current

      replaceTerminalInput(prompt, inputLine)
      terminalInputBuffer.current = ''

      if (serverLanguage) {
        setExecutionStdin(current => (
          current ? current + '\n' + inputLine : inputLine
        ))
        appendTerminalPrompt(prompt)
        return
      }

      if (inputLine === 'clear') {
        clearTerminal()
        appendTerminalPrompt('$ ')
        return
      }

      if (inputLine === 'help') {
        writeTerminalLines('commands: help, clear, run, files, ls, pwd, cat <file>, open <file>, health')
      } else if (inputLine === 'files' || inputLine === 'ls') {
        writeTerminalLines(Object.keys(filesRef.current).join('\n'))
      } else if (inputLine === 'pwd') {
        writeTerminalLines('/workspace')
      } else if (inputLine.startsWith('cat ')) {
        const target = inputLine.slice(4).trim()

        if (Object.prototype.hasOwnProperty.call(filesRef.current, target)) {
          writeTerminalLines(filesRef.current[target])
        } else {
          writeTerminalLines('cat: ' + target + ': No such file')
        }
      } else if (inputLine.startsWith('open ')) {
        const target = inputLine.slice(5).trim()

        if (Object.prototype.hasOwnProperty.call(filesRef.current, target)) {
          openFile(target)
        } else {
          writeTerminalLines('open: ' + target + ': No such file')
        }
      } else if (inputLine === 'health') {
        request('/api/health')
          .then(result => writeTerminalLines(JSON.stringify(result)))
          .catch(error => writeTerminalLines(error.message))
      } else if (inputLine === 'run') {
        void runProject()
        return
      } else if (inputLine) {
        writeTerminalLines(inputLine + ': command not found')
      }

      appendTerminalPrompt('$ ')
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()

      if (!terminalInputBuffer.current) {
        return
      }

      terminalInputBuffer.current =
        terminalInputBuffer.current.slice(0, -1)

      replaceTerminalInput(prompt, terminalInputBuffer.current)
      return
    }

    if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      terminalInputBuffer.current = ''
      appendTerminalPrompt(serverLanguage ? 'stdin> ^C' : '$ ^C')
      return
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      terminalInputBuffer.current += event.key
      replaceTerminalInput(prompt, terminalInputBuffer.current)
    }
  }

  async function runProject() {
    const serverExecution = SERVER_LANGUAGES.has(currentLanguage)

    setBottomOpen(true)
    setBottomTab(serverExecution ? 'debug' : 'terminal')

    setExecution({
      id: '',
      status: serverExecution ? 'queued' : 'succeeded',
      result: serverExecution
        ? null
        : {
            stdout: 'ブラウザプレビューを更新しました。',
            stderr: '',
            exitCode: 0
          },
      error: ''
    })

    if (!serverExecution) {
      refreshPreview()
      writeTerminalLines('ブラウザプレビューを更新しました。')
      return
    }

    setDebugOutput({
      status: 'queued',
      file: activeFile,
      language: currentLanguage,
      stdout: '',
      stderr: '',
      exitCode: null,
      error: ''
    })

    try {
      const result = await request('/api/executions', {
        method: 'POST',
        body: JSON.stringify({
          projectId: currentProjectId,
          language: currentLanguage,
          entrypoint: activeFile,
          stdin: executionStdin,
          files
        })
      })

      setExecution({
        id: result.id,
        status: result.status || 'queued',
        result: null,
        error: ''
      })

      setDebugOutput(current => ({
        ...current,
        status: result.status || 'queued'
      }))

      setExecutionStdin('')
      terminalInputBuffer.current = ''

      for (let attempt = 0; attempt < 120; attempt += 1) {
        const status = await request(
          '/api/executions/' + encodeURIComponent(result.id)
        )

        if (
          status.status === 'succeeded' ||
          status.status === 'failed' ||
          status.status === 'timeout'
        ) {
          const nextResult = status.result || {
            stdout: '',
            stderr: '',
            exitCode: null
          }

          setExecution({
            id: result.id,
            status: status.status,
            result: nextResult,
            error: ''
          })

          setDebugOutput({
            status: status.status,
            file: activeFile,
            language: currentLanguage,
            stdout: nextResult.stdout || '',
            stderr: nextResult.stderr || '',
            exitCode: nextResult.exitCode ?? null,
            error: ''
          })

          return
        }

        setExecution(current => ({
          ...current,
          status: status.status === 'running' ? 'running' : 'queued'
        }))

        setDebugOutput(current => ({
          ...current,
          status: status.status === 'running' ? 'running' : 'queued'
        }))

        await new Promise(resolve => {
          window.setTimeout(resolve, attempt < 8 ? 150 : 300)
        })
      }

      const timeoutResult = {
        stdout: '',
        stderr: 'Execution polling timed out.',
        exitCode: null
      }

      setExecution(current => ({
        ...current,
        status: 'timeout',
        result: timeoutResult
      }))

      setDebugOutput({
        status: 'timeout',
        file: activeFile,
        language: currentLanguage,
        stdout: '',
        stderr: timeoutResult.stderr,
        exitCode: null,
        error: ''
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed'

      setExecution({
        id: '',
        status: 'failed',
        result: null,
        error: message
      })

      setDebugOutput({
        status: 'failed',
        file: activeFile,
        language: currentLanguage,
        stdout: '',
        stderr: '',
        exitCode: null,
        error: message
      })
    }
  }

  function resetProject() {
    setExecutionStdin('')
    terminalInputBuffer.current = ''
    setTerminalLines([])
    setDebugOutput({
      status: 'idle',
      file: '',
      language: '',
      stdout: '',
      stderr: '',
      exitCode: null,
      error: ''
    })
    setFiles(DEFAULT_FILES)
    setOpenFiles(['index.html'])
    setActiveFile('index.html')
    setPreview('')
    setPreviewKey(value => value + 1)
  }

  function renderAiPanel() {
    return (
      <div className="ai-panel">
                      <div className="ai-panel-head">
                        <div>
                          <strong>Poligo AI</strong>
                          <span>OpenRouter</span>
                        </div>
                        <div className="ai-model-picker" role="group" aria-label="AIモデル">
                          {[
                            ['auto', '自動'],
                            ['fast', '速度重視'],
                            ['code', '賢さ重視'],
                            ['reasoning', '推論重視']
                          ].map(([id, label]) => (
                            <button
                              key={id}
                              type="button"
                              className={aiMode === id ? 'active' : ''}
                              onClick={() => setAiMode(id)}
                              disabled={aiBusy}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="ai-message-list">
                        {!aiMessages.length && (
                          <div className="ai-empty">
                            <strong>コードについて相談できます。</strong>
                            <span>現在のファイル、選択範囲、プロジェクト内のファイルをAIに渡せます。環境変数ファイルは除外されます。</span>
                          </div>
                        )}

                        {aiMessages.map((message, index) => (
                          <div key={index} className={'ai-message ai-message-' + message.role}>
                            <div className="ai-message-role">
                              {message.role === 'user' ? 'あなた' : 'Poligo AI'}
                              {message.model && <span>{message.model}</span>}
                            </div>
                            <div className="ai-message-text">{message.text}</div>

                            {message.edits?.length > 0 && (
                              <div className="ai-edit-card">
                                <div className="ai-edit-title">コード変更 {message.edits.length}件</div>
                                <div className="ai-edit-files">
                                  {[...new Set(message.edits.map(edit => edit.path))].map(path => (
                                    <span key={path}>{path}</span>
                                  ))}
                                </div>
                                {message.applyError && (
                                  <div className="ai-apply-error">{message.applyError}</div>
                                )}
                                {!message.applied ? (
                                  <div className="ai-edit-actions">
                                    <button
                                      type="button"
                                      onClick={() => applyAiMessage(index, false)}
                                    >
                                      1度だけ適用
                                    </button>
                                    <button
                                      type="button"
                                      className="primary"
                                      onClick={() => applyAiMessage(index, true)}
                                    >
                                      毎回確認せず適用
                                    </button>
                                  </div>
                                ) : (
                                  <div className="ai-applied">適用済み</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {aiBusy && (
                          <div className="ai-message ai-message-assistant">
                            <div className="ai-message-role">Poligo AI</div>
                            <div className="ai-thinking">考えています...</div>
                          </div>
                        )}
                      </div>

                      <form
                        className="ai-input-area"
                        onSubmit={event => {
                          event.preventDefault()
                          void submitAiRequest()
                        }}
                      >
                        <textarea
                          value={aiPrompt}
                          onChange={event => setAiPrompt(event.target.value)}
                          placeholder="コードの質問、バグ修正、リファクタリング、機能追加など..."
                          rows={3}
                          disabled={aiBusy}
                        />
                        <div className="ai-input-footer">
                          <div className="ai-input-status">
                            <span>
                              {aiAutoApply ? '自動適用: ON' : '変更は確認後に適用'}
                            </span>
                            {aiAutoApply && (
                              <button
                                type="button"
                                className="ai-auto-disable"
                                onClick={() => {
                                  localStorage.removeItem('poligo-ai-auto-apply')
                                  setAiAutoApply(false)
                                }}
                              >
                                解除
                              </button>
                            )}
                          </div>
                          <button type="submit" disabled={aiBusy || !aiPrompt.trim()}>
                            {aiBusy ? '処理中...' : '送信'}
                          </button>
                        </div>
                      </form>
                    </div>
    )
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
            <button
              className={'activity-button ' + (rightPaneView === 'ai' ? 'active' : '')}
              onClick={() => setRightPaneView('ai')}
              title="AI"
            >
              <ActivityIcon type="ai" />
            </button>
            <button
              className={'activity-button ' + (rightPaneView === 'preview' ? 'active' : '')}
              onClick={() => setRightPaneView('preview')}
              title="プレビュー"
            >
              <ActivityIcon type="preview" />
            </button>
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
                <button className="more-button" onClick={openFileUpload} title="ファイルをアップロード">↑</button>
                <button className="more-button" onClick={() => void deleteFile()} title="ファイルを削除">−</button>
                <input
                  ref={fileUploadRef}
                  type="file"
                  multiple
                  hidden
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>

          {activeView === 'files' && (
            <>
              <div className="project-folder"><span>⌄</span><span>POLIGO</span></div>
              <div className="file-list">
                {newFileOpen && (
                  <div className="explorer-new-file">
                    <FileIcon kind={getFileMeta(newFileName || 'file.txt').kind} size={14} />
                    <input
                      autoFocus
                      value={newFileName}
                      onChange={event => setNewFileName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitCreateFile()
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelCreateFile()
                        }
                      }}
                      onBlur={() => {
                        if (!newFileName.trim()) {
                          cancelCreateFile()
                        }
                      }}
                      placeholder="ファイル名"
                      aria-label="新しいファイル名"
                    />
                  </div>
                )}

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

            {isSecretEnvFile(activeFile) && (
              <div className="env-notice">
                <strong>環境変数ファイル</strong>
                <span>保存時は暗号化され、Poligo AIには送信されません。</span>
              </div>
            )}

            <div className="editor-pane">
              <Editor
                height="100%"
                language={currentLanguage}
                value={currentValue}
                onChange={updateFile}
                onValidate={markers => setEditorMarkers(markers)}
                onMount={editor => {
                  editorRef.current = editor
                }}
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
                  ...(SERVER_LANGUAGES.has(currentLanguage)
                    ? [['debug', currentLanguage === 'python' ? 'Python Debug' : 'Debug']]
                    : []),
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
                <button
                  className="bottom-collapse"
                  onClick={() => setBottomOpen(value => !value)}
                >
                  {bottomOpen ? '⌄' : '⌃'}
                </button>
              </div>

              <div className="bottom-content">
                <div
                  className={
                    'terminal-panel ' +
                    (bottomTab === 'terminal' ? '' : 'panel-hidden')
                  }
                >
                  <div
                    className="terminal"
                    ref={terminalRef}
                    tabIndex={0}
                    onClick={() => terminalRef.current?.focus()}
                    onKeyDown={handleTerminalKeyDown}
                  >
                    {terminalLines.map((line, index) => (
                      <div key={index} className="terminal-line">
                        {line || '\u00a0'}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={
                    'debug-panel ' +
                    (bottomTab === 'debug' ? '' : 'panel-hidden')
                  }
                >
                  <div className="debug-toolbar">
                    <span className="debug-title">
                      {currentLanguage === 'python' ? 'Python Debug' : 'Debug'}
                    </span>
                    <span className={'debug-status debug-status-' + debugOutput.status}>
                      {debugOutput.status === 'running' && '実行中'}
                      {debugOutput.status === 'queued' && '待機中'}
                      {debugOutput.status === 'succeeded' && '成功'}
                      {debugOutput.status === 'failed' && '失敗'}
                      {debugOutput.status === 'timeout' && 'タイムアウト'}
                      {debugOutput.status === 'idle' && '待機'}
                    </span>
                    {debugOutput.file && (
                      <span className="debug-file">{debugOutput.file}</span>
                    )}
                    {debugOutput.exitCode !== null && (
                      <span className="debug-exit">
                        exit {debugOutput.exitCode}
                      </span>
                    )}
                  </div>

                  {!debugOutput.stdout &&
                    !debugOutput.stderr &&
                    !debugOutput.error &&
                    ['idle', 'queued', 'running'].includes(debugOutput.status) && (
                      <div className="debug-empty">
                        {debugOutput.status === 'idle'
                          ? '実行すると、ここにプログラムの出力が表示されます。'
                          : '実行結果を待っています...'}
                      </div>
                    )}

                  {debugOutput.error && (
                    <section className="debug-block debug-block-error">
                      <div className="debug-block-title">Execution Error</div>
                      <pre>{debugOutput.error}</pre>
                    </section>
                  )}

                  {debugOutput.stdout && (
                    <section className="debug-block">
                      <div className="debug-block-title">stdout</div>
                      <pre>{debugOutput.stdout}</pre>
                    </section>
                  )}

                  {debugOutput.stderr && (
                    <section className="debug-block debug-block-stderr">
                      <div className="debug-block-title">stderr</div>
                      <pre>{debugOutput.stderr}</pre>
                    </section>
                  )}

                  {debugOutput.status === 'succeeded' &&
                    !debugOutput.stdout &&
                    !debugOutput.stderr &&
                    !debugOutput.error && (
                      <div className="debug-empty">出力はありません。</div>
                    )}
                </div>

                <div
                  className={
                    'problems-panel ' +
                    (bottomTab === 'problems' ? '' : 'panel-hidden')
                  }
                >
                  {editorMarkers.map((marker, index) => (
                    <button
                      key={'editor-' + index}
                      className="problem-item problem-item-error"
                      onClick={() => {
                        editorRef.current?.revealLineInCenter(marker.startLineNumber)
                        editorRef.current?.setPosition({
                          lineNumber: marker.startLineNumber,
                          column: marker.startColumn || 1
                        })
                        editorRef.current?.focus()
                      }}
                    >
                      <span>{marker.severity === 8 ? '!' : '×'}</span>
                      <div>
                        <strong>{marker.message}</strong>
                        <small>
                          {currentLanguage.toUpperCase()} / 行 {marker.startLineNumber}:{marker.startColumn || 1}
                        </small>
                      </div>
                    </button>
                  ))}

                  {runtimeProblems.map((problem, index) => (
                    <button
                      key={'runtime-' + index}
                      className="problem-item problem-item-error"
                      onClick={() => setBottomTab('terminal')}
                    >
                      <span>×</span>
                      <div>
                        <strong>{problem.message}</strong>
                        <small>プレビュー実行時エラー</small>
                      </div>
                    </button>
                  ))}

                  {execution.error && (
                    <button
                      className="problem-item problem-item-error"
                      onClick={() => setBottomTab('terminal')}
                    >
                      <span>×</span>
                      <div>
                        <strong>{execution.error}</strong>
                        <small>実行エラー</small>
                      </div>
                    </button>
                  )}

                  {!editorMarkers.length &&
                    !execution.error &&
                    execution.result?.stderr && (
                      <button
                        className="problem-item problem-item-error"
                        onClick={() => setBottomTab('terminal')}
                      >
                        <span>!</span>
                        <div>
                          <strong>{execution.result.stderr.split('\n')[0]}</strong>
                          <small>実行出力</small>
                        </div>
                      </button>
                    )}

                  {!editorMarkers.length &&
                    !execution.error &&
                    !execution.result?.stderr && (
                      <div className="panel-empty">問題はありません。</div>
                    )}
                </div>
              </div>
            </div>
          </section>

          <section className={'preview-section ' + (rightPaneView === 'ai' ? 'ai-mode' : '')}>
            {rightPaneView === 'ai' ? (
              renderAiPanel()
            ) : (
              <>
                <div className="preview-toolbar">
                  <button className="preview-control">‹</button>
                  <button className="preview-control">›</button>
                  <button className="preview-control" onClick={refreshPreview}>↻</button>
                  <div className="preview-address">
                    <span>○</span>
                    <span>プレビュー</span>
                  </div>
                  <button
                    className="preview-control"
                    onClick={openPreviewWindow}
                    title="新しいタブで開く"
                  >
                    ↗
                  </button>
                </div>
                <iframe
                  key={previewKey}
                  title="Poligo preview"
                  srcDoc={previewDoc}
                  sandbox="allow-scripts allow-forms allow-modals allow-downloads"
                />
              </>
            )}
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
    hashPath === '/account' ||
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
    path === '/account' ||
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
  const accountPath = pathname === '/account'
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

  if (accountPath) {
    return <AccountPage session={session} />
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
