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

export function getOriginPolicy(configuredOrigin, environment = 'development') {
  const configured = getTrustedOrigins(configuredOrigin, environment)

  if (configured.length) {
    return {
      allowedOrigins: configured,
      corsOrigin: configured[0]
    }
  }

  const allowedOrigins = environment === 'production'
    ? ['https://poligo-web-2n2l.onrender.com']
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ]

  return {
    allowedOrigins,
    corsOrigin: allowedOrigins[0]
  }
}

export function selectCorsOrigin(requestOrigin, allowedOrigins, fallbackOrigin) {
  return typeof requestOrigin === 'string' &&
    allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : fallbackOrigin
}
