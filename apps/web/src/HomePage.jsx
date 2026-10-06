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
          <button onClick={() => document.getElementById('terms')?.scrollIntoView({ behavior: 'smooth' })}>
            Terms
          </button>
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
          <button onClick={() => document.getElementById('terms')?.scrollIntoView({ behavior: 'smooth' })}>Terms</button>
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
          </div>        </section>

        <section id="terms" className="home-terms-section">
          <div className="home-terms-heading">
            <span className="home-eyebrow">POLIGO TERMS</span>
            <h2>Simple rules. Clear limits.</h2>
            <p>
              Poligo is intended to be a shared cloud IDE. These rules keep the service fair,
              predictable, and usable for everyone.
            </p>
          </div>

          <div className="home-terms-grid">
            <article className="home-term-card home-term-card-emphasis">
              <span>01</span>
              <h3>One account per person</h3>
              <p>
                Creating or using multiple accounts without explicit permission from Poligo is prohibited.
                Multiple accounts used to bypass storage, usage, or other service limits are also prohibited.
              </p>
              <strong>
                Unauthorized multiple accounts may be blocked without prior notice.
              </strong>
            </article>

            <article className="home-term-card">
              <span>02</span>
              <h3>Zero tolerance</h3>
              <p>
                Unauthorized multiple-account use is treated as a serious violation.
                Poligo may suspend or delete the affected accounts without prior notice.
              </p>
              <p>
                The operator may also prohibit the same person from accessing or using
                Poligo and all other services operated by the operator, including related accounts.
              </p>
            </article>

            <article className="home-term-card">
              <span>03</span>
              <h3>15MB standard storage</h3>
              <p>
                Each account normally receives 15MB of storage. Additional storage may be granted
                individually after contacting the operator.
              </p>
            </article>

            <article className="home-term-card">
              <span>04</span>
              <h3>Prohibited use</h3>
              <p>
                Do not abuse the service, bypass restrictions, access other users' accounts,
                interfere with normal operation, overload infrastructure, exploit vulnerabilities,
                or otherwise use Poligo unlawfully.
              </p>
            </article>

            <article className="home-term-card">
              <span>05</span>
              <h3>Suspension and deletion</h3>
              <p>
                Violations may result in suspension, permanent access restrictions, data deletion,
                account deletion, or a ban from all services operated by the operator without prior notice.
              </p>
            </article>

            <article className="home-term-card">
              <span>06</span>
              <h3>Service availability</h3>
              <p>
                Maintenance, outages, and other circumstances may temporarily affect the service.
                The operator may update these rules when necessary and publish the latest version on Poligo.
              </p>
            </article>
          </div>

          <p className="home-terms-updated">Last updated: October 6, 2026</p>
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
