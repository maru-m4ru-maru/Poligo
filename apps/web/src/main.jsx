import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Editor from '@monaco-editor/react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

const DEFAULT_FILES = {
  'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>Build without an IDE vendor lock-in.</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
  'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #10131a;\n  color: #f3f5f7;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
  'app.js': 'const title = document.querySelector("h1")\n\ntitle.addEventListener("click", () => {\n  title.textContent = "It works."\n})',
  'main.py': 'print("Hello from Python")',
  'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++\\n";\n    return 0;\n}'
}

const FILE_META = {
  'index.html': { language: 'html', icon: 'HTML' },
  'style.css': { language: 'css', icon: 'CSS' },
  'app.js': { language: 'javascript', icon: 'JS' },
  'main.py': { language: 'python', icon: 'PY' },
  'main.cpp': { language: 'cpp', icon: 'C++' }
}

const API_URL = import.meta.env.VITE_API_URL || ''

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

function setupEditor(monaco) {
  monaco.editor.defineTheme('poligo-neutral', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#11110f',
      'editor.foreground': '#e1e1dc',
      'editorLineNumber.foreground': '#64645f',
      'editorLineNumber.activeForeground': '#a7a7a0',
      'editorCursor.foreground': '#eeeeea',
      'editor.selectionBackground': '#383834',
      'editor.inactiveSelectionBackground': '#292925',
      'editor.lineHighlightBackground': '#181815',
      'editorIndentGuide.background1': '#20201c',
      'editorIndentGuide.activeBackground1': '#30302b',
      'editorWidget.background': '#181814',
      'editorWidget.border': '#33332d',
      'editorSuggestWidget.background': '#181814',
      'editorSuggestWidget.border': '#33332d',
      'editorSuggestWidget.selectedBackground': '#2b2b26',
      'editorHoverWidget.background': '#181814',
      'editorHoverWidget.border': '#33332d',
      'scrollbarSlider.background': '#3a3a35',
      'scrollbarSlider.hoverBackground': '#4a4a43',
      'scrollbarSlider.activeBackground': '#55554e'
    }
  })
}

function App() {
  const [files, setFiles] = useState(loadFiles)
  const [activeFile, setActiveFile] = useState('index.html')
  const [preview, setPreview] = useState('')
  const [bottomOpen, setBottomOpen] = useState(true)
  const [apiStatus, setApiStatus] = useState('checking')
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
      fontSize: 13,
      theme: {
        background: '#0a0c10',
        foreground: '#dce3ea',
        cursor: '#f4f6f8'
      }
    })

    const addon = new FitAddon()
    instance.loadAddon(addon)
    instance.open(terminalRef.current)
    addon.fit()
    instance.writeln('Poligo terminal')
    instance.writeln('Browser commands are local. Server execution is connected through the API.')
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
          instance.writeln('Browser preview updated.')
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

    const resize = () => addon.fit()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      instance.dispose()
    }
  }, [])

  const previewDoc = useMemo(() => preview || buildPreview(files), [files, preview])

  function updateFile(value) {
    setFiles(previous => ({
      ...previous,
      [activeFile]: value ?? ''
    }))
  }

  async function runProject() {
    setPreview(buildPreview(files))
    setBottomOpen(true)

    try {
      const result = await request('/api/executions', {
        method: 'POST',
        body: JSON.stringify({
          language: FILE_META[activeFile]?.language || 'plaintext',
          files
        })
      })

      terminal.current?.writeln('')
      terminal.current?.writeln('Execution request accepted: ' + result.id)
    } catch (error) {
      terminal.current?.writeln('')
      terminal.current?.writeln('API error: ' + error.message)
    }

    terminal.current?.write('$ ')
  }

  function resetProject() {
    setFiles(DEFAULT_FILES)
    setActiveFile('index.html')
    setPreview('')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">POLIGO</div>
        <div className="project-name">Untitled Project</div>
        <div className="status">
          <span className={'status-dot ' + apiStatus} />
          API {apiStatus}
        </div>
        <div className="top-actions">
          <button onClick={resetProject}>Reset</button>
          <button className="run" onClick={runProject}>Run</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-title">EXPLORER</div>
          <div className="folder">⌄ project</div>

          {Object.keys(files).map(name => (
            <button
              key={name}
              className={'file-row ' + (activeFile === name ? 'active' : '')}
              onClick={() => setActiveFile(name)}
            >
              <span className="file-icon">{FILE_META[name]?.icon || 'TXT'}</span>
              <span>{name}</span>
            </button>
          ))}
        </aside>

        <section className="editor-area">
          <div className="tabs">
            <div className="tab active">
              <span className="file-icon">{FILE_META[activeFile]?.icon || 'TXT'}</span>
              {activeFile}
            </div>
          </div>

          <div className="editor-pane">
            <Editor
              height="100%"
              language={currentLanguage}
              beforeMount={setupEditor}
              value={currentValue}
              onChange={updateFile}
              theme="poligo-neutral"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 14, bottom: 14 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                smoothScrolling: true
              }}
            />
          </div>

          <div className={'bottom-panel ' + (bottomOpen ? 'open' : '')}>
            <div className="panel-tabs">
              <button className="panel-tab active">TERMINAL</button>
              <button className="panel-tab">OUTPUT</button>
              <button className="panel-tab">PROBLEMS</button>
              <button
                className="panel-toggle"
                onClick={() => setBottomOpen(value => !value)}
              >
                {bottomOpen ? '⌄' : '⌃'}
              </button>
            </div>
            <div className="terminal" ref={terminalRef} />
          </div>
        </section>

        <section className="preview-area">
          <div className="preview-header">
            <span>PREVIEW</span>
            <button onClick={runProject}>Refresh</button>
          </div>
          <iframe
            title="Poligo preview"
            srcDoc={previewDoc}
            sandbox="allow-scripts"
          />
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
