import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { resetPassword } from '../server/fns'
import { PasswordInput } from '../components/bits'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (s: Record<string, unknown>): { token: string } => ({
    token: typeof s.token === 'string' ? s.token : '',
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('The two passwords are not the same.')
      return
    }
    setBusy(true)
    try {
      await resetPassword({ data: { token, password } })
      await navigate({ to: '/login', search: { reset: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <div className="brand">
        <h1>Set a new password</h1>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!token ? (
          <div className="error" role="alert">
            This page needs the link from the Telegram message.
          </div>
        ) : (
          <>
            <label className="field">
              <span>New password</span>
              <PasswordInput
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small className="muted">At least 8 characters.</small>
            </label>
            <label className="field">
              <span>Type it again</span>
              <PasswordInput
                autoComplete="new-password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Please wait…' : 'Save new password'}
            </button>
          </>
        )}
      </form>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/forgot-password" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          Ask for a new link
        </Link>
      </p>
    </main>
  )
}
