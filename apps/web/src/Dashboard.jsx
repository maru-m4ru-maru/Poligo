import { useEffect, useMemo, useState } from 'react'
import { authClient } from './auth-client'
import { deleteProject } from './projectStore'

const TEMPLATES = [
  {
    id: 'web',
    title: 'Web',
    subtitle: 'HTML/CSS/JavaScript',
    type: 'Web',
    categories: ['Popular', 'Frontend', 'Fullstack', 'Creative', 'Vanilla'],
    files: {
      'index.html': '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo Web</title>\n  </head>\n  <body>\n    <main class="app">\n      <h1>Hello, Poligo.</h1>\n      <p>Build something great.</p>\n    </main>\n    <script src="app.js"></script>\n  </body>\n</html>',
      'style.css': 'body {\n  margin: 0;\n  min-height: 100vh;\n  font-family: system-ui, sans-serif;\n  background: #ffffff;\n  color: #111827;\n}\n\n.app {\n  max-width: 760px;\n  margin: 0 auto;\n  padding: 64px 24px;\n}',
      'app.js': "const title = document.querySelector('h1')\n\ntitle.addEventListener('click', () => {\n  title.textContent = 'It works.'\n})"
    }
  },
  {
    id: 'html',
    title: 'Static',
    subtitle: 'HTML/CSS/JS',
    type: 'HTML',
    categories: ['Popular', 'Frontend', 'Docs, Blogs & Slides', 'Vanilla'],
    files: {
      'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main style="max-width: 720px; margin: 0 auto; padding: 64px 24px; font-family: system-ui, sans-serif;">\n      <h1>Hello, Poligo.</h1>\n      <p>A static HTML project.</p>\n    </main>\n  </body>\n</html>'
    }
  },
  {
    id: 'python',
    title: 'Python',
    subtitle: 'Python 3',
    type: 'Python',
    categories: ['Popular', 'Backend', 'Native Languages'],
    files: {
      'main.py': 'print("Hello from Poligo")'
    }
  },
  {
    id: 'java',
    title: 'Java',
    subtitle: 'Java',
    type: 'Java',
    categories: ['Popular', 'Backend', 'Native Languages'],
    files: {
      'Main.java': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Poligo");\n    }\n}'
    }
  },
  {
    id: 'go',
    title: 'Go',
    subtitle: 'Go',
    type: 'Go',
    categories: ['Backend', 'Native Languages'],
    files: {
      'main.go': 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Poligo")\n}'
    }
  },
  {
    id: 'rust',
    title: 'Rust',
    subtitle: 'Rust',
    type: 'Rust',
    categories: ['Backend', 'Native Languages'],
    files: {
      'main.rs': 'fn main() {\n    println!("Hello from Poligo");\n}'
    }
  },
  {
    id: 'php',
    title: 'PHP',
    subtitle: 'PHP',
    type: 'PHP',
    categories: ['Backend', 'Native Languages'],
    files: {
      'index.php': '<?php\necho "Hello from Poligo";\n'
    }
  },
  {
    id: 'ruby',
    title: 'Ruby',
    subtitle: 'Ruby',
    type: 'Ruby',
    categories: ['Backend', 'Native Languages'],
    files: {
      'main.rb': 'puts "Hello from Poligo"'
    }
  },
  {
    id: 'kotlin',
    title: 'Kotlin',
    subtitle: 'Kotlin/JVM',
    type: 'Kotlin',
    categories: ['Backend', 'Native Languages'],
    files: {
      'Main.kt': 'fun main() {\n    println("Hello from Poligo")\n}'
    }
  },
  {
    id: 'cpp',
    title: 'C++',
    subtitle: 'C++',
    type: 'C++',
    categories: ['Popular', 'Backend', 'Native Languages'],
    files: {
      'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from Poligo\\n";\n    return 0;\n}'
    }
  },
  {
    id: 'c',
    title: 'C',
    subtitle: 'C',
    type: 'C',
    categories: ['Backend', 'Native Languages'],
    files: {
      'main.c': '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from Poligo\\n");\n    return 0;\n}'
    }
  },
  {
    id: 'csharp',
    title: 'C#',
    subtitle: '.NET',
    type: 'C#',
    categories: ['Popular', 'Backend', 'Native Languages'],
    files: {
      'main.cs': 'using System;\n\nConsole.WriteLine("Hello from Poligo");'
    }
  }
]

const CATEGORIES = [
  'Popular',
  'Frontend',
  'Backend',
  'Fullstack',
  'Docs, Blogs & Slides',
  'Creative',
  'Mobile & VR',
  'Vanilla',
  'Native Languages'
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

function getProjectDescription(project) {
  const name = project.name.toLowerCase()

  if (name.includes('python')) return 'Python 3 project'
  if (name.includes('c++')) return 'C++ project'
  if (name.includes('c#')) return '.NET project'
  if (name === 'web' || name.includes('html')) return 'HTML/CSS/JavaScript'
  if (name.includes('static')) return 'HTML/CSS/JS Starter'

  return project.fileCount
    ? project.fileCount + ' files in Poligo'
    : 'Poligo project'
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

  if (type === 'C#' || type === 'Java' || type === 'Go' || type === 'Rust' || type === 'PHP' || type === 'Ruby' || type === 'Kotlin') {
    return (
      <span className="stack-template-text-icon" aria-hidden="true">
        {type}
      </span>
    )
  }

  if (type === 'Web') {
    return (
      <svg
        width="28"
        height="28"
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
        <path d="M12 3c2.5 2.5 3.7 5.5 3.7 9S14.5 18.5 12 21" />
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
  const [templateCategory, setTemplateCategory] = useState('Popular')
  const [projectContextMenu, setProjectContextMenu] = useState(null)
  const [deletingProjectId, setDeletingProjectId] = useState('')
  const [deleteDialogProject, setDeleteDialogProject] = useState(null)
  const [deleteDialogBusy, setDeleteDialogBusy] = useState(false)

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

      const [dashboardResponse, projectResponse] = await Promise.all([
        fetch('/api/dashboard', {
          credentials: 'include',
          headers: workspaceHeaders
        }),
        fetch('/api/projects', {
          credentials: 'include',
          headers: workspaceHeaders
        })
      ])

      const result = await dashboardResponse.json()
      const projectList = await projectResponse.json()

      if (!dashboardResponse.ok) {
        throw new Error(result.error || 'Dashboard request failed')
      }

      if (!projectResponse.ok) {
        throw new Error(projectList.error || 'Project list request failed')
      }

      const dashboardProjects = Array.isArray(result.projects) ? result.projects : []
      const apiProjects = Array.isArray(projectList) ? projectList : []
      const merged = new Map(
        dashboardProjects.map(project => [project.id, project])
      )

      for (const project of apiProjects) {
        if (!merged.has(project.id)) {
          merged.set(project.id, {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            fileCount: 0,
            storageBytes: 0
          })
        }
      }

      const mergedProjects = [...merged.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)

      setData({
        ...result,
        projects: mergedProjects,
        stats: {
          ...result.stats,
          projectCount: Math.max(
            Number(result.stats?.projectCount || 0),
            mergedProjects.length
          )
        }
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Dashboard request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!newProjectOpen && !deleteDialogProject) return

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (newProjectOpen) setNewProjectOpen(false)
        setProjectContextMenu(null)
        if (!deleteDialogBusy) setDeleteDialogProject(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [newProjectOpen, deleteDialogProject, deleteDialogBusy])

  useEffect(() => {
    if (!projectContextMenu) return

    function handleDocumentClick() {
      setProjectContextMenu(null)
    }

    document.addEventListener('click', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [projectContextMenu])

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

  function openProjectContextMenu(event, project) {
    event.preventDefault()
    event.stopPropagation()

    const width = 190
    const height = 52
    const x = Math.min(event.clientX, window.innerWidth - width - 10)
    const y = Math.min(event.clientY, window.innerHeight - height - 10)

    setProjectContextMenu({
      project,
      x: Math.max(10, x),
      y: Math.max(10, y)
    })
  }

  function requestDeleteProject(project) {
    if (deletingProjectId) return

    setProjectContextMenu(null)
    setDeleteDialogProject(project)
  }

  async function confirmDeleteProject() {
    if (!deleteDialogProject || deleteDialogBusy) return

    setDeleteDialogBusy(true)
    setDeletingProjectId(deleteDialogProject.id)
    setError('')

    try {
      await deleteProject(deleteDialogProject.id)
      setDeleteDialogProject(null)
      await loadDashboard()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Project deletion failed')
      setLoading(false)
    } finally {
      setDeletingProjectId('')
      setDeleteDialogBusy(false)
    }
  }

  async function createTemplate(template) {
    if (creating) return

    setCreating(template.id)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Poligo-Workspace': getWorkspaceId()
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
          onClick={() => {
            setTemplateCategory('Popular')
            setNewProjectOpen(current => !current)
          }}
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
              <div className="stack-new-project-account">
                <span>Add to</span>
                <strong>{data.user.name}</strong>
                <span>⌄</span>
              </div>
              <button
                className="stack-new-project-close"
                onClick={() => setNewProjectOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="stack-template-categories">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  className={templateCategory === category ? 'active' : ''}
                  onClick={() => setTemplateCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="stack-new-project-grid">
              {TEMPLATES.filter(template =>
                template.categories.includes(templateCategory)
              ).map(template => (
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
                </button>
              ))}

              {!TEMPLATES.some(template =>
                template.categories.includes(templateCategory)
              ) && (
                <div className="stack-template-empty">
                  <strong>No starters yet</strong>
                  <span>More runtimes are coming to Poligo.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteDialogProject && (
        <div
          className="stack-delete-dialog-overlay"
          onMouseDown={() => {
            if (!deleteDialogBusy) setDeleteDialogProject(null)
          }}
        >
          <div
            className="stack-delete-dialog"
            role="dialog"
            aria-modal="true"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="stack-delete-dialog-icon">!</div>
            <div className="stack-delete-dialog-copy">
              <span>PROJECT</span>
              <h2>Delete project?</h2>
              <p>
                "{deleteDialogProject.name}" and its files will be permanently removed.
              </p>
            </div>
            <div className="stack-delete-dialog-actions">
              <button
                type="button"
                className="stack-delete-dialog-cancel"
                onClick={() => setDeleteDialogProject(null)}
                disabled={deleteDialogBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="stack-delete-dialog-confirm"
                onClick={() => void confirmDeleteProject()}
                disabled={deleteDialogBusy}
              >
                {deleteDialogBusy ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {projectContextMenu && (
        <div
          className="stack-project-context-menu"
          style={{
            left: projectContextMenu.x,
            top: projectContextMenu.y
          }}
          role="menu"
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              openProject(projectContextMenu.project.id)
              setProjectContextMenu(null)
            }}
          >
            Open project
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => requestDeleteProject(projectContextMenu.project)}
          >
            Delete project
          </button>
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
                <h2>Recent projects</h2>
              </div>
              <button
                className="stack-show-all"
                type="button"
                onClick={() => setQuery('')}
              >
                Show all
                <span>›</span>
              </button>
            </div>

            {projects.length ? (
              <div className="stack-project-table">
                <div className="stack-project-table-head">
                  <span aria-hidden="true" />
                  <span>Title</span>
                  <span>Description</span>
                  <span>Files</span>
                  <span>Updated</span>
                  <span aria-hidden="true" />
                </div>

                <div className="stack-project-table-body">
                  {projects.map(project => (
                    <div
                      key={project.id}
                      className={
                        'stack-project-list-row' +
                        (deletingProjectId === project.id ? ' deleting' : '')
                      }
                      role="button"
                      tabIndex={0}
                      onClick={() => openProject(project.id)}
                      onKeyDown={event => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault()
                          openProject(project.id)
                        }
                      }}
                      onContextMenu={event => openProjectContextMenu(event, project)}
                    >
                      <input
                        className="stack-project-check"
                        type="checkbox"
                        aria-label={'Select ' + project.name}
                        onClick={event => event.stopPropagation()}
                      />

                      <div className="stack-project-list-title">
                        <span className="stack-project-project-icon">
                          <img src="/poligo-mark.svg" alt="" />
                        </span>
                        <span className="stack-project-title-copy">
                          <strong>{project.name}</strong>
                          <small>{formatBytes(project.storageBytes)}</small>
                        </span>
                      </div>

                      <span className="stack-project-description">
                        {getProjectDescription(project)}
                      </span>

                      <span className="stack-project-files">
                        {project.fileCount}
                      </span>

                      <span className="stack-project-updated">
                        {formatDate(project.updatedAt)}
                      </span>

                      <button
                        className="stack-project-menu-button"
                        type="button"
                        aria-label={'Project actions for ' + project.name}
                        aria-haspopup="menu"
                        aria-expanded={projectContextMenu?.project?.id === project.id}
                        onClick={event => {
                          event.stopPropagation()
                          const rect = event.currentTarget.getBoundingClientRect()
                          setProjectContextMenu({
                            project,
                            x: Math.min(rect.right - 190, window.innerWidth - 200),
                            y: Math.min(rect.bottom + 4, window.innerHeight - 62)
                          })
                        }}
                      >
                        ···
                      </button>
                    </div>
                  ))}
                </div>
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
