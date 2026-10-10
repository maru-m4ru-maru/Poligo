import { useEffect, useState } from 'react'
import { authClient } from './auth-client'

export default function AuthPage({ mode }) {
  const isSignUp = mode === 'signup'
  const { isPending } = authClient.useSession()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
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
            username,
            email,
            password
          })
        : await authClient.signIn.email({
            email,
            password
          })

      if (result.error) {
        throw new Error(result.error.message || '認証に失敗しました')
      }

      const sessionResult = await authClient.getSession()

      if (!sessionResult.data?.user) {
        throw new Error('サインインには成功しましたが、セッションを確認できませんでした。')
      }

      window.location.replace('/#/dashboard')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '認証に失敗しました')
      setBusy(false)
    }
  }

  if (isPending) {
    return (
      <div className="auth-page">
        <div className="auth-page-card">
          <img className="auth-page-logo" src="/poligo-logo.svg" alt="Poligo" />
          <div className="auth-page-loading">セッションを確認中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page-card">
        <img className="auth-page-logo" src="/poligo-logo.svg" alt="Poligo" />
        <div className="auth-page-accent" />
        <h1>{isSignUp ? 'アカウントを作成' : 'サインイン'}</h1>
        <p>
          {isSignUp
            ? 'Poligoアカウントを作成して、プロジェクトをクラウドに保存できます。'
            : 'サインインしてPoligoのプロジェクトにアクセスします。'}
        </p>

        <form className="auth-page-form" onSubmit={submit}>
          {isSignUp && (
            <>
              <label>
                <span>ユーザー名</span>
                <input
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  autoComplete="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9_]{3,32}"
                  title="英数字とアンダースコアを使って3〜32文字で入力してください"
                  required
                />
              </label>
              <label>
                <span>表示名</span>
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            </>
          )}

          <label>
            <span>メールアドレス</span>
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>パスワード</span>
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
              ? isSignUp ? 'アカウントを作成中...' : 'サインイン中...'
              : isSignUp ? 'アカウントを作成' : 'サインイン'}
          </button>
        </form>

        <button
          className="auth-page-switch"
          type="button"
          onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
        >
          {isSignUp
            ? 'すでにアカウントをお持ちですか？ サインイン'
            : 'Poligoを初めて利用しますか？ アカウントを作成'}
        </button>
      </div>
    </div>
  )
}
