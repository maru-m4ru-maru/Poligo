import { useMemo, useState } from 'react'

const DEFAULT_FILES = {
  'index.html': '<main class="app">\n  <h1>Hello, Poligo.</h1>\n  <p>これはDemoです。</p>\n  <button id="button">クリック</button>\n</main>',
  'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #f4f7fb;\n  font-family: system-ui, sans-serif;\n}\n\n.app {\n  width: min(520px, calc(100% - 48px));\n  padding: 32px;\n  border: 1px solid #dbe3ef;\n  border-radius: 16px;\n  background: white;\n  box-shadow: 0 18px 50px rgba(15, 23, 42, .08);\n}\n\nbutton {\n  padding: 10px 14px;\n  border: 0;\n  border-radius: 8px;\n  background: #2563eb;\n  color: white;\n  cursor: pointer;\n}',
  'app.js': 'const button = document.querySelector("#button")\n\nbutton.addEventListener("click", () => {\n  button.textContent = "動きました！"\n})'
}

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function buildPreview(files) {
  const html = files['index.html'] || ''
  const css = files['style.css'] || ''
  const js = files['app.js'] || ''

  return '<!doctype html>\n' +
    '<html lang="ja">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<style>' + css + '</style>\n' +
    '</head>\n' +
    '<body>' +
    html +
    '<script>' + js + '</script>\n' +
    '</body>\n' +
    '</html>'
}

export default function DemoPage() {
  const [files, setFiles] = useState(DEFAULT_FILES)
  const [activeFile, setActiveFile] = useState('index.html')
  const [previewKey, setPreviewKey] = useState(0)

  const preview = useMemo(() => buildPreview(files), [files])

  function updateFile(value) {
    setFiles(current => ({
      ...current,
      [activeFile]: value
    }))
    setPreviewKey(value => value + 1)
  }

  return (
    <div className="demo-page">
      <header className="demo-nav">
        <button className="demo-brand" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>

        <div className="demo-nav-actions">
          <span className="demo-badge">DEMO</span>
          <button onClick={() => navigate('/')}>ホームへ戻る</button>
          <button className="demo-primary" onClick={() => navigate('/createaccount')}>
            アカウントを作成
          </button>
        </div>
      </header>

      <main className="demo-main">
        <div className="demo-notice">
          <div>
            <strong>Poligo Demo</strong>
            <span>アカウントなしで試せます。ここでの編集内容はクラウドに保存されません。</span>
          </div>
          <span>保存なし · 公開なし · アカウント不要</span>
        </div>

        <section className="demo-workspace">
          <aside className="demo-sidebar">
            <div className="demo-sidebar-title">ファイル</div>

            {Object.keys(files).map(name => (
              <button
                key={name}
                className={activeFile === name ? 'active' : ''}
                onClick={() => setActiveFile(name)}
              >
                {name}
              </button>
            ))}

            <div className="demo-sidebar-note">
              <strong>Demo制限</strong>
              <span>このページではクラウド保存、共有、公開機能を利用できません。</span>
            </div>
          </aside>

          <section className="demo-editor-panel">
            <div className="demo-panel-header">
              <div>
                <span className="demo-eyebrow">ローカルDemo</span>
                <strong>{activeFile}</strong>
              </div>
              <span className="demo-local-status">ブラウザ内のみ</span>
            </div>

            <textarea
              className="demo-editor"
              value={files[activeFile]}
              onChange={event => updateFile(event.target.value)}
              spellCheck="false"
            />
          </section>

          <section className="demo-preview-panel">
            <div className="demo-panel-header">
              <div>
                <span className="demo-eyebrow">ライブプレビュー</span>
                <strong>preview</strong>
              </div>
              <button
                className="demo-refresh"
                onClick={() => setPreviewKey(value => value + 1)}
              >
                更新
              </button>
            </div>

            <iframe
              key={previewKey}
              title="Poligo Demo preview"
              srcDoc={preview}
              sandbox="allow-scripts"
            />
          </section>
        </section>
      </main>
    </div>
  )
}
