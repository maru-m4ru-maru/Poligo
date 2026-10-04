import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || ''
const key = process.env.SUPABASE_PUBLISHABLE_KEY || ''

const supabase = url && key
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  : null

export function getAuthStatus() {
  return {
    configured: Boolean(supabase)
  }
}

export async function authenticateRequest(request) {
  if (!supabase) {
    const error = new Error('authentication is not configured')
    error.statusCode = 503
    throw error
  }

  const authorization = request.headers.authorization || ''
  const match = authorization.match(/^Bearer\\s+(.+)$/i)

  if (!match) {
    const error = new Error('authentication required')
    error.statusCode = 401
    throw error
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser(match[1])

  if (error || !user) {
    const authError = new Error('invalid authentication')
    authError.statusCode = 401
    throw authError
  }

  return user
}
