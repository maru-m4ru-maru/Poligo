import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup'
  const { isPending } = authClient.useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function navigate(path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  function switchMode(nextMode) {
    navigate(nextMode === 'signup' ? '/createaccount' : '/signin')
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name,
            email,
            password
          })
        : await authClient.signIn.email({
            email,
            password
          })

      if (result.error) {
        throw new Error(result.error.message || 'Authentication failed')
      }

      const sessionResult = await authClient.getSession()

      if (!sessionResult.data?.user) {
        throw new Error('Sign-in succeeded, but the session could not be confirmed.')
      }

      window.location.replace('/')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed')
      setBusy(false)
    }
  }

  if (isPending) {
    return (
      <div className="auth-page">
        <div className="auth-page-card">
          <div className="auth-page-brand">Poligo</div>
          <div className="auth-page-loading">Checking session...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <div className="auth-page-brand">Poligo</div>
        <div className="auth-page-accent" />
        <h1>{isSignUp ? 'Create account' : 'Sign in'}</h1>
        <p>
          {isSignUp
            ? 'Create your Poligo account and keep your projects in the cloud.'
            : 'Sign in to access your Poligo projects.'}
        </p>

        <form className="auth-page-form" onSubmit={submit}>
          {isSignUp && (
            <label>
              <span>Display name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          {error && (
            <div className="auth-page-error">
              {error}
            </div>
          )}

          <button className="auth-page-submit" type="submit" disabled={busy}>
            {busy
              ? isSignUp ? 'Creating account...' : 'Signing in...'
              : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          className="auth-page-switch"
          type="button"
          onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : 'New to Poligo? Create an account'}
        </button>
      </div>
    </div>
  )
}
