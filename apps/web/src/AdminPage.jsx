import { useEffect, useMemo, useState } from 'react'

const DEFAULT_STORAGE_LIMIT_MIB = 15

function navigate(path) {
  if (path === '/dashboard' || path === '/account' || path === '/admin') {
    window.history.pushState({}, '', '/')
    window.location.hash = path
    return
  }

  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(result.error || 'リクエストに失敗しました。')
  }

  return result
}

function formatDate(value) {
  if (!value) return '不明'
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime()) ? '不明' : date.toLocaleString('ja-JP')
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KiB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MiB'
}

export default function AdminPage({ session }) {
  const [users, setUsers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [search, setSearch] = useState('')
  const [storageDrafts, setStorageDrafts] = useState({})
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')

    try {
      const [userResult, announcementResult] = await Promise.all([
        requestJson('/api/admin/users'),
        requestJson('/api/admin/announcements')
      ])

      const nextUsers = Array.isArray(userResult.users) ? userResult.users : []
      setUsers(nextUsers)
      setStorageDrafts(Object.fromEntries(nextUsers.map(user => [
        user.id,
        Math.round(Number(user.storageLimitBytes || 15 * 1024 * 1024) / (1024 * 1024))
      ])))
      setAnnouncements(Array.isArray(announcementResult.announcements)
        ? announcementResult.announcements
        : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '管理データを読み込めませんでした。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return users
    return users.filter(user =>
      String(user.name || '').toLowerCase().includes(needle) ||
      String(user.email || '').toLowerCase().includes(needle) ||
      String(user.id || '').toLowerCase().includes(needle)
    )
  }, [search, users])

  async function saveStorageLimit(user) {
    const value = Number(storageDrafts[user.id])
    if (!Number.isInteger(value) || value < 1 || value > 10240) {
      setError('保存容量上限は1〜10240 MiBで指定してください。')
      return
    }

    setSavingKey(user.id)
    setError('')
    setSuccess('')

    try {
      const result = await requestJson(
        '/api/admin/users/' + encodeURIComponent(user.id) + '/storage-limit',
        {
          method: 'PUT',
          body: JSON.stringify({ limitBytes: value * 1024 * 1024 })
        }
      )
      setUsers(current => current.map(item =>
        item.id === user.id
          ? { ...item, storageLimitBytes: result.user.storageLimitBytes }
          : item
      ))
      setSuccess(user.email + ' の保存容量上限を ' + value + ' MiB に変更しました。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存容量上限を変更できませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function resetStorageLimit(user) {
    setSavingKey(user.id)
    setError('')
    setSuccess('')

    try {
      await requestJson(
        '/api/admin/users/' + encodeURIComponent(user.id) + '/storage-limit',
        { method: 'DELETE' }
      )
      setStorageDrafts(current => ({ ...current, [user.id]: DEFAULT_STORAGE_LIMIT_MIB }))
      setUsers(current => current.map(item =>
        item.id === user.id
          ? { ...item, storageLimitBytes: DEFAULT_STORAGE_LIMIT_MIB * 1024 * 1024 }
          : item
      ))
      setSuccess(user.email + ' の保存容量上限を標準値に戻しました。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存容量上限を戻せませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function updateBan(user) {
    const banned = !user.isBanned
    const reason = banned
      ? window.prompt('BAN理由を入力してください。', '利用規約違反')
      : ''

    if (banned && reason === null) return

    setSavingKey(user.id)
    setError('')
    setSuccess('')

    try {
      const result = await requestJson(
        '/api/admin/users/' + encodeURIComponent(user.id) + '/ban',
        {
          method: 'PUT',
          body: JSON.stringify({ banned, reason: reason || '' })
        }
      )
      setUsers(current => current.map(item =>
        item.id === user.id
          ? { ...item, isBanned: result.user.isBanned, banReason: result.user.banReason }
          : item
      ))
      setSuccess(banned
        ? user.email + ' をBANし、ログインセッションを無効化しました。'
        : user.email + ' のBANを解除しました。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'BAN状態を変更できませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function updateVerification(user) {
    const verified = !user.emailVerified
    setSavingKey(user.id)
    setError('')
    setSuccess('')

    try {
      const result = await requestJson(
        '/api/admin/users/' + encodeURIComponent(user.id) + '/verification',
        {
          method: 'PUT',
          body: JSON.stringify({ verified })
        }
      )
      setUsers(current => current.map(item =>
        item.id === user.id
          ? { ...item, emailVerified: result.user.emailVerified }
          : item
      ))
      setSuccess(user.email + (verified ? ' を認証済みに設定しました。' : ' の認証済み設定を解除しました。'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '認証状態を変更できませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function sendAnnouncement(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!title.trim() || !message.trim()) {
      setError('タイトルと本文を入力してください。')
      return
    }

    setSavingKey('announcement')
    try {
      await requestJson('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetUserId: targetUserId || null
        })
      })
      setTitle('')
      setMessage('')
      setSuccess(targetUserId ? '個別のお知らせを送信しました。' : '全体向けのお知らせを送信しました。')
      const result = await requestJson('/api/admin/announcements')
      setAnnouncements(Array.isArray(result.announcements) ? result.announcements : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'お知らせを送信できませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function deleteAnnouncement(item) {
    if (!window.confirm('このお知らせを非表示にしますか？')) return

    setSavingKey('announcement-' + item.id)
    setError('')
    setSuccess('')

    try {
      await requestJson('/api/admin/announcements/' + encodeURIComponent(item.id), {
        method: 'DELETE'
      })
      setAnnouncements(current => current.filter(entry => entry.id !== item.id))
      setSuccess('お知らせを非表示にしました。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'お知らせを削除できませんでした。')
    } finally {
      setSavingKey('')
    }
  }

  async function signOut() {
    const { authClient } = await import('./auth-client')
    await authClient.signOut()
    window.location.assign('/signin')
  }

  return (
    <div className="stack-dashboard account-dashboard admin-dashboard">
      <aside className="stack-sidebar">
        <button className="stack-sidebar-brand" onClick={() => navigate('/dashboard')}>
          <span className="account-brand-logo">
            <img src="/poligo-logo-dark.svg" alt="Poligo" />
          </span>
        </button>
        <button className="stack-new-button" onClick={() => navigate('/dashboard')}>
          <span>‹</span>
          ダッシュボード
        </button>
        <nav className="stack-sidebar-nav">
          <button onClick={() => navigate('/dashboard')}>
            <span className="stack-nav-icon">▦</span>
            プロジェクト
          </button>
          <button onClick={() => navigate('/account')}>
            <span className="stack-nav-icon">◯</span>
            アカウント
          </button>
          <button className="active" type="button">
            <span className="stack-nav-icon">⚙</span>
            管理画面
          </button>
        </nav>
        <div className="stack-sidebar-bottom">
          <div className="stack-sidebar-user">
            <div className="stack-user-avatar">{(session?.user?.name || 'P').slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{session?.user?.name || 'Poligo User'}</strong>
              <span>{session?.user?.email || ''}</span>
            </div>
          </div>
          <button className="stack-signout-button" onClick={signOut}>サインアウト</button>
        </div>
      </aside>

      <main className="stack-dashboard-main account-dashboard-main">
        <header className="stack-dashboard-topbar">
          <div className="stack-breadcrumb">
            <span>Poligo</span><span>/</span><strong>管理画面</strong>
          </div>
          <div className="stack-top-actions">
            <button className="stack-open-ide" onClick={() => navigate('/dashboard')}>ダッシュボードへ戻る</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="account-settings-heading">
            <span>ADMINISTRATION</span>
            <h1>管理画面</h1>
            <p>ユーザー管理、アクセス制御、保存容量、お知らせを一元管理します。</p>
          </div>

          {error && <p className="account-settings-error" role="alert">{error}</p>}
          {success && <p className="account-settings-success" role="status">{success}</p>}

          <section className="account-settings-section">
            <div className="account-settings-section-head">
              <div><span>USERS</span><h2>ユーザー管理</h2></div>
              <strong>{users.length} アカウント</strong>
            </div>
            <div className="admin-user-toolbar">
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ユーザー名・メール・IDを検索" aria-label="ユーザー検索" />
              <button type="button" className="account-settings-inline-button" onClick={() => void loadAll()} disabled={loading}>再読み込み</button>
            </div>

            {loading ? <p className="account-settings-note">ユーザーを読み込み中...</p> : (
              <div className="admin-user-list">
                {filteredUsers.map(user => {
                  const draft = storageDrafts[user.id] ?? DEFAULT_STORAGE_LIMIT_MIB
                  const saving = savingKey === user.id
                  return (
                    <article className="admin-user-card" key={user.id}>
                      <div className="admin-user-identity">
                        <div>
                          <strong>{user.username ? '@' + user.username : 'ユーザー名未設定'}</strong>
                          <span>{user.name || '表示名未設定'} · {user.email}</span>
                          <small>ID: {user.id}</small>
                          <small>登録: {formatDate(user.createdAt)} · 使用量: {formatBytes(user.storageBytes)} / {formatBytes(user.storageLimitBytes)}</small>
                          {user.banReason && <small>BAN理由: {user.banReason}</small>}
                        </div>
                        <div className="admin-user-badges">
                          {user.isAdmin && <span className="admin-status admin-status-admin">管理者</span>}
                          <span className={'admin-status ' + (user.emailVerified ? 'admin-status-ok' : 'admin-status-muted')}>{user.emailVerified ? '認証済み' : '未認証'}</span>
                          <span className={'admin-status ' + (user.isBanned ? 'admin-status-banned' : 'admin-status-ok')}>{user.isBanned ? 'BAN中' : '有効'}</span>
                        </div>
                      </div>
                      <div className="admin-user-controls">
                        <label>
                          <span>保存容量上限</span>
                          <input type="number" min="1" max="10240" step="1" value={draft} onChange={event => setStorageDrafts(current => ({ ...current, [user.id]: event.target.value }))} aria-label={user.email + ' 保存容量上限 MiB'} disabled={saving} />
                          <small>MiB</small>
                        </label>
                        <button type="button" className="account-settings-inline-button" onClick={() => void saveStorageLimit(user)} disabled={saving}>保存</button>
                        <button type="button" className="account-settings-inline-button secondary" onClick={() => void resetStorageLimit(user)} disabled={saving}>標準値</button>
                        <button type="button" className="account-settings-inline-button" onClick={() => void updateVerification(user)} disabled={saving || user.isAdmin}>{user.emailVerified ? '認証解除' : '認証済みにする'}</button>
                        <button type="button" className={'account-settings-inline-button ' + (user.isBanned ? '' : 'admin-ban-button')} onClick={() => void updateBan(user)} disabled={saving || user.isAdmin || user.id === session?.user?.id}>{user.isBanned ? 'BAN解除' : 'BAN'}</button>
                      </div>
                    </article>
                  )
                })}
                {!filteredUsers.length && <p className="account-settings-note">条件に一致するユーザーはいません。</p>}
              </div>
            )}
          </section>

          <section className="account-settings-section">
            <div className="account-settings-section-head">
              <div><span>ANNOUNCEMENTS</span><h2>お知らせを送信</h2></div>
            </div>
            <form className="admin-announcement-form" onSubmit={sendAnnouncement}>
              <label><span>送信先</span>
                <select value={targetUserId} onChange={event => setTargetUserId(event.target.value)}>
                  <option value="">全ユーザーに送信</option>
                  {users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
                </select>
              </label>
              <label><span>タイトル</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required /></label>
              <label><span>本文</span><textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={5000} rows={4} required /></label>
              <button className="account-settings-submit" type="submit" disabled={savingKey === 'announcement'}>{savingKey === 'announcement' ? '送信中...' : targetUserId ? '個別のお知らせを送信' : '全体にお知らせを送信'}</button>
            </form>
            <div className="admin-announcement-list">
              <h3>送信済みのお知らせ</h3>
              {announcements.map(item => (
                <article className="admin-announcement-row" key={item.id}>
                  <div><strong>{item.title}</strong><p>{item.message}</p><small>{item.isGlobal ? '全体向け' : '個別: ' + (item.targetUserEmail || item.targetUserId)} · {formatDate(item.createdAt)}</small></div>
                  <button className="account-settings-inline-button secondary" type="button" onClick={() => void deleteAnnouncement(item)} disabled={savingKey === 'announcement-' + item.id}>非表示</button>
                </article>
              ))}
              {!announcements.length && <p className="account-settings-note">まだお知らせはありません。</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
