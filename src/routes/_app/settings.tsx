import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getVisionUsage, logout } from '../../server/fns'
import { forgetMe, persister } from '../../client/queries'
import { useOnline } from '../../components/bits'

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
