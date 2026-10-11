const PRODUCTION_WEB_ORIGIN = 'https://poligo-web-2n2l.onrender.com'
const DEVELOPMENT_WEB_ORIGIN = 'http://localhost:5173'
const DEVELOPMENT_WEB_ORIGINS = [
  DEVELOPMENT_WEB_ORIGIN,
  'http://127.0.0.1:5173'
]

export function isProductionEnvironment(environment = process.env) {
  return environment.NODE_ENV === 'production' ||
    Boolean(environment.RENDER_SERVICE_ID)
}

export function resolveAllowedOrigin(environment = process.env) {
  const isProduction = isProductionEnvironment(environment)
  const configured = typeof environment.CORS_ORIGIN === 'string'
    ? environment.CORS_ORIGIN.trim()
    : ''

  if (
    configured &&
    configured !== '*' &&
    !configured.includes(',') &&
    /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(configured)
  ) {
    return configured
  }

  return isProduction
    ? PRODUCTION_WEB_ORIGIN
    : DEVELOPMENT_WEB_ORIGIN
}

export function resolveTrustedOrigins(environment = process.env) {
  const origins = [resolveAllowedOrigin(environment)]

  if (!isProductionEnvironment(environment)) {
    origins.push(...DEVELOPMENT_WEB_ORIGINS)
  }

  return [...new Set(origins)]
}
