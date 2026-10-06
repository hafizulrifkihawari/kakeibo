import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { changePassword, getVisionUsage, logout, startTelegramLink, unlinkTelegram } from '../../server/fns'
import { fetchMe, forgetMe, keys, persister } from '../../client/queries'
import { PasswordInput, useOnline } from '../../components/bits'

export const Route = createFileRoute('/_app/settings')({ component: Settings })

function Settings() {
  const { me } = Route.useRouteContext()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const online = useOnline()
  const usage = useQuery({ queryKey: ['visionUsage'], queryFn: () => getVisionUsage(), enabled: online })
  const [offlineState, setOfflineState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  async function prepareOffline() {
    setOfflineState('loading')
    try {
      const { loadPaddle } = await import('../../client/ocr/paddle')
      await loadPaddle()
      setOfflineState('ready')
    } catch {
      setOfflineState('error')
    }
  }

  async function onLogout() {
    await logout()
    forgetMe()
    qc.clear()
    await persister?.removeClient()
    navigate({ to: '/login' })
  }

  const pct = usage.data ? Math.min(100, (usage.data.count / usage.data.limit) * 100) : 0

  return (
    <main className="page stack">
      <h1 className="page-title">Settings</h1>

      <section className="card stack">
        <div>
          <div className="muted small">Signed in as</div>
          <div style={{ fontWeight: 500 }}>{me.email}</div>
        </div>
        <button className="btn btn-block" onClick={onLogout} disabled={!online}>
          Log out
        </button>
      </section>

      <TelegramCard />
      <ChangePasswordCard />

      <section className="card stack">
        <div style={{ fontWeight: 500 }}>Receipt reader</div>
        <div>
          <div className="spread small">
            <span>Google Vision this month</span>
            <span className="num muted">
              {usage.data ? `${usage.data.count} / ${usage.data.limit}` : '—'}
            </span>
          </div>
          <div className="cat-bar-row" style={{ padding: 0, display: 'block' }}>
            <div className="track">
              <div className="fill" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            After the limit, or with no network, receipts are read on this device instead.
          </p>
        </div>
        <button className="btn btn-block" onClick={prepareOffline} disabled={offlineState === 'loading' || offlineState === 'ready'}>
          {offlineState === 'idle' && '📥 Download the on-device reader (~35 MB)'}
          {offlineState === 'loading' && 'Downloading…'}
          {offlineState === 'ready' && '✓ Ready to read receipts offline'}
          {offlineState === 'error' && 'Download failed. Try again.'}
        </button>
      </section>
    </main>
  )
}

function TelegramCard() {
  const { me: initial } = Route.useRouteContext()
  const qc = useQueryClient()
  const online = useOnline()
  // Refetch when the user comes back from Telegram, so the card shows the new link.
  const me = useQuery({ queryKey: keys.me, queryFn: fetchMe, initialData: initial, refetchOnWindowFocus: 'always' })
  const linked = !!me.data?.telegramLinked
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onLink() {
    setError('')
    setBusy(true)
    // Open the window first: Safari blocks a popup that opens after an await.
    const win = window.open('', '_blank')
    try {
      const { url } = await startTelegramLink()
      if (win) win.location.href = url
      else window.location.href = url
    } catch (err) {
      win?.close()
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onUnlink() {
    setBusy(true)
    try {
      await unlinkTelegram()
      await qc.invalidateQueries({ queryKey: keys.me })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <div>
        <div style={{ fontWeight: 500 }}>Telegram</div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {linked
            ? 'Linked. If you forget your password, the reset link comes to your Telegram.'
            : 'Link Telegram to reset your password if you forget it. Tap the button, then tap Start in Telegram.'}
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {linked ? (
        <button className="btn btn-block" onClick={onUnlink} disabled={busy || !online}>
          Unlink Telegram
        </button>
      ) : (
        <button className="btn btn-block" onClick={onLink} disabled={busy || !online}>
          {busy ? 'Opening Telegram…' : 'Link Telegram'}
        </button>
      )}
    </section>
  )
}

function ChangePasswordCard() {
  const online = useOnline()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      await changePassword({ data: { current, next } })
      setCurrent('')
      setNext('')
      setMsg({ ok: true, text: 'Password changed. Other devices are now logged out.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div style={{ fontWeight: 500 }}>Change password</div>
      {msg && (
        <div className={msg.ok ? 'notice' : 'error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </div>
      )}
      <label className="field">
        <span>Current password</span>
        <PasswordInput
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="field">
        <span>New password</span>
        <PasswordInput
          autoComplete="new-password"
          minLength={8}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <small className="muted">At least 8 characters.</small>
      </label>
      <button className="btn btn-block" disabled={busy || !online}>
        {busy ? 'Please wait…' : 'Change password'}
      </button>
    </form>
  )
}
