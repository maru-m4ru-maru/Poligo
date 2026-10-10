import { useEffect, useState } from 'react'

export default function AnnouncementsPanel() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadAnnouncements() {
      try {
        const response = await fetch('/api/announcements', {
          credentials: 'include'
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'お知らせを読み込めませんでした')
        }

        if (active) {
          setItems(Array.isArray(result.announcements) ? result.announcements : [])
        }
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'お知らせを読み込めませんでした')
        }
      }
    }

    void loadAnnouncements()

    return () => {
      active = false
    }
  }, [])

  if (!items.length && !error) {
    return null
  }

  return (
    <section className="poligo-announcements" aria-label="お知らせ">
      <div className="poligo-announcements-heading">
        <div>
          <span>ANNOUNCEMENTS</span>
          <h2>お知らせ</h2>
        </div>
      </div>
      {error && <p className="account-settings-error">{error}</p>}
      {items.map(item => (
        <article className="poligo-announcement" key={item.id}>
          <div className="poligo-announcement-meta">
            {new Date(item.createdAt).toLocaleString('ja-JP')}
            {item.isGlobal ? ' ・ 全体向け' : ' ・ 個別のお知らせ'}
          </div>
          <h3>{item.title}</h3>
          <p>{item.message}</p>
        </article>
      ))}
    </section>
  )
}
