import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup'
  const { isPending } = authClient.useSession()
  const [name, set名前] = useState('')
  const [email, setメールアドレス] = useState('')
  const [password, setパスワード] = useState('')
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

      window.location.replace('/#/ide')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed')
      setBusy(false)
    }
  }

  if (isPending) {
    return (
      <div class名前="auth-page">
        <div class名前="auth-page-card">
          <img class名前="auth-page-logo" src="/poligo-logo.svg" alt="Poligo" />
          <div class名前="auth-page-loading">Checking session...</div>
        </div>
      </div>
    )
  }

  return (
    <div class名前="auth-page">
      <div class名前="auth-page-card">
        <img class名前="auth-page-logo" src="/poligo-logo.svg" alt="Poligo" />
        <div class名前="auth-page-accent" />
        <h1>{isSignUp ? 'アカウントを作成' : 'サインイン'}</h1>
        <p>
          {isSignUp
            ? '作成 your Poligo account and keep your projects in the cloud.'
            : 'サインイン to access your Poligo projects.'}
        </p>

        <form class名前="auth-page-form" onSubmit={submit}>
          {isSignUp && (
            <label>
              <span>Display name</span>
              <input
                value={name}
                onChange={event => set名前(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            <span>メールアドレス</span>
            <input
              value={email}
              onChange={event => setメールアドレス(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>パスワード</span>
            <input
              value={password}
              onChange={event => setパスワード(event.target.value)}
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          {error && (
            <div class名前="auth-page-error">
              {error}
            </div>
          )}

          <button class名前="auth-page-submit" type="submit" disabled={busy}>
            {busy
              ? isSignUp ? 'Creating account...' : 'Signing in...'
              : isSignUp ? 'アカウントを作成' : 'サインイン'}
          </button>
        </form>

        <button
          class名前="auth-page-switch"
          type="button"
          onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
        >
          {isSignUp
            ? 'すでにアカウントをお持ちですか？ サインイン'
            : 'New to Poligo? 作成 an account'}
        </button>
      </div>
    </div>
  )
}
