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
  const common = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (type === 'Web') {
    return <svg {...common}><path d="m8 8-3 4 3 4M16 8l3 4-3 4M14 5l-4 14" /></svg>
  }

  if (type === 'HTML') {
    return <svg {...common}><path d="m7 4-4 16 9 2 9-2-4-16Z" /><path d="M8 8h8M7 12h8M6 16h8" /></svg>
  }

  if (type === 'Python') {
    return <svg {...common}><path d="M12 4c-3.2 0-4 .9-4 3v2h4v2H6c-2 0-3 1.1-3 3s1 3 3 3h2v-3h6c2 0 3-1 3-3V7c0-2-1.1-3-5-3Z" /><path d="M12 20c3.2 0 4-.9 4-3v-2h-4v-2h6c2 0 3-1.1 3-3s-1-3-3-3h-2v3H10c-2 0-3 1-3 3v3c0 2 1.1 3 5 3Z" /></svg>
  }

  return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8M12 8v8" /></svg>
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
      const response = await fetch('/api/dashboard', {
        credentials: 'include',
        headers: {
          'X-Poligo-Workspace': getWorkspaceId()
        }
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

          <section id="new-projects" className="stack-section">
            <div className="stack-section-heading">
              <div>
                <span>START HERE</span>
                <h2>Create a new project</h2>
              </div>
              <p>Start with the tools you already use.</p>
            </div>

            <div className="stack-template-grid">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  className="stack-template-card"
                  onClick={() => void createTemplate(template)}
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
