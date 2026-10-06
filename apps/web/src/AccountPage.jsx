import { useEffect, useMemo, useState } from 'react'
import { authClient } from './auth-client'

const STORAGE_LIMIT = 15 * 1024 * 1024

function navigate(path) {
  if (
    path === '/dashboard' ||
    path === '/account' ||
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const usagePercent = useMemo(() => {
    return Math.min((usageBytes / STORAGE_LIMIT) * 100, 100)
  }, [usageBytes])

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
          throw new Error(result.error || '利用状況を読み込めませんでした')
        }

        setUsageBytes(Number(result.stats?.storageBytes || 0))
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
        throw new Error(result.error.message || 'パスワードを変更できませんでした')
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
    <div className="account-page">
      <header className="account-topbar">
        <button className="account-brand" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>

        <div className="account-top-actions">
          <button onClick={() => navigate('/dashboard')}>
            ダッシュボード
          </button>
          <button onClick={() => navigate('/')}>
            ホーム
          </button>
        </div>
      </header>

      <main className="account-main">
        <div className="account-heading">
          <span>ACCOUNT</span>
          <h1>アカウント</h1>
          <p>アカウント情報と保存容量を管理します。</p>
        </div>

        <section className="account-card account-storage-card">
          <div className="account-card-heading">
            <div>
              <span>STORAGE</span>
              <h2>利用状況</h2>
            </div>
            <strong>
              {formatBytes(usageBytes)}
              <small> / 15 MB</small>
            </strong>
          </div>

          <div className="account-storage-track">
            <div
              className="account-storage-fill"
              style={{ width: usagePercent + '%' }}
            />
          </div>

          <div className="account-storage-meta">
            <span>
              {usagePercent < 0.01
                ? '0%'
                : usagePercent.toFixed(2) + '%'} 使用中
            </span>
            <span>上限 15 MB</span>
          </div>

          {error && (
            <p className="account-inline-error">{error}</p>
          )}

          {!loading && !error && usageBytes > STORAGE_LIMIT && (
            <p className="account-inline-warning">
              保存容量の上限を超えています。追加容量については運営者へご相談ください。
            </p>
          )}
        </section>

        <section className="account-card">
          <div className="account-card-heading">
            <div>
              <span>PROFILE</span>
              <h2>アカウント情報</h2>
            </div>
          </div>

          <div className="account-profile-grid">
            <div>
              <span>表示名</span>
              <strong>{session?.user?.name || '未設定'}</strong>
            </div>
            <div>
              <span>メールアドレス</span>
              <strong>{session?.user?.email || '未設定'}</strong>
            </div>
          </div>
        </section>

        <section className="account-card">
          <div className="account-card-heading">
            <div>
              <span>SECURITY</span>
              <h2>パスワードを変更</h2>
            </div>
          </div>

          <form className="account-password-form" onSubmit={changePassword}>
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
              <p className="account-inline-error">{passwordError}</p>
            )}

            {passwordSuccess && (
              <p className="account-inline-success">{passwordSuccess}</p>
            )}

            <button
              className="account-password-submit"
              type="submit"
              disabled={passwordBusy}
            >
              {passwordBusy ? '変更中...' : 'パスワードを変更'}
            </button>
          </form>
        </section>

        <p className="account-security-note">
          パスワード変更時は、現在のパスワードを確認します。
          セキュリティのため、変更後は他のログインセッションを終了します。
        </p>
      </main>
    </div>
  )
}
