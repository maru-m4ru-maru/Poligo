import { useEffect, useMemo, useState } from 'react'
import { authClient } from './auth-client'

const DEFAULT_STORAGE_LIMIT = 15 * 1024 * 1024

function navigate(path) {
  if (
    path === '/dashboard' ||
    path === '/account' ||
    path === '/admin' ||
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
      'workspace-' +
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).slice(2, 10)

    localStorage.setItem('poligo-workspace-id', workspaceId)
  }

  return workspaceId
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  if (value >= 10 || unit === 0) {
    return Math.round(value) + ' ' + units[unit]
  }

  return value.toFixed(1) + ' ' + units[unit]
}

export default function AccountPage({ session }) {
  const [usageBytes, setUsageBytes] = useState(0)
  const [storageLimitBytes, setStorageLimitBytes] = useState(DEFAULT_STORAGE_LIMIT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [adminSavingId, setAdminSavingId] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const usagePercent = useMemo(() => {
    if (!storageLimitBytes) return 0
    return Math.min((usageBytes / storageLimitBytes) * 100, 100)
  }, [storageLimitBytes, usageBytes])

  useEffect(() => {
    async function loadUsage() {
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
          throw new Error(
            result.error || '利用状況を読み込めませんでした'
          )
        }

        setUsageBytes(Number(result.stats?.storageBytes || 0))
        setStorageLimitBytes(
          Number(
            result.user?.storageLimitBytes ||
            DEFAULT_STORAGE_LIMIT
          )
        )
        setIsAdmin(result.user?.isAdmin === true)
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : '利用状況を読み込めませんでした'
        )
      } finally {
        setLoading(false)
      }
    }

    void loadUsage()
  }, [])

  useEffect(() => {
    if (!isAdmin) return

    async function loadAdminUsers() {
      setAdminLoading(true)
      setAdminError('')

      try {
        const response = await fetch('/api/admin/users', {
          credentials: 'include'
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            '管理対象ユーザーを読み込めませんでした'
          )
        }

        setAdminUsers(Array.isArray(result.users) ? result.users : [])
      } catch (reason) {
        setAdminError(
          reason instanceof Error
            ? reason.message
            : '管理対象ユーザーを読み込めませんでした'
        )
      } finally {
        setAdminLoading(false)
      }
    }

    void loadAdminUsers()
  }, [isAdmin])

  async function updateStorageLimit(userId, megabytes) {
    if (adminSavingId) return

    const value = Number(megabytes)

    if (!Number.isInteger(value) || value < 1 || value > 10240) {
      setAdminError('保存容量上限は1〜10240 MiBで指定してください。')
      return
    }

    setAdminSavingId(userId)
    setAdminError('')

    try {
      const response = await fetch(
        '/api/admin/users/' +
          encodeURIComponent(userId) +
          '/storage-limit',
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            limitBytes: value * 1024 * 1024
          })
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          '保存容量上限を変更できませんでした'
        )
      }

      setAdminUsers(current => current.map(user =>
        user.id === userId
          ? {
              ...user,
              storageLimitBytes: value * 1024 * 1024
            }
          : user
      ))
    } catch (reason) {
      setAdminError(
        reason instanceof Error
          ? reason.message
          : '保存容量上限を変更できませんでした'
      )
    } finally {
      setAdminSavingId('')
    }
  }

  async function resetStorageLimit(userId) {
    if (adminSavingId) return

    setAdminSavingId(userId)
    setAdminError('')

    try {
      const response = await fetch(
        '/api/admin/users/' +
          encodeURIComponent(userId) +
          '/storage-limit',
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          '保存容量上限を標準値に戻せませんでした'
        )
      }

      setAdminUsers(current => current.map(user =>
        user.id === userId
          ? {
              ...user,
              storageLimitBytes: DEFAULT_STORAGE_LIMIT
            }
          : user
      ))
    } catch (reason) {
      setAdminError(
        reason instanceof Error
          ? reason.message
          : '保存容量上限を標準値に戻せませんでした'
      )
    } finally {
      setAdminSavingId('')
    }
  }

  async function signOut() {
    await authClient.signOut()
    window.location.assign('/signin')
  }

  async function changePassword(event) {
    event.preventDefault()

    if (passwordBusy) return

    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 8) {
      setPasswordError('新しいパスワードは8文字以上にしてください。')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードが一致しません。')
      return
    }

    setPasswordBusy(true)

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true
      })

      if (result.error) {
        throw new Error(
          result.error.message ||
          'パスワードを変更できませんでした'
        )
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(
        'パスワードを変更しました。他のログインセッションは終了しました。'
      )
    } catch (reason) {
      setPasswordError(
        reason instanceof Error
          ? reason.message
          : 'パスワードを変更できませんでした'
      )
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <div className="stack-dashboard account-dashboard">
      <aside className="stack-sidebar">
        <button
          className="stack-sidebar-brand"
          onClick={() => navigate('/dashboard')}
        >
          <span className="account-brand-logo">
            <img src="/poligo-logo-dark.svg" alt="Poligo" />
          </span>
        </button>

        <button
          className="stack-new-button"
          onClick={() => navigate('/dashboard')}
        >
          <span>+</span>
          新規プロジェクト
        </button>

        <nav className="stack-sidebar-nav">
          <button
            onClick={() => navigate('/dashboard')}
          >
            <span className="stack-nav-icon">▦</span>
            プロジェクト
          </button>

          <button className="active">
            <span className="stack-nav-icon">◯</span>
            アカウント
          </button>

          {isAdmin && (
            <button onClick={() => navigate('/admin')}>
              <span className="stack-nav-icon">⚙</span>
              管理画面
            </button>
          )}
        </nav>

        <div className="stack-sidebar-bottom">
          <div className="stack-sidebar-user">
            <div className="stack-user-avatar">
              {(session?.user?.name || 'P').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{session?.user?.name || 'Poligo User'}</strong>
              <span>{session?.user?.email || ''}</span>
            </div>
          </div>

          <button className="stack-signout-button" onClick={signOut}>
            サインアウト
          </button>
        </div>
      </aside>

      <main className="stack-dashboard-main account-dashboard-main">
        <header className="stack-dashboard-topbar">
          <div className="stack-breadcrumb">
            <span>Poligo</span>
            <span>/</span>
            <strong>アカウント</strong>
          </div>

          <div className="stack-top-actions">
            <button
              className="stack-open-ide"
              onClick={() => navigate('/dashboard')}
            >
              ダッシュボードへ戻る
            </button>
          </div>
        </header>

        <div className="account-settings-content">
          <div className="account-settings-heading">
            <span>ACCOUNT</span>
            <h1>アカウント設定</h1>
            <p>アカウント情報、保存容量、セキュリティを管理します。</p>
          </div>

          <section className="account-settings-section">
            <div className="account-settings-section-head">
              <div>
                <span>STORAGE</span>
                <h2>利用状況</h2>
              </div>

              <strong>
                {formatBytes(usageBytes)}
                <small> / {formatBytes(storageLimitBytes)}</small>
              </strong>
            </div>

            <div className="account-settings-storage-track">
              <div
                className="account-settings-storage-fill"
                style={{ width: usagePercent + '%' }}
              />
            </div>

            <div className="account-settings-storage-meta">
              <span>
                {loading
                  ? '読み込み中...'
                  : usagePercent < 0.01
                    ? '0% 使用中'
                    : usagePercent.toFixed(2) + '% 使用中'}
              </span>
              <span>上限 {formatBytes(storageLimitBytes)}</span>
            </div>

            {error && (
              <p className="account-settings-error">{error}</p>
            )}

            {!loading && !error && usageBytes > storageLimitBytes && (
              <p className="account-settings-warning">
                保存容量の上限を超えています。追加容量については運営者へご相談ください。
              </p>
            )}
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-head">
              <div>
                <span>PROFILE</span>
                <h2>アカウント情報</h2>
              </div>
            </div>

            <div className="account-settings-profile">
              <div className="account-settings-profile-row">
                <span>ユーザー名</span>
                <strong>{session?.user?.username || '未設定'}</strong>
              </div>
              <div className="account-settings-profile-row">
                <span>表示名</span>
                <strong>{session?.user?.name || '未設定'}</strong>
              </div>
              <div className="account-settings-profile-row">
                <span>メールアドレス</span>
                <strong>{session?.user?.email || '未設定'}</strong>
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="account-settings-section account-settings-admin">
              <div className="account-settings-section-head">
                <div>
                  <span>ADMINISTRATION</span>
                  <h2>ユーザー保存容量</h2>
                </div>
                <strong>
                  標準 {formatBytes(DEFAULT_STORAGE_LIMIT)}
                </strong>
              </div>

              <p className="account-settings-note">
                1〜10240 MiBの範囲で、アカウントごとの保存容量上限を変更できます。変更はサーバー側で強制されます。
              </p>

              {adminLoading && (
                <p className="account-settings-note">ユーザー一覧を読み込み中...</p>
              )}

              {adminError && (
                <p className="account-settings-error">{adminError}</p>
              )}

              {!adminLoading && !adminError && (
                <div className="account-settings-admin-list">
                  {adminUsers.map(user => {
                    const limitMiB = Math.round(
                      user.storageLimitBytes / (1024 * 1024)
                    )
                    const usageMiB = (
                      user.storageBytes / (1024 * 1024)
                    ).toFixed(1)

                    return (
                      <div
                        key={user.id}
                        className="account-settings-admin-row"
                      >
                        <div className="account-settings-admin-user">
                          <strong>{user.name || '未設定'}</strong>
                          <span>{user.email}</span>
                          <small>
                            {usageMiB} MiB 使用中
                            {user.isAdmin ? ' / 管理者' : ''}
                          </small>
                        </div>

                        <div className="account-settings-admin-control">
                          <input
                            type="number"
                            min="1"
                            max="10240"
                            step="1"
                            value={limitMiB}
                            onChange={event => {
                              const value = Number(event.target.value)
                              setAdminUsers(current => current.map(item =>
                                item.id === user.id
                                  ? {
                                      ...item,
                                      storageLimitBytes:
                                        (Number.isFinite(value) ? value : 1) *
                                        1024 *
                                        1024
                                    }
                                  : item
                              ))
                            }}
                            aria-label={user.email + ' 保存容量上限 MiB'}
                            disabled={adminSavingId === user.id}
                          />
                          <span>MiB</span>
                          <button
                            type="button"
                            className="account-settings-inline-button"
                            onClick={() => void updateStorageLimit(
                              user.id,
                              limitMiB
                            )}
                            disabled={adminSavingId === user.id}
                          >
                            {adminSavingId === user.id ? '保存中...' : '保存'}
                          </button>
                          <button
                            type="button"
                            className="account-settings-inline-button secondary"
                            onClick={() => void resetStorageLimit(user.id)}
                            disabled={adminSavingId === user.id}
                          >
                            標準値
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          <section className="account-settings-section">
            <div className="account-settings-section-head">
              <div>
                <span>SECURITY</span>
                <h2>パスワードを変更</h2>
              </div>
            </div>

            <form
              className="account-settings-password"
              onSubmit={changePassword}
            >
              <label>
                <span>現在のパスワード</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              <label>
                <span>新しいパスワード</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              <label>
                <span>新しいパスワード（確認）</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              {passwordError && (
                <p className="account-settings-error">{passwordError}</p>
              )}

              {passwordSuccess && (
                <p className="account-settings-success">{passwordSuccess}</p>
              )}

              <button
                className="account-settings-submit"
                type="submit"
                disabled={passwordBusy}
              >
                {passwordBusy
                  ? '変更中...'
                  : 'パスワードを変更'}
              </button>
            </form>

            <p className="account-settings-note">
              パスワード変更後は、他のログインセッションを終了します。
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
