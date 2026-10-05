import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

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
    year: 'numeric',
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

function DashboardIcon({ type }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (type === 'projects') {
    return (
      <svg {...common}>
        <path d="M4 7h6l2 2h8v10H4z" />
        <path d="M4 7V5h6l2 2" />
      </svg>
    )
  }

  if (type === 'files') {
    return (
      <svg {...common}>
        <path d="M5 3h9l5 5v13H5z" />
        <path d="M14 3v5h5" />
      </svg>
    )
  }

  if (type === 'storage') {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.8 1.8" />
    </svg>
  )
}

export default function Dashboard({ session }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/dashboard', {
          credentials: 'include'
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Dashboard request failed')
        }

        if (!cancelled) {
          setData(result)
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Dashboard request failed')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  async function signOut() {
    await authClient.signOut()
    window.location.assign('/signin')
  }

  function openProject(id) {
    localStorage.setItem('poligo-current-project', id)
    navigate('/')
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <img src="/poligo-mark.svg" alt="Poligo" />
        <span>Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error-card">
          <img src="/poligo-mark.svg" alt="Poligo" />
          <h1>Unable to load dashboard</h1>
          <p>{error}</p>
          <button className="dashboard-primary-button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const stats = data.stats
  const projects = data.projects

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <button className="dashboard-brand" onClick={() => navigate('/')}>
          <img src="/poligo-mark.svg" alt="" />
          <span>Poligo</span>
        </button>

        <div className="dashboard-header-actions">
          <button className="dashboard-secondary-button" onClick={() => navigate('/')}>
            Open IDE
          </button>
          <button className="dashboard-secondary-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-hero">
          <div>
            <div className="dashboard-eyebrow">POLIGO CLOUD</div>
            <h1>Welcome back, {session?.user?.name || data.user.name}</h1>
            <p>Your projects are stored and managed through Poligo Cloud.</p>
          </div>
          <div className="dashboard-cloud-status">
            <span className="dashboard-status-dot" />
            Turso database connected
          </div>
        </section>

        <section className="dashboard-stat-grid">
          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <DashboardIcon type="projects" />
            </div>
            <div>
              <span className="dashboard-stat-label">Projects</span>
              <strong>{stats.projectCount}</strong>
            </div>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <DashboardIcon type="files" />
            </div>
            <div>
              <span className="dashboard-stat-label">Files</span>
              <strong>{stats.fileCount}</strong>
            </div>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <DashboardIcon type="storage" />
            </div>
            <div>
              <span className="dashboard-stat-label">Stored data</span>
              <strong>{formatBytes(stats.storageBytes)}</strong>
            </div>
          </article>

          <article className="dashboard-stat-card">
            <div className="dashboard-stat-icon">
              <DashboardIcon type="activity" />
            </div>
            <div>
              <span className="dashboard-stat-label">Last activity</span>
              <strong>{stats.lastUpdated ? formatDate(stats.lastUpdated) : 'None'}</strong>
            </div>
          </article>
        </section>

        <section className="dashboard-content-grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-panel-eyebrow">YOUR WORKSPACE</span>
                <h2>Recent projects</h2>
              </div>
              <button className="dashboard-link-button" onClick={() => navigate('/')}>
                Open IDE
              </button>
            </div>

            {projects.length ? (
              <div className="dashboard-project-list">
                {projects.map(project => (
                  <button
                    className="dashboard-project-row"
                    key={project.id}
                    onClick={() => openProject(project.id)}
                  >
                    <div className="dashboard-project-mark">
                      <span />
                      <span />
                      <span />
                    </div>

                    <div className="dashboard-project-info">
                      <strong>{project.name}</strong>
                      <span>Updated {formatDate(project.updatedAt)}</span>
                    </div>

                    <div className="dashboard-project-meta">
                      <span>{project.fileCount} files</span>
                      <span>{formatBytes(project.storageBytes)}</span>
                    </div>

                    <span className="dashboard-project-arrow">→</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <h3>No projects yet</h3>
                <p>Create your first project from the Poligo IDE.</p>
                <button className="dashboard-primary-button" onClick={() => navigate('/')}>
                  Create project
                </button>
              </div>
            )}
          </div>

          <aside className="dashboard-panel dashboard-account-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-panel-eyebrow">ACCOUNT</span>
                <h2>Profile</h2>
              </div>
            </div>

            <div className="dashboard-profile">
              <div className="dashboard-avatar">
                {(data.user.name || 'P').slice(0, 1).toUpperCase()}
              </div>
              <div className="dashboard-profile-name">{data.user.name}</div>
              <div className="dashboard-profile-email">{data.user.email}</div>
            </div>

            <div className="dashboard-account-details">
              <div>
                <span>Storage</span>
                <strong>{formatBytes(stats.storageBytes)}</strong>
              </div>
              <div>
                <span>Projects</span>
                <strong>{stats.projectCount}</strong>
              </div>
              <div>
                <span>Files</span>
                <strong>{stats.fileCount}</strong>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}
