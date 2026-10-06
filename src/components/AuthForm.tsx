import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { login, register } from '../server/fns'
import { keys } from '../client/queries'
import { PasswordInput } from './bits'

export function AuthForm({ mode, notice }: { mode: 'login' | 'register'; notice?: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const fn = isLogin ? login : register
      const user = await fn({ data: { email, password } })
      // Another account may have used this device; start from an empty cache.
      qc.clear()
      qc.setQueryData(keys.me, user)
      try {
        localStorage.setItem('jp-expense:me', JSON.stringify(user))
      } catch {}
      await navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <div className="brand">
        <div className="logo" aria-hidden>
          🧾
        </div>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted small" style={{ margin: 0 }}>
          Snap a receipt. We read the Japanese for you.
        </p>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : (
          notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )
        )}
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <PasswordInput
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!isLogin && <small className="muted">At least 8 characters.</small>}
        </label>
        {isLogin && (
          <Link to="/forgot-password" className="small" style={{ color: 'var(--accent)', justifySelf: 'end' }}>
            Forgot password?
          </Link>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        {isLogin ? "Don't have an account? " : 'Already have an account? '}
        <Link to={isLogin ? '/register' : '/login'} style={{ color: 'var(--accent)', fontWeight: 500 }}>
          {isLogin ? 'Register' : 'Log in'}
        </Link>
      </p>
    </main>
  )
}
