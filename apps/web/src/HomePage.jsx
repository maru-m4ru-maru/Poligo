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

export default function HomePage({ session }) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <button className="home-brand" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>

        <div className="home-nav-actions">
          <a href="https://poligo1.statuspage.io/" target="_blank" rel="noreferrer">
            Status
          </a>
          {session?.user ? (
            <>
              <button onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="home-nav-primary" onClick={() => navigate('/ide')}>
                Open IDE
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/signin')}>Sign in</button>
              <button className="home-nav-primary" onClick={() => navigate('/createaccount')}>
                Get started
              </button>
            </>
          )}
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow">POLIGO CLOUD IDE</span>
            <h1>Build without<br />the lock-in.</h1>
            <p>
              A browser-based workspace for writing, running, and saving code.
              Keep your projects in one place and move at your own pace.
            </p>

            <div className="home-hero-actions">
              <button className="home-primary-button" onClick={() => navigate(session?.user ? '/ide' : '/createaccount')}>
                {session?.user ? 'Open your IDE' : 'Create an account'}
                <span>→</span>
              </button>
              <button className="home-secondary-button" onClick={() => navigate('/dashboard')}>
                View dashboard
              </button>
            </div>

            <div className="home-trust-line">
              <span className="home-status-dot" />
              Cloud projects · Multi-language execution · Source history
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
            <h2>Write</h2>
            <p>Monaco-powered editing with a familiar desktop IDE feel.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Run</h2>
            <p>Execute supported languages from the same browser workspace.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Keep</h2>
            <p>Persist projects, files, and source history in the cloud.</p>
          </article>
        </section>

        <section className="home-language-section">
          <div>
            <span className="home-eyebrow">SUPPORTED WORKFLOWS</span>
            <h2>From static pages to native code.</h2>
          </div>
          <div className="home-language-list">
            <span>HTML</span>
            <span>CSS</span>
            <span>JavaScript</span>
            <span>Python</span>
            <span>C</span>
            <span>C++</span>
            <span>Java</span>
            <span>Go</span>
            <span>Rust</span>
            <span>PHP</span>
            <span>Ruby</span>
            <span>Kotlin</span>
            <span>C#</span>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>© Poligo</span>
        <div>
          <a href="https://poligo1.statuspage.io/" target="_blank" rel="noreferrer">System status</a>
          <button onClick={() => navigate('/signin')}>Sign in</button>
        </div>
      </footer>
    </div>
  )
}
