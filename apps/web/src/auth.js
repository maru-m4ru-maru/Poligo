import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null

export function isAuthConfigured() {
  return Boolean(supabase)
}

export async function getAccessToken() {
  if (!supabase) return null

  const {
    data: { session }
  } = await supabase.auth.getSession()

  return session?.access_token || null
}

export async function signIn(email, password) {
  if (!supabase) {
    throw new Error('authentication is not configured')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error

  return data
}

export async function signUp(email, password) {
  if (!supabase) {
    throw new Error('authentication is not configured')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) throw error

  return data
}

export async function signOut() {
  if (!supabase) return

  const { error } = await supabase.auth.signOut()

  if (error) throw error
}
