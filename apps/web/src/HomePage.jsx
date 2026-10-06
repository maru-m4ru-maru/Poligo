import { authClient } from './auth-client'

function navigate(path) {
  if (path === '/dashboard' || path === '/ide') {
    window.history.pushState({}, '', '/')
    window.location.hash = path
    return
  }

  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const LANGUAGES = [
  { name: 'HTML', icon: '/icons/html5.svg' },
  { name: 'CSS', icon: '/icons/css.svg' },
  { name: 'JavaScript', icon: '/icons/javascript.svg' },
  { name: 'Python', icon: '/icons/python.svg' },
  { name: 'C', icon: '/icons/c.svg' },
  { name: 'C++', icon: '/icons/cplusplus.svg' },
  { name: 'Java', icon: '/icons/java.svg' },
  { name: 'Go', icon: '/icons/go.svg' },
  { name: 'Rust', icon: '/icons/rust.svg' },
  { name: 'PHP', icon: '/icons/php.svg' },
  { name: 'Ruby', icon: '/icons/ruby.svg' },
  { name: 'Kotlin', icon: '/icons/kotlin.svg' },
  { name: 'C#', icon: '/icons/csharp.svg' }
]

export default function HomePage({ session }) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <button className="home-brand" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>

        <div className="home-nav-actions">
          <button onClick={() => navigate('/terms')}>
            利用規約
          </button>
          <a href="https://poligo1.statuspage.io/" target="_blank" rel="noreferrer">
            ステータス
          </a>
          {session?.user ? (
            <>
              <button onClick={() => navigate('/dashboard')}>ダッシュボード</button>
              <button className="home-nav-primary" onClick={() => navigate('/ide')}>
                IDEを開く
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/signin')}>サインイン</button>
              <button onClick={() => navigate('/createaccount')}>
                利用規約
              </button>
              <button className="home-nav-primary" onClick={() => navigate('/createaccount')}>
                アカウントを作成
              </button>
            </>
          )}
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow">POLIGO CLOUD IDE</span>
            <h1>縛られずに<br />コードを作る。</h1>
            <p>
              コードの作成、実行、保存をブラウザだけで完結できるクラウドIDE。
              プロジェクトをひとつの場所にまとめて、自由なペースで開発できます。
            </p>

            <div className="home-hero-actions">
              <button className="home-primary-button" onClick={() => navigate(session?.user ? '/ide' : '/createaccount')}>
                {session?.user ? 'IDEを開く' : 'アカウントを作成'}
                <span>→</span>
              </button>
              <button className="home-secondary-button" onClick={() => {
                if (session?.user) {
                  navigate('/dashboard')
                } else {
                  navigate('/signin')
                }
              }}>
                ダッシュボードを見る
              </button>
            </div>

            <div className="home-trust-line">
              <span className="home-status-dot" />
              クラウドプロジェクト · 多言語実行 · ソース履歴
            </div>
          </div>

          <div className="home-hero-visual">
            <div className="home-window">
              <div className="home-window-bar">
                <span />
                <span />
                <span />
                <strong>Poligo</strong>
              </div>

              <div className="home-window-body">
                <div className="home-window-sidebar">
                  <span className="home-window-sidebar-active">▦</span>
                  <span>⌕</span>
                  <span>⑂</span>
                  <span>⚙</span>
                </div>

                <div className="home-window-files">
                  <div className="home-window-label">EXPLORER</div>
                  <span className="home-file-active">index.html</span>
                  <span>style.css</span>
                  <span>main.py</span>
                  <span>main.cpp</span>
                </div>

                <div className="home-window-editor">
                  <div className="home-window-tabs">
                    <span>main.py</span>
                    <span>app.js</span>
                  </div>
                  <pre>{`print("Hello from Poligo")

name = "builder"

if name:
    print("Ready to build.")`}</pre>
                  <div className="home-window-output">
                    <div>OUTPUT</div>
                    <strong>Hello from Poligo</strong>
                    <span>Process completed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-feature-strip">
          <article>
            <span>01</span>
            <h2>書く</h2>
            <p>使い慣れたデスクトップIDEの感覚でコードを編集できます。</p>
          </article>
          <article>
            <span>02</span>
            <h2>実行</h2>
            <p>同じブラウザ上のワークスペースから対応言語を実行できます。</p>
          </article>
          <article>
            <span>03</span>
            <h2>保存</h2>
            <p>プロジェクト、ファイル、ソース履歴をクラウドに保存できます。</p>
          </article>
        </section>

        <section className="home-language-section">
          <div>
            <span className="home-eyebrow">対応言語</span>
            <h2>静的なページからネイティブコードまで。</h2>
          </div>
          <div className="home-language-list">
            {LANGUAGES.map(language => (
              <div className="home-language-chip" key={language.name}>
                <img src={language.icon} alt="" aria-hidden="true" />
                <span>{language.name}</span>
              </div>
            ))}
          </div>
        </section>


      </main>

      <footer className="home-footer">
        <span>© Poligo</span>
        <div>
          <a href="https://poligo1.statuspage.io/" target="_blank" rel="noreferrer">システムステータス</a>
          <button onClick={() => navigate('/signin')}>サインイン</button>
        </div>
      </footer>
    </div>
  )
}
