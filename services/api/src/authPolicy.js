export function getTrustedOrigins(configuredOrigin, environment = 'development') {
  const configuredOrigins = typeof configuredOrigin === 'string'
    ? configuredOrigin.split(',').map(origin => origin.trim())
    : []
  const developmentOrigins = environment === 'production'
    ? []
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ]
  const origins = [...configuredOrigins, ...developmentOrigins]
  const trusted = []

  for (const origin of origins) {
    if (!origin || origin === '*') {
      continue
    }

    try {
      const url = new URL(origin)

      if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.origin !== origin
      ) {
        continue
      }

      if (!trusted.includes(url.origin)) {
        trusted.push(url.origin)
      }
    } catch {}
  }

  return trusted
}
