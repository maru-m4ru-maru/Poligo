import { useCallback, useEffect, useState } from 'react'
import CommunityIcon from './CommunityIcon.jsx'

const API_URL = import.meta.env.VITE_API_URL || ''

async function api(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText || 'Community request failed')
  return body
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default function CommunityNotifications({ session, onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSignedIn = Boolean(session?.user?.id)

  const load = useCallback(async () => {
    if (!isSignedIn) {
      setNotifications([])
      onUnreadCountChange?.(0)
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await api('/api/community/notifications')
      const items = (result.notifications || []).filter(item => !String(item.kind || '').startsWith('team_') && !['team', 'team_invite'].includes(item.resource_type))
      setNotifications(items)
      onUnreadCountChange?.(Number(result.unreadCount || 0))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '通知を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, onUnreadCountChange])

  useEffect(() => {
    void load()
  }, [load])

  async function updateNotification(notification, action) {
    setBusy(true)
    setError('')
    try {
      await api('/api/community/notifications/' + encodeURIComponent(notification.id) + '/' + action, { method: 'POST' })
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '通知を更新できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="community-notifications">
      <div className="community-feed-heading community-notifications-heading">
        <div>
          <span className="community-section-kicker">YOUR INBOX</span>
          <h1>通知</h1>
          <p>作品へのスターやコメントなど、コミュニティの動きを確認できます。</p>
        </div>
        <button type="button" className="community-view-all" onClick={() => void load()} disabled={loading}><CommunityIcon name="refresh" size={14} /> 更新</button>
      </div>

      {error && <p className="community-error" role="alert"><span className="community-error-mark">!</span>{error}</p>}

      {!isSignedIn ? (
        <div className="community-empty">
          <div className="community-empty-icon"><CommunityIcon name="bell" size={24} /></div>
          <h3>通知を確認するにはログインしてください</h3>
          <p>ログインすると、作品への反応をここで確認できます。</p>
          <button type="button" className="community-primary-button" onClick={() => { window.location.href = '/signin' }}>ログイン</button>
        </div>
      ) : loading ? (
        <div className="community-loading" role="status"><span className="community-loading-indicator" /><span>通知を読み込んでいます</span></div>
      ) : notifications.length ? (
        <div className="community-notification-list">
          {notifications.map(notification => (
            <article key={notification.id} className={'community-notification-card' + (notification.is_read ? '' : ' is-unread')}>
              <span className="community-notification-card-icon"><CommunityIcon name={notification.kind === 'project_star' ? 'star' : notification.kind === 'project_comment' ? 'code' : 'bell'} size={18} /></span>
              <div className="community-notification-card-content">
                <span className="community-notification-card-type">{notification.kind === 'project_star' ? 'スター' : notification.kind === 'project_comment' ? 'コメント' : 'お知らせ'}</span>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                <small>{notification.actor_name} ・ {formatDate(notification.created_at)}</small>
              </div>
              <div className="community-notification-card-actions">
                {!notification.is_read && <button type="button" onClick={() => void updateNotification(notification, 'read')} disabled={busy}><CommunityIcon name="check" size={13} />既読</button>}
                <button type="button" onClick={() => void updateNotification(notification, 'hide')} disabled={busy} aria-label="通知を非表示"><CommunityIcon name="close" size={13} />非表示</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="community-empty">
          <div className="community-empty-icon"><CommunityIcon name="inbox" size={24} /></div>
          <h3>新しい通知はありません</h3>
          <p>作品にスターやコメントが付くと、ここに届きます。</p>
        </div>
      )}
    </section>
  )
}
