const glyphs = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  heart: <path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 8.8 2.3Z" />,
  fork: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M6 7v4a4 4 0 0 0 4 4h6M18 7v10" /></>,
  'arrow-up-right': <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'arrow-left': <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  'file-code': <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M10 13l-2 2 2 2M14 13l2 2-2 2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  code: <><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  team: <><circle cx="9" cy="8" r="3.25" /><circle cx="17.5" cy="9" r="2.5" /><path d="M2.8 19a6.2 6.2 0 0 1 12.4 0M15 15a4.7 4.7 0 0 1 6.2 4" /></>,
  message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-8.5A7.5 7.5 0 0 1 10.5 5H12a8 8 0 0 1 8 6.5Z" /><path d="M8 11h8M8 14h5" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" /></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.6a8 8 0 0 1-1.6.9L15.8 21h-2.8l-.3-2.1a8 8 0 0 1-1.7-.7l-1.8.6-1.4-2.4 1.4-1.2a7 7 0 0 1 0-1.9l-1.4-1.2 1.4-2.4 1.8.6a8 8 0 0 1 1.7-.7l.3-2.1h2.8l.3 2.1a8 8 0 0 1 1.6.9l1.8-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -1) scale(1.05)" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  inbox: <><path d="M4 4h16l2 11v5H2v-5L4 4Z" /><path d="M2 14h5l2 3h6l2-3h5" /></>,
  comment: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-8.5A7.5 7.5 0 0 1 10.5 5H12a8 8 0 0 1 8 6.5Z" /><path d="M8 11h8M8 14h5" /></>,
  'user-check': <><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 11-5.7M16 19l2 2 4-4" /></>,
  sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>
}

export default function CommunityIcon({ name, size = 16, className = '' }) {
  return (
    <svg
      className={['community-icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
