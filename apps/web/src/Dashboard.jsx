import { useEffect, useMemo, useState } from 'react'
import { authClient } from './auth-client'

const TEMPLATES = [
  {
    id: 'web',
    title: 'Web',
    subtitle: 'HTML, CSS and JavaScript',
    type: 'Web',
    files: {
      'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo Web</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>Build something great.</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
      'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #ffffff;\n  color: #111827;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
      'app.js': "const title = document.querySelector('h1')\n\ntitle.addEventListener('click', () => {\n  title.textContent = 'It works.'\n})"
    }
  },
  {
    id: 'html',
    title: 'Static HTML',
    subtitle: 'A minimal HTML project',
    type: 'HTML',
    files: {
      'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <h1>Hello, Poligo.</h1>\n  </body>\n</html>'
    }
  },
  {
    id: 'python',
    title: 'Python',
    subtitle: 'Run Python in Poligo',
    type: 'Python',
    files: {
      'main.py': 'print("Hello from Poligo")'
    }
  },
  {
    id: 'cpp',
    title: 'C++',
    subtitle: 'Run C++ in Poligo',
    type: 'C++',
    files: {
      'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from Poligo\\n";\n    return 0;\n}'
    }
  },
  {
    id: 'c',
    title: 'C',
    subtitle: 'Run C in Poligo',
    type: 'C',
    files: {
      'main.c': '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from Poligo\\n");\n    return 0;\n}'
    }
  }
]

function formatBytes(bytes) {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return value >= 10 || unit === 0
    ? Math.round(value) + ' ' + units[unit]
    : value.toFixed(1) + ' ' + units[unit]
}

function formatDate(timestamp) {
  if (!timestamp) return 'No activity'

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function getWorkspaceId() {
  let workspaceId = localStorage.getItem('poligo-workspace-id')

  if (!workspaceId) {
    workspaceId =
      globalThis.crypto?.randomUUID?.() ||
      'workspace-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)

    localStorage.setItem('poligo-workspace-id', workspaceId)
  }

  return workspaceId
}

function TemplateIcon({ type }) {
  const icons = {
    HTML: '/icons/html5.svg',
    Python: '/icons/python.svg',
    'C++': '/icons/cplusplus.svg',
    C: '/icons/c.svg'
  }

  if (type === 'Web') {
    return (
      <svg
        width="27"
        height="27"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 16.5 12 21" />
        <path d="M12 3c-2.5 2.5-3.7 5.5-3.7 9S9.5 18.5 12 21" />
      </svg>
    )
  }

  return (
    <img
      src={icons[type] || '/icons/html5.svg'}
      alt=""
      className="stack-template-brand-icon"
      aria-hidden="true"
    />
  )
}
export default function Dashboard({ session }) {
  const [data, setData] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState('')
  const [activeSection, setActiveSection] = useState('projects')
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const workspaceHeaders = {
        'X-Poligo-Workspace': getWorkspaceId()
      }

      const claimResponse = await fetch('/api/workspace/claim', {
        method: 'POST',
        credentials: 'include',
        headers: workspaceHeaders
      })

      if (!claimResponse.ok && claimResponse.status !== 401) {
        const claimResult = await claimResponse.json().catch(() => ({}))
        throw new Error(claimResult.error || 'Workspace claim failed')
      }

      const response = await fetch('/api/dashboard', {
        credentials: 'include',
        headers: workspaceHeaders
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Dashboard request failed')
      }

      setData(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dashboard request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  const projects = useMemo(() => {
    const source = data?.projects || []
    const normalized = query.trim().toLowerCase()

    if (!normalized) return source

    return source.filter(project =>
      project.name.toLowerCase().includes(normalized)
    )
  }, [data, query])

  async function signOut() {
    await authClient.signOut()
    window.location.assign('/signin')
  }

  function openProject(id) {
    localStorage.setItem('poligo-current-project', id)
    navigate('/')
  }

  async function createTemplate(template) {
    if (creating) return

    setCreating(template.id)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: template.title,
          files: template.files
        })
      })

      const project = await response.json()

      if (!response.ok) {
        throw new Error(project.error || 'Project creation failed')
      }

      localStorage.setItem('poligo-current-project', project.id)
      navigate('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Project creation failed')
      setCreating('')
    }
  }

  if (loading) {
    return (
      <div className="stack-dashboard-loading">
        <img src="/poligo-mark.svg" alt="Poligo" />
        <span>Loading dashboard...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="stack-dashboard-loading">
        <div className="stack-dashboard-error">
          <img src="/poligo-mark.svg" alt="Poligo" />
          <h1>Unable to load dashboard</h1>
          <p>{error}</p>
          <button onClick={() => void loadDashboard()}>Retry</button>
        </div>
      </div>
    )
  }

  const stats = data.stats

  return (
    <div className="stack-dashboard">
      <aside className="stack-sidebar">
        <button className="stack-sidebar-brand" onClick={() => setActiveSection('projects')}>
          <img src="/poligo-mark.svg" alt="" />
          <span>Poligo</span>
        </button>

        <button
          className="stack-new-button"
          onClick={() => setNewProjectOpen(current => !current)}
        >
          <span>+</span>
          New Project
        </button>

        <nav className="stack-sidebar-nav">
          <button
            className={activeSection === 'projects' ? 'active' : ''}
            onClick={() => {
              setActiveSection('projects')
              document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="stack-nav-icon">▦</span>
            Projects
          </button>

          <button
            className={activeSection === 'account' ? 'active' : ''}
            onClick={() => {
              setActiveSection('account')
              document.getElementById('account')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <span className="stack-nav-icon">◯</span>
            Account
          </button>
        </nav>

        <div className="stack-sidebar-bottom">
          <div className="stack-sidebar-user">
            <div className="stack-user-avatar">
              {(data.user.name || 'P').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{data.user.name}</strong>
              <span>{data.user.email}</span>
            </div>
          </div>

          <button className="stack-signout-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      {newProjectOpen && (
        <div
          className="stack-new-project-overlay"
          onClick={() => setNewProjectOpen(false)}
        >
          <div
            className="stack-new-project-menu"
            onClick={event => event.stopPropagation()}
          >
            <div className="stack-new-project-header">
              <div>
                <span>NEW PROJECT</span>
                <h2>Choose a starter</h2>
              </div>
              <button
                className="stack-new-project-close"
                onClick={() => setNewProjectOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="stack-new-project-grid">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  className="stack-template-card"
                  onClick={() => {
                    setNewProjectOpen(false)
                    void createTemplate(template)
                  }}
                  disabled={Boolean(creating)}
                >
                  <div className="stack-template-icon">
                    <TemplateIcon type={template.type} />
                  </div>
                  <div className="stack-template-copy">
                    <strong>{template.title}</strong>
                    <span>{creating === template.id ? 'Creating project...' : template.subtitle}</span>
                  </div>
                  <span className="stack-template-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="stack-dashboard-main">
        <header className="stack-dashboard-topbar">
          <div className="stack-breadcrumb">
            <span>Cloud</span>
            <span>/</span>
            <strong>Dashboard</strong>
          </div>

          <div className="stack-top-actions">
            <div className="stack-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search projects"
              />
              <kbd>⌘ K</kbd>
            </div>
            <button className="stack-open-ide" onClick={() => navigate('/')}>
              Open IDE
            </button>
          </div>
        </header>

        <div className="stack-dashboard-content">
          <section className="stack-welcome">
            <div>
              <span className="stack-eyebrow">POLIGO CLOUD</span>
              <h1>Build something.</h1>
              <p>Choose a starter or continue working on one of your projects.</p>
            </div>
            <div className="stack-cloud-pill">
              <span />
              Turso connected
            </div>
          </section>

          <section id="projects" className="stack-section">
            <div className="stack-section-heading stack-project-heading">
              <div>
                <span>YOUR WORKSPACE</span>
                <h2>Projects</h2>
              </div>
              <span className="stack-project-count">{projects.length} shown</span>
            </div>

            {projects.length ? (
              <div className="stack-project-grid">
                {projects.map(project => (
                  <button
                    key={project.id}
                    className="stack-project-card"
                    onClick={() => openProject(project.id)}
                  >
                    <div className="stack-project-preview">
                      <div className="stack-project-preview-bar">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="stack-project-preview-code">
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>

                    <div className="stack-project-card-body">
                      <div className="stack-project-card-icon">
                        <img src="/poligo-mark.svg" alt="" />
                      </div>
                      <div className="stack-project-card-copy">
                        <strong>{project.name}</strong>
                        <span>{project.fileCount} files · {formatBytes(project.storageBytes)}</span>
                        <small>Updated {formatDate(project.updatedAt)}</small>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="stack-empty">
                <h3>{query ? 'No matching projects' : 'No projects yet'}</h3>
                <p>{query ? 'Try a different search term.' : 'Create a starter project above to get moving.'}</p>
              </div>
            )}
          </section>

          <section id="account" className="stack-account-section">
            <div>
              <span className="stack-eyebrow">ACCOUNT</span>
              <h2>{data.user.name}</h2>
              <p>{data.user.email}</p>
            </div>

            <div className="stack-account-stats">
              <div>
                <span>Projects</span>
                <strong>{stats.projectCount}</strong>
              </div>
              <div>
                <span>Files</span>
                <strong>{stats.fileCount}</strong>
              </div>
              <div>
                <span>Stored data</span>
                <strong>{formatBytes(stats.storageBytes)}</strong>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
