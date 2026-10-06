import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requestPasswordReset } from '../server/fns'

export const Route = createFileRoute('/forgot-password')({ component: ForgotPassword })

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setState('busy')
    try {
      await requestPasswordReset({ data: { email } })
      setState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setState('idle')
    }
  }

  return (
    <main className="auth">
      <div className="brand">
        <h1>Forgot password</h1>
        <p className="muted small" style={{ margin: 0 }}>
          We send a reset link to the Telegram chat that you linked in Settings.
        </p>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {state === 'sent' ? (
          <div className="notice" role="status">
            If this account has Telegram linked, we sent a reset link there. It works for 30 minutes. No message?
            Ask the admin of this app to reset your password.
          </div>
        ) : (
          <>
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
            <button className="btn btn-primary btn-block" disabled={state === 'busy'}>
              {state === 'busy' ? 'Please wait…' : 'Send reset link'}
            </button>
          </>
        )}
      </form>

      <p className="muted" style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          Back to log in
        </Link>
      </p>
    </main>
  )
}
