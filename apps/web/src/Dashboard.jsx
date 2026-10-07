import { useEffect, useMemo, useState } from 'react'
import { authClient } from './auth-client'
import { deleteProject } from './projectStore'

const TEMPLATES = [
  {
    id: 'web',
    title: 'Web',
    subtitle: 'HTML/CSS/JavaScript',
    type: 'Web',
    categories: ['人気', 'フロントエンド', 'フルスタック', 'クリエイティブ', 'バニラ'],
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
    categories: ['人気', 'フロントエンド', 'ドキュメント・ブログ・スライド', 'バニラ'],
    files: {
      'index.html': '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Poligo</title>\n  </head>\n  <body>\n    <main style="max-width: 720px; margin: 0 auto; padding: 64px 24px; font-family: system-ui, sans-serif;">\n      <h1>Hello, Poligo.</h1>\n      <p>A static HTML project.</p>\n    </main>\n  </body>\n</html>'
    }
  },
  {
    id: 'python',
    title: 'Python',
    subtitle: 'Python 3',
    type: 'Python',
    categories: ['人気', 'バックエンド', 'ネイティブ言語'],
    files: {
      'main.py': 'print("Hello from Poligo")'
    }
  },
  {
    id: 'java',
    title: 'Java',
    subtitle: 'Java',
    type: 'Java',
    categories: ['人気', 'バックエンド', 'ネイティブ言語'],
    files: {
      'Main.java': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Poligo");\n    }\n}'
    }
  },
  {
    id: 'go',
    title: 'Go',
    subtitle: 'Go',
    type: 'Go',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'main.go': 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Poligo")\n}'
    }
  },
  {
    id: 'rust',
    title: 'Rust',
    subtitle: 'Rust',
    type: 'Rust',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'main.rs': 'fn main() {\n    println!("Hello from Poligo");\n}'
    }
  },
  {
    id: 'php',
    title: 'PHP',
    subtitle: 'PHP',
    type: 'PHP',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'index.php': '<?php\necho "Hello from Poligo";\n'
    }
  },
  {
    id: 'ruby',
    title: 'Ruby',
    subtitle: 'Ruby',
    type: 'Ruby',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'main.rb': 'puts "Hello from Poligo"'
    }
  },
  {
    id: 'kotlin',
    title: 'Kotlin',
    subtitle: 'Kotlin/JVM',
    type: 'Kotlin',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'Main.kt': 'fun main() {\n    println("Hello from Poligo")\n}'
    }
  },
  {
    id: 'cpp',
    title: 'C++',
    subtitle: 'C++',
    type: 'C++',
    categories: ['人気', 'バックエンド', 'ネイティブ言語'],
    files: {
      'main.cpp': '#include <iostream>\n\nint main() {\n    std::cout << "Hello from Poligo\\n";\n    return 0;\n}'
    }
  },
  {
    id: 'c',
    title: 'C',
    subtitle: 'C',
    type: 'C',
    categories: ['バックエンド', 'ネイティブ言語'],
    files: {
      'main.c': '#include <stdio.h>\n\nint main(void) {\n    printf("Hello from Poligo\\n");\n    return 0;\n}'
    }
  },
  {
    id: 'csharp',
    title: 'C#',
    subtitle: '.NET',
    type: 'C#',
    categories: ['人気', 'バックエンド', 'ネイティブ言語'],
    files: {
      'main.cs': 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from Poligo");\n    }\n}'
    }
  }
]

const CATEGORIES = [
  '人気',
  'フロントエンド',
  'バックエンド',
  'フルスタック',
  'ドキュメント・ブログ・スライド',
  'クリエイティブ',
  'モバイル・VR',
  'バニラ',
  'ネイティブ言語'
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

function getProject説明(project) {
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
  if (
    path === '/dashboard' ||
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

const TEMPLATE_ICONS = {
  HTML: '/icons/html5.svg',
  Python: '/icons/python.svg',
  'C++': '/icons/cplusplus.svg',
  C: '/icons/c.svg',
  Java: '/icons/java.svg',
  Go: '/icons/go.svg',
  Rust: '/icons/rust.svg',
  PHP: '/icons/php.svg',
  Ruby: '/icons/ruby.svg',
  Kotlin: '/icons/kotlin.svg',
  'C#': '/icons/csharp.svg'
}

function TemplateIcon({ type }) {
  if (type === 'Web') {
    return (
      <div className="stack-web-template-icons" aria-hidden="true">
        <img src="/icons/html5.svg" alt="" />
        <img src="/icons/css.svg" alt="" />
        <img src="/icons/javascript.svg" alt="" />
      </div>
    )
  }

  const src = TEMPLATE_ICONS[type]

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="stack-template-brand-icon"
        aria-hidden="true"
      />
    )
  }

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#52647A" />
      <path
        d="m9 9 2.2 2.2L9 13.5M13 15h2"
        stroke="#EAF0F7"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const [templateCategory, setTemplateCategory] = useState('人気')
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

      const dashboardプロジェクト = Array.isArray(result.projects) ? result.projects : []
      const apiプロジェクト = Array.isArray(projectList) ? projectList : []
      const merged = new Map(
        dashboardプロジェクト.map(project => [project.id, project])
      )

      for (const project of apiプロジェクト) {
        const existing = merged.get(project.id)

        merged.set(project.id, {
          ...(existing || {}),
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          fileCount: Number(project.fileCount ?? existing?.fileCount ?? 0),
          storageBytes: Number(project.storageBytes ?? existing?.storageBytes ?? 0)
        })
      }

      const mergedプロジェクト = [...merged.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)

      setData({
        ...result,
        projects: mergedプロジェクト,
        stats: {
          ...result.stats,
          projectCount: Math.max(
            Number(result.stats?.projectCount || 0),
            mergedプロジェクト.length
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
    navigate('/ide/' + encodeURIComponent(id))
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
      navigate('/ide/' + encodeURIComponent(project.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Project creation failed')
      setCreating('')
    }
  }

  if (loading) {
    return (
      <div className="stack-dashboard-loading">
        <img src="/poligo-mark.svg" alt="Poligo" />
        <span>ダッシュボードを読み込み中...</span>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="stack-dashboard-loading">
        <div className="stack-dashboard-error">
          <img src="/poligo-mark.svg" alt="Poligo" />
          <h1>ダッシュボードを読み込めません</h1>
          <p>{error}</p>
          <button onClick={() => void loadDashboard()}>再試行</button>
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
            setTemplateCategory('人気')
            setNewProjectOpen(current => !current)
          }}
        >
          <span>+</span>
          新規プロジェクト
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
            プロジェクト
          </button>

          <button
            className={activeSection === 'account' ? 'active' : ''}
            onClick={() => {
              window.history.pushState({}, '', '/')
              window.location.hash = '/account'
            }}
          >
            <span className="stack-nav-icon">◯</span>
            アカウント
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
            サインアウト
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
                <span>追加先</span>
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
                    <span>{creating === template.id ? 'プロジェクトを作成中...' : template.subtitle}</span>
                  </div>
                </button>
              ))}

              {!TEMPLATES.some(template =>
                template.categories.includes(templateCategory)
              ) && (
                <div className="stack-template-empty">
                  <strong>テンプレートはありません</strong>
                  <span>対応ランタイムを順次追加します。</span>
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
              <span>プロジェクト</span>
              <h2>プロジェクトを削除?</h2>
              <p>
                "{deleteDialogProject.name}" とそのファイルは完全に削除されます。
              </p>
            </div>
            <div className="stack-delete-dialog-actions">
              <button
                type="button"
                className="stack-delete-dialog-cancel"
                onClick={() => setDeleteDialogProject(null)}
                disabled={deleteDialogBusy}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="stack-delete-dialog-confirm"
                onClick={() => void confirmDeleteProject()}
                disabled={deleteDialogBusy}
              >
                {deleteDialogBusy ? '削除中...' : 'プロジェクトを削除'}
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
            プロジェクトを開く
          </button>
          <button
            className="danger"
            type="button"
            onClick={() => requestDeleteProject(projectContextMenu.project)}
          >
            プロジェクトを削除
          </button>
        </div>
      )}

      <main className="stack-dashboard-main">
        <header className="stack-dashboard-topbar">
          <div className="stack-breadcrumb">
            <span>クラウド</span>
            <span>/</span>
            <strong>ダッシュボード</strong>
          </div>

          <div className="stack-top-actions">
            <div className="stack-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="プロジェクトを検索"
              />
              <kbd>⌘ K</kbd>
            </div>
            <button className="stack-open-ide" onClick={() => navigate('/ide')}>
              IDEを開く
            </button>
          </div>
        </header>

        <div className="stack-dashboard-content">
          <section className="stack-welcome">
            <div>
              <span className="stack-eyebrow">POLIGO CLOUD</span>
              <h1>何かを作ろう。</h1>
              <p>テンプレートから始めるか、既存のプロジェクトを続けて編集できます。</p>
            </div>

          </section>

          <section id="projects" className="stack-section">
            <div className="stack-section-heading stack-project-heading">
              <div>
                <h2>最近のプロジェクト</h2>
              </div>
              <button
                className="stack-show-all"
                type="button"
                onClick={() => setQuery('')}
              >
                すべて表示
                <span>›</span>
              </button>
            </div>

            {projects.length ? (
              <div className="stack-project-table">
                <div className="stack-project-table-head">
                  <span aria-hidden="true" />
                  <span>タイトル</span>
                  <span>説明</span>
                  <span>ファイル</span>
                  <span>更新日時</span>
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
                        {getProject説明(project)}
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
                <h3>{query ? '一致するプロジェクトがありません' : 'プロジェクトはまだありません'}</h3>
                <p>{query ? '別の検索語を試してください。' : '上の新規プロジェクトから開発を始められます。'}</p>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
