import { useCallback, useEffect, useMemo, useState } from 'react'
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

function TeamTag({ children, tone = '', icon }) {
  return <span className={'community-team-tag' + (tone ? ' ' + tone : '')}>{icon && <CommunityIcon name={icon} size={12} className="community-team-tag-icon" />}<span>{children}</span></span>
}

export default function CommunityTeamHub({ mode, session, onNavigate, onUnreadCountChange }) {
  const [teams, setTeams] = useState([])
  const [teamQuery, setTeamQuery] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [notifications, setNotifications] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)
  const [messages, setMessages] = useState([])
  const [dmRecipient, setDmRecipient] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageKind, setMessageKind] = useState('message')
  const [inviteeCode, setInviteeCode] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createVisibility, setCreateVisibility] = useState('public')
  const [createJoinPolicy, setCreateJoinPolicy] = useState('manual')
  const [teamSettings, setTeamSettings] = useState({ name: '', description: '', visibility: 'public', joinPolicy: 'manual' })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false)

  const isSignedIn = Boolean(session?.user?.id)
  const isManager = ['owner', 'admin'].includes(activeTeam?.team?.my_role)
  const isOwner = activeTeam?.team?.my_role === 'owner'
  const activeMembers = activeTeam?.members || []

  const loadTeams = useCallback(async (search = teamQuery) => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/community/teams?q=' + encodeURIComponent(search.trim()))
      setTeams(result.teams || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'チーム一覧を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [teamQuery])

  const loadNotifications = useCallback(async () => {
    if (!isSignedIn) {
      setNotifications([])
      onUnreadCountChange?.(0)
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await api('/api/community/notifications')
      setNotifications(result.notifications || [])
      onUnreadCountChange?.(Number(result.unreadCount || 0))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '通知を読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, onUnreadCountChange])

  const loadInviteCode = useCallback(async () => {
    if (!isSignedIn) {
      setInviteCode('')
      return
    }
    try {
      const result = await api('/api/community/invitation-code')
      setInviteCode(result.inviteCode || '')
    } catch {
      setInviteCode('')
    }
  }, [isSignedIn])

  const openTeam = useCallback(async teamId => {
    setLoading(true)
    setError('')
    setNotice('')
    setConfirmDeleteTeam(false)
    try {
      const result = await api('/api/community/teams/' + encodeURIComponent(teamId))
      setActiveTeam(result)
      setTeamSettings({
        name: result.team.name || '',
        description: result.team.description || '',
        visibility: result.team.visibility || 'public',
        joinPolicy: result.team.join_policy || 'manual'
      })
      setDmRecipient('')
      setInviteeCode('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'チームを開けませんでした')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async () => {
    if (!activeTeam?.team?.id || !activeTeam?.team?.my_role) {
      setMessages([])
      return
    }
    try {
      const suffix = dmRecipient ? '?recipientId=' + encodeURIComponent(dmRecipient) : ''
      const result = await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/messages' + suffix)
      setMessages(result.messages || [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'メッセージを読み込めませんでした')
      setMessages([])
    }
  }, [activeTeam?.team?.id, activeTeam?.team?.my_role, dmRecipient])

  useEffect(() => {
    setError('')
    setNotice('')
    if (mode === 'notifications') void loadNotifications()
    if (mode === 'teams') {
      void loadTeams('')
      if (isSignedIn) void loadInviteCode()
    }
  }, [mode, isSignedIn, loadInviteCode, loadNotifications, loadTeams])

  useEffect(() => {
    if (mode === 'teams' && activeTeam?.team?.id) void loadMessages()
  }, [mode, activeTeam?.team?.id, dmRecipient, loadMessages])

  const teamCountLabel = useMemo(() => {
    const joined = teams.filter(team => Boolean(team.my_role)).length
    return joined + ' 参加中'
  }, [teams])

  async function createTeam(event) {
    event.preventDefault()
    if (!isSignedIn) {
      window.location.href = '/signin'
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api('/api/community/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: createName,
          description: createDescription,
          visibility: createVisibility,
          joinPolicy: createVisibility === 'private' ? 'manual' : createJoinPolicy
        })
      })
      setCreateOpen(false)
      setCreateName('')
      setCreateDescription('')
      setNotice('チームを作成しました。')
      await loadTeams('')
      await openTeam(result.team.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'チームを作成できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function joinTeam(team) {
    if (!isSignedIn) {
      window.location.href = '/signin'
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api('/api/community/teams/' + encodeURIComponent(team.id) + '/join', { method: 'POST' })
      setNotice(result.joined ? 'チームに参加しました。' : '参加申請を送信しました。')
      await loadTeams()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '参加できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function sendInvite(event) {
    event.preventDefault()
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/invites', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteeCode })
      })
      setInviteeCode('')
      setNotice('招待通知を送信しました。相手は通知BOXから承認できます。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '招待を送信できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function saveTeamSettings(event) {
    event.preventDefault()
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id), {
        method: 'PATCH',
        body: JSON.stringify({
          name: teamSettings.name,
          description: teamSettings.description,
          visibility: teamSettings.visibility,
          joinPolicy: teamSettings.joinPolicy
        })
      })
      setNotice('チーム設定を保存しました。')
      await openTeam(activeTeam.team.id)
      await loadTeams()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '設定を保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function decideJoinRequest(requestId, action) {
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/requests/' + encodeURIComponent(requestId), {
        method: 'PATCH',
        body: JSON.stringify({ action })
      })
      setNotice(action === 'approve' ? '参加申請を承認しました。' : '参加申請を拒否しました。')
      await openTeam(activeTeam.team.id)
      await loadTeams()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '参加申請を処理できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!activeTeam?.team?.id || !messageBody.trim()) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/messages', {
        method: 'POST',
        body: JSON.stringify({
          body: messageBody,
          kind: dmRecipient ? 'dm' : messageKind,
          ...(dmRecipient ? { recipientId: dmRecipient } : {})
        })
      })
      setMessageBody('')
      await loadMessages()
      if (!dmRecipient) setNotice(messageKind === 'announcement' ? '全体通知を送信しました。' : 'メッセージを送信しました。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'メッセージを送信できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function leaveTeam() {
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/leave', { method: 'POST' })
      setActiveTeam(null)
      setNotice('チームを退出しました。')
      await loadTeams()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'チームを退出できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function deleteTeam() {
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id), { method: 'DELETE' })
      setActiveTeam(null)
      setConfirmDeleteTeam(false)
      setNotice('チームを削除しました。')
      await loadTeams()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'チームを削除できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function changeMemberRole(member, role) {
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/members/' + encodeURIComponent(member.user_id), {
        method: 'PATCH',
        body: JSON.stringify({ role })
      })
      setNotice(member.display_name + ' の役割を変更しました。')
      await openTeam(activeTeam.team.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '役割を変更できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member) {
    if (!activeTeam?.team?.id) return
    setBusy(true)
    setError('')
    try {
      await api('/api/community/teams/' + encodeURIComponent(activeTeam.team.id) + '/members/' + encodeURIComponent(member.user_id), { method: 'DELETE' })
      setNotice(member.display_name + ' をチームから外しました。')
      await openTeam(activeTeam.team.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'メンバーを外せませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function markNotification(notification, action = 'read') {
    try {
      await api('/api/community/notifications/' + encodeURIComponent(notification.id) + '/' + action, { method: 'POST' })
      await loadNotifications()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '通知を更新できませんでした')
    }
  }

  async function respondToInvite(notification, action) {
    setBusy(true)
    setError('')
    try {
      await api('/api/community/invites/' + encodeURIComponent(notification.resource_id) + '/' + action, { method: 'POST' })
      setNotice(action === 'accept' ? 'チームへの招待を承認しました。' : 'チームへの招待を辞退しました。')
      await loadNotifications()
      if (action === 'accept') {
        await loadTeams('')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '招待を処理できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function openNotification(notification) {
    if (notification.resource_type === 'team' && notification.resource_id) {
      await markNotification(notification, 'read')
      await openTeam(notification.resource_id)
      onNavigate?.('teams')
    } else {
      await markNotification(notification, 'read')
    }
  }

  const renderNotifications = () => (
    <section className="community-team-section">
      <div className="community-team-section-heading">
        <div>
          <span className="community-section-kicker">INBOX</span>
          <h2><span className="community-team-heading-icon"><CommunityIcon name="inbox" size={21} /></span>通知BOX</h2>
          <p>招待、作品への反応、チームの活動がここに届きます。</p>
        </div>
        <button type="button" className="community-team-button is-secondary" onClick={() => void loadNotifications()} disabled={loading}><CommunityIcon name="refresh" size={14} />更新</button>
      </div>
      {!isSignedIn ? (
        <div className="community-team-empty">
          <h3>通知を確認するにはログインしてください</h3>
          <p>チーム招待は通知BOXで承認できます。</p>
          <button type="button" className="community-team-button" onClick={() => { window.location.href = '/signin' }}>ログイン</button>
        </div>
      ) : loading ? (
        <div className="community-team-loading">通知を読み込んでいます...</div>
      ) : notifications.length ? (
        <div className="community-notification-list">
          {notifications.map(notification => (
            <article key={notification.id} className={'community-notification' + (notification.is_read ? '' : ' is-unread')}>
              <button type="button" className="community-notification-content" onClick={() => void openNotification(notification)}>
                <span className="community-notification-icon">
                  <CommunityIcon name={notification.kind === 'team_invite' ? 'mail' : notification.kind === 'project_star' ? 'star' : notification.kind === 'project_comment' ? 'comment' : notification.kind === 'team_dm' ? 'message' : notification.kind === 'team_announcement' ? 'bell' : 'users'} size={18} />
                </span>
                <span className="community-notification-copy">
                  <span className="community-notification-type">{notification.kind === 'team_invite' ? 'チーム招待' : notification.kind === 'project_star' ? 'スター' : notification.kind === 'project_comment' ? 'コメント' : notification.kind === 'team_dm' ? 'DM' : notification.kind === 'team_announcement' ? '全体通知' : 'チーム活動'}</span>
                  <strong>{notification.title}</strong>
                  <span className="community-notification-body">{notification.body}</span>
                  <small>{notification.actor_name} ・ {formatDate(notification.created_at)}</small>
                </span>
              </button>
              {notification.kind === 'team_invite' ? (
                <div className="community-notification-actions">
                  <button type="button" className="community-team-button" disabled={busy} onClick={() => void respondToInvite(notification, 'accept')}><CommunityIcon name="check" size={13} />承認する</button>
                  <button type="button" className="community-team-button is-secondary" disabled={busy} onClick={() => void respondToInvite(notification, 'decline')}><CommunityIcon name="close" size={13} />辞退</button>
                  <button type="button" className="community-notification-hide" onClick={() => void markNotification(notification, 'hide')}><CommunityIcon name="close" size={12} />非表示</button>
                </div>
              ) : (
                <div className="community-notification-actions">
                  {!notification.is_read && <button type="button" className="community-team-button is-secondary" onClick={() => void markNotification(notification, 'read')}><CommunityIcon name="check" size={13} />既読にする</button>}
                  <button type="button" className="community-notification-hide" onClick={() => void markNotification(notification, 'hide')}><CommunityIcon name="close" size={12} />非表示</button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="community-team-empty">
          <h3>新しい通知はありません</h3>
          <p>チーム招待、コメント、スター、チームの活動があるとここに届きます。</p>
        </div>
      )}
    </section>
  )

  const renderTeamDetail = () => {
    const team = activeTeam.team
    const requests = activeTeam.requests || []
    const joined = Boolean(team.my_role)
    const selectedDmMember = activeMembers.find(member => member.user_id === dmRecipient)

    return (
      <section className="community-team-detail">
        <button type="button" className="community-team-back" onClick={() => { setActiveTeam(null); setMessages([]); void loadTeams('') }}><CommunityIcon name="chevron-right" size={14} className="community-icon-back" />チーム一覧に戻る</button>
        <header className="community-team-detail-header">
          <div>
            <div className="community-team-tags">
              <TeamTag tone={team.visibility === 'private' ? 'is-private' : 'is-public'} icon={team.visibility === 'private' ? 'lock' : 'globe'}>{team.visibility === 'private' ? '非公開チーム' : '公開チーム'}</TeamTag>
              <TeamTag icon={joined ? team.my_role === 'owner' || team.my_role === 'admin' ? 'shield' : 'users' : 'user-check'}>{joined ? team.my_role === 'owner' ? 'オーナー' : team.my_role === 'admin' ? '管理者' : 'メンバー' : team.join_policy === 'auto' ? '自動承認' : '管理者承認'}</TeamTag>
            </div>
            <h2><span className="community-team-detail-mark"><CommunityIcon name="team" size={24} /></span>{team.name}</h2>
            <p>{team.description || 'このチームにはまだ説明がありません。'}</p>
            <small>{Number(team.member_count || 0)} メンバー ・ 作成者 {team.owner_name}</small>
          </div>
          {!joined && team.visibility === 'public' && (
            <button type="button" className="community-team-button" disabled={busy || team.my_request_status === 'pending'} onClick={() => void joinTeam(team)}>
              {team.my_request_status === 'pending' ? '参加申請中' : team.join_policy === 'auto' ? '参加する' : '参加を申請'}
            </button>
          )}
        </header>

        {joined && (
          <div className="community-team-detail-grid">
            <div className="community-team-column">
              <section className="community-team-panel">
                <div className="community-team-panel-heading"><h3><CommunityIcon name="message" size={16} />チームメッセージ</h3><span>最大100件</span></div>
                <div className="community-team-channel-tabs">
                  <button type="button" className={!dmRecipient ? 'active' : ''} onClick={() => setDmRecipient('')}><CommunityIcon name="message" size={13} />全体チャット</button>
                  <label><span className="community-team-dm-label"><CommunityIcon name="mail" size={13} />DM</span>
                    <select aria-label="DM の相手" value={dmRecipient} onChange={event => setDmRecipient(event.target.value)}>
                      <option value="">相手を選ぶ...</option>
                      {activeMembers.filter(member => member.user_id !== session?.user?.id).map(member => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}
                    </select>
                  </label>
                </div>
                {dmRecipient && <p className="community-team-channel-note">DM相手: {selectedDmMember?.display_name || 'チームメンバー'}</p>}
                <div className="community-team-message-list">
                  {messages.map(message => (
                    <article key={message.id} className={'community-team-message' + (message.kind === 'announcement' ? ' is-announcement' : '')}>
                      <div><strong>{message.sender_name}</strong><span>{message.kind === 'announcement' ? '全体通知' : message.kind === 'dm' ? 'DM' : 'チャット'} ・ {formatDate(message.created_at)}</span></div>
                      <p>{message.body}</p>
                    </article>
                  ))}
                  {!messages.length && <p className="community-team-muted">{dmRecipient ? 'この相手とのDMはまだありません。' : 'まだメッセージはありません。'}</p>}
                </div>
                <form className="community-team-message-form" onSubmit={sendMessage}>
                  {!dmRecipient && isManager && (
                    <label>投稿種別
                      <select value={messageKind} onChange={event => setMessageKind(event.target.value)}>
                        <option value="message">全体チャット</option>
                        <option value="announcement">チーム全体通知</option>
                      </select>
                    </label>
                  )}
                  <textarea value={messageBody} onChange={event => setMessageBody(event.target.value)} maxLength={3000} rows={3} placeholder={dmRecipient ? 'このメンバーにDMを送る...' : messageKind === 'announcement' ? 'チーム全員に知らせる内容...' : 'チームにメッセージを送る...'} disabled={busy} />
                  <div><small>{messageBody.length}/3000</small><button className="community-team-button" type="submit" disabled={busy || !messageBody.trim()}>{busy ? '送信中...' : <><CommunityIcon name="send" size={13} />送信</>}</button></div>
                </form>
              </section>

              {isManager && (
                <section className="community-team-panel">
                  <div className="community-team-panel-heading"><h3><CommunityIcon name="mail" size={16} />招待を送信</h3><span>通知BOX経由</span></div>
                  <p className="community-team-muted">相手の招待 ID（#ABCDE）を入力してください。相手は通知BOXから承認します。</p>
                  <form className="community-team-invite-form" onSubmit={sendInvite}>
                    <input value={inviteeCode} onChange={event => setInviteeCode(event.target.value)} placeholder="#ABCDE" aria-label="招待 ID" maxLength={6} required />
                    <button type="submit" className="community-team-button" disabled={busy || !inviteeCode.trim()}><CommunityIcon name="send" size={13} />招待する</button>
                  </form>
                </section>
              )}

              {isManager && requests.length > 0 && (
                <section className="community-team-panel">
                  <div className="community-team-panel-heading"><h3><CommunityIcon name="user-check" size={16} />参加申請</h3><span>{requests.length} 件</span></div>
                  <div className="community-team-request-list">
                    {requests.map(request => (
                      <article key={request.id}>
                        <div><strong>{request.display_name}</strong><small>{formatDate(request.created_at)}</small></div>
                        <div><button type="button" className="community-team-button" disabled={busy} onClick={() => void decideJoinRequest(request.id, 'approve')}>承認</button><button type="button" className="community-team-button is-secondary" disabled={busy} onClick={() => void decideJoinRequest(request.id, 'reject')}>拒否</button></div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="community-team-column">
              <section className="community-team-panel">
                <div className="community-team-panel-heading"><h3><CommunityIcon name="users" size={16} />メンバー</h3><span>{activeMembers.length} 人</span></div>
                <div className="community-team-member-list">
                  {activeMembers.map(member => (
                    <article key={member.user_id}>
                      <div><strong>{member.display_name}</strong><small>{member.role === 'owner' ? 'オーナー' : member.role === 'admin' ? '管理者' : 'メンバー'}</small></div>
                      {isOwner && member.user_id !== session?.user?.id && member.role !== 'owner' && <div className="community-team-member-actions"><button type="button" className="community-notification-hide" disabled={busy} onClick={() => void changeMemberRole(member, member.role === 'admin' ? 'member' : 'admin')}>{member.role === 'admin' ? '管理者を解除' : '管理者にする'}</button><button type="button" className="community-notification-hide" disabled={busy} onClick={() => void removeMember(member)}>外す</button></div>}
                      {!isOwner && isManager && member.user_id !== session?.user?.id && member.role === 'member' && <button type="button" className="community-notification-hide" disabled={busy} onClick={() => void removeMember(member)}>外す</button>}
                    </article>
                  ))}
                </div>
              </section>

              {isManager && (
                <section className="community-team-panel">
                  <div className="community-team-panel-heading"><h3><CommunityIcon name="settings" size={16} />チーム設定</h3><span>{isOwner ? 'オーナー' : '管理者'}</span></div>
                  <form className="community-team-settings-form" onSubmit={saveTeamSettings}>
                    <label>チーム名<input value={teamSettings.name} onChange={event => setTeamSettings(current => ({ ...current, name: event.target.value }))} maxLength={80} required /></label>
                    <label>説明<textarea value={teamSettings.description} onChange={event => setTeamSettings(current => ({ ...current, description: event.target.value }))} maxLength={500} rows={3} /></label>
                    <label>公開設定<select value={teamSettings.visibility} onChange={event => setTeamSettings(current => ({ ...current, visibility: event.target.value }))}><option value="public">公開チーム</option><option value="private">非公開チーム</option></select></label>
                    {teamSettings.visibility === 'public' && <label>参加方法<select value={teamSettings.joinPolicy} onChange={event => setTeamSettings(current => ({ ...current, joinPolicy: event.target.value }))}><option value="auto">自動承認</option><option value="manual">管理者が手動承認</option></select></label>}
                    {teamSettings.visibility === 'private' && <p className="community-team-muted">非公開チームは検索に表示されず、招待からのみ参加できます。</p>}
                    <button type="submit" className="community-team-button" disabled={busy}>設定を保存</button>
                  </form>
                </section>
              )}

              <section className="community-team-panel community-team-panel-danger">
                <div className="community-team-panel-heading"><h3><CommunityIcon name="logout" size={16} />チームから退出</h3></div>
                {isOwner ? <p className="community-team-muted">オーナーは退出できません。チームを削除するか、今後の更新でオーナーを引き継いでください。</p> : <button type="button" className="community-team-button is-secondary" disabled={busy} onClick={() => void leaveTeam()}>チームを退出</button>}
                {isOwner && (confirmDeleteTeam ? (
                  <div className="community-team-delete-confirm">
                    <p>チーム、メンバー、チーム内メッセージは削除されます。この操作は元に戻せません。</p>
                    <div><button type="button" className="community-team-button is-danger" disabled={busy} onClick={() => void deleteTeam()}>削除を確定</button><button type="button" className="community-team-button is-secondary" disabled={busy} onClick={() => setConfirmDeleteTeam(false)}>キャンセル</button></div>
                  </div>
                ) : (
                  <button type="button" className="community-team-button is-danger" disabled={busy} onClick={() => setConfirmDeleteTeam(true)}>チームを削除</button>
                ))}
              </section>
            </aside>
          </div>
        )}
      </section>
    )
  }

  if (mode === 'notifications') {
    return (
      <section className="community-team-hub">
        {error && <p className="community-error" role="alert">{error}</p>}
        {notice && <p className="community-notice" role="status">{notice}</p>}
        {renderNotifications()}
      </section>
    )
  }

  return (
    <section className="community-team-hub">
      {error && <p className="community-error" role="alert">{error}</p>}
      {notice && <p className="community-notice" role="status">{notice}</p>}
      {activeTeam ? renderTeamDetail() : (
        <>
          <div className="community-team-section-heading">
            <div>
              <span className="community-section-kicker">COMMUNITY / TEAMS</span>
              <h2><span className="community-team-heading-icon"><CommunityIcon name="users" size={21} /></span>チームを探す</h2>
              <p>公開チームに参加したり、招待 ID で仲間を招待して開発を進められます。</p>
            </div>
            {isSignedIn && <button type="button" className="community-team-button" onClick={() => setCreateOpen(value => !value)}>{createOpen ? <><CommunityIcon name="close" size={14} />作成を閉じる</> : <><CommunityIcon name="plus" size={14} />チームを作成</>}</button>}
          </div>

          {isSignedIn && (
            <section className="community-team-invite-code">
              <div className="community-team-invite-code-copy"><span className="community-invite-code-mark"><CommunityIcon name="mail" size={18} /></span><div><span className="community-section-kicker">YOUR INVITATION ID</span><strong>{inviteCode || '取得中...'}</strong><p>この ID を共有すると、チーム管理者があなたを招待できます。招待通知は通知BOXに届きます。</p></div></div>
              <button type="button" className="community-team-button is-secondary" disabled={!inviteCode} onClick={() => {
                void navigator.clipboard?.writeText(inviteCode).then(() => setNotice('招待 ID をコピーしました。')).catch(() => setNotice('招待 ID を選択してコピーしてください。'))
              }}><CommunityIcon name="copy" size={14} />IDをコピー</button>
            </section>
          )}

          {createOpen && (
            <form className="community-team-create-form" onSubmit={createTeam}>
              <div className="community-team-panel-heading"><h3><CommunityIcon name="plus" size={16} />チームを作成</h3><span>新しい共同作業スペース</span></div>
              <label>チーム名<input value={createName} onChange={event => setCreateName(event.target.value)} maxLength={80} required placeholder="例: Web制作チーム" /></label>
              <label>説明<textarea value={createDescription} onChange={event => setCreateDescription(event.target.value)} maxLength={500} rows={3} placeholder="チームの目的や活動内容" /></label>
              <div className="community-team-create-grid">
                <label>公開設定<select value={createVisibility} onChange={event => setCreateVisibility(event.target.value)}><option value="public">公開チーム</option><option value="private">非公開チーム</option></select></label>
                {createVisibility === 'public' && <label>参加方法<select value={createJoinPolicy} onChange={event => setCreateJoinPolicy(event.target.value)}><option value="auto">自動承認</option><option value="manual">管理者が手動承認</option></select></label>}
              </div>
              {createVisibility === 'private' && <p className="community-team-muted">非公開チームは検索に表示されず、招待されたユーザーだけが参加できます。</p>}
              <div className="community-team-form-actions"><button type="button" className="community-team-button is-secondary" onClick={() => setCreateOpen(false)} disabled={busy}>キャンセル</button><button type="submit" className="community-team-button" disabled={busy || !createName.trim()}>{busy ? '作成中...' : 'チームを作成'}</button></div>
            </form>
          )}

          <div className="community-team-list-header">
            <label className="community-team-search"><span className="community-team-search-label"><CommunityIcon name="search" size={14} />チーム検索</span><input value={teamQuery} onChange={event => setTeamQuery(event.target.value)} placeholder="チーム名や説明..." onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void loadTeams() } }} /></label>
            <button type="button" className="community-team-button is-secondary" onClick={() => void loadTeams()} disabled={loading}><CommunityIcon name="search" size={13} />検索</button>
            <span>{teamCountLabel}</span>
          </div>

          {loading ? <div className="community-team-loading">チームを読み込んでいます...</div> : teams.length ? (
            <div className="community-team-card-grid">
              {teams.map(team => (
                <article className="community-team-card" key={team.id}>
                  <div className="community-team-card-top">
                    <span className="community-team-card-index">{String(teams.indexOf(team) + 1).padStart(2, '0')}</span>
                    <TeamTag tone={team.visibility === 'private' ? 'is-private' : 'is-public'}>{team.visibility === 'private' ? '非公開' : '公開'}</TeamTag>
                    <TeamTag>{team.join_policy === 'auto' ? '自動承認' : '手動承認'}</TeamTag>
                  </div>
                  <button type="button" className="community-team-card-open" onClick={() => void openTeam(team.id)}>
                    <h3><span className="community-team-card-icon"><CommunityIcon name="team" size={18} /></span><span>{team.name}</span></h3>
                    <p>{team.description || '説明はまだありません。'}</p>
                  </button>
                  <div className="community-team-card-meta"><span><CommunityIcon name="users" size={12} />{Number(team.member_count || 0)} メンバー</span><span>作成者 {team.owner_name}</span></div>
                  <div className="community-team-card-actions">
                    {team.my_role ? (
                      <>
                        <TeamTag tone="is-member">{team.my_role === 'owner' ? 'オーナー' : team.my_role === 'admin' ? '管理者' : '参加中'}</TeamTag>
                        <button type="button" className="community-team-button is-secondary" onClick={() => void openTeam(team.id)}><CommunityIcon name="arrow-up-right" size={13} />チームを開く</button>
                      </>
                    ) : team.my_request_status === 'pending' ? (
                      <TeamTag tone="is-pending">参加申請中</TeamTag>
                    ) : (
                      <button type="button" className="community-team-button" disabled={busy} onClick={() => void joinTeam(team)}><CommunityIcon name="user-check" size={13} />{team.join_policy === 'auto' ? '参加する' : '参加を申請'}</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="community-team-empty"><h3>チームが見つかりません</h3><p>検索語を変えるか、新しいチームを作成してください。</p></div>
          )}
        </>
      )}
    </section>
  )
}
