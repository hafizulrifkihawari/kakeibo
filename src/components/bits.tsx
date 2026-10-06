import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { CATEGORIES, CATEGORY_BY_ID, type CategoryId } from '../../shared/categories'
import type { Expense } from '../../shared/types'
import { yen } from '../client/format'

export function CategoryDot({ id }: { id: CategoryId }) {
  const c = CATEGORY_BY_ID[id]
  return (
    <span className="cat-dot" style={{ '--dot-color': c.color } as React.CSSProperties} aria-hidden>
      {c.icon}
    </span>
  )
}

export function CategoryChips({
  value,
  onChange,
}: {
  value: CategoryId
  onChange: (id: CategoryId) => void
}) {
  return (
    <div className="chips" role="group" aria-label="Category">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          className="chip"
          aria-pressed={value === c.id}
          style={{ '--chip-color': c.color } as React.CSSProperties}
          onClick={() => onChange(c.id)}
        >
          <span aria-hidden>{c.icon}</span>
          {c.en}
          <span className="ja">{c.ja}</span>
        </button>
      ))}
    </div>
  )
}

function RowContent({ e }: { e: Expense }) {
  const c = CATEGORY_BY_ID[e.categoryId]
  return (
    <>
      <CategoryDot id={e.categoryId} />
      <div className="main">
        <div className="title">{e.store || c.en}</div>
        <div className="sub">
          {c.en} <span className="ja">{c.ja}</span>
          {e.items.length > 0 && <> · {e.items.length} items</>}
        </div>
      </div>
      <div className="amount num">{yen(e.amount)}</div>
    </>
  )
}

export function ExpenseRow({ e }: { e: Expense }) {
  return (
    <Link to="/expense/$id" params={{ id: e.id }} search={{ date: e.date }} className="list-row">
      <RowContent e={e} />
    </Link>
  )
}

/** A row that reveals a Delete button on swipe left. */
export function SwipeRow({ e, onDelete }: { e: Expense; onDelete: () => void }) {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; dx: number } | null>(null)
  const moved = useRef(false)
  const OPEN = -96

  return (
    <div className="swipe-wrap">
      <button className="swipe-action" onClick={onDelete} tabIndex={dx === OPEN ? 0 : -1}>
        Delete
      </button>
      <Link
        to="/expense/$id"
        params={{ id: e.id }}
        search={{ date: e.date }}
        className="list-row"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : undefined }}
        onPointerDown={(ev) => {
          start.current = { x: ev.clientX, y: ev.clientY, dx }
          moved.current = false
        }}
        onPointerMove={(ev) => {
          const s = start.current
          if (!s) return
          const ddx = ev.clientX - s.x
          if (!moved.current && Math.abs(ddx) < 8) return
          if (!moved.current && Math.abs(ev.clientY - s.y) > Math.abs(ddx)) {
            start.current = null
            return
          }
          moved.current = true
          setDx(Math.max(OPEN - 24, Math.min(0, s.dx + ddx)))
        }}
        onPointerUp={() => {
          start.current = null
          setDx((d) => (d < OPEN / 2 ? OPEN : 0))
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
        onClick={(ev) => {
          // A swipe or an open row is not a tap.
          if (moved.current || dx !== 0) {
            ev.preventDefault()
            if (!moved.current) setDx(0)
          }
          moved.current = false
        }}
      >
        <RowContent e={e} />
      </Link>
    </div>
  )
}

export function Empty({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="emoji" aria-hidden>
        {emoji}
      </span>
      {children}
    </div>
  )
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function OfflineBanner() {
  const online = useOnline()
  const queued = useIsMutating({ predicate: (m) => m.state.isPaused })
  if (online && !queued) return null
  return (
    <div className="banner" role="status">
      {online
        ? `Syncing ${queued} saved ${queued === 1 ? 'change' : 'changes'}…`
        : `You're offline.${queued ? ` ${queued} ${queued === 1 ? 'change waits' : 'changes wait'} to sync.` : ' Changes will sync later.'}`}
    </div>
  )
}

export interface ToastState {
  message: string
  action?: { label: string; run: () => void }
}

export function Toast({ toast, onDone }: { toast: ToastState | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return (
    <div className="toast" role="status">
      {toast.message}
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run()
            onDone()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

/** A password field with an eye button that shows or hides what the user types. */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-wrap">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
      <button
        type="button"
        className="icon-btn password-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}
