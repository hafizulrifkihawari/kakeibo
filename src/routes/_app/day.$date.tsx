import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { Expense } from '../../../shared/types'
import { dayLabel, isoDate, parseIso, yen } from '../../client/format'
import { keys, monthQuery, type DeleteVars } from '../../client/queries'
import { Empty, SwipeRow, Toast, type ToastState } from '../../components/bits'

export const Route = createFileRoute('/_app/day/$date')({
  params: {
    parse: ({ date }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw notFound()
      return { date }
    },
  },
  component: DayView,
})

const UNDO_MS = 4000

function DayView() {
  const { date } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()
  const q = useQuery(monthQuery(date.slice(0, 7)))
  const remove = useMutation<unknown, Error, DeleteVars>({ mutationKey: ['deleteExpense'] })
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<ToastState | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const list = (q.data ?? []).filter((e) => e.date === date && !hidden.has(e.id))
  const total = list.reduce((s, e) => s + e.amount, 0)

  // Hide at once, delete for real after the undo window.
  function onDelete(e: Expense) {
    setHidden((h) => new Set(h).add(e.id))
    const t = setTimeout(() => {
      timers.current.delete(e.id)
      remove.mutate({ id: e.id, date: e.date })
    }, UNDO_MS)
    timers.current.set(e.id, t)
    setToast({
      message: `Deleted ${e.store || 'expense'}`,
      action: {
        label: 'Undo',
        run: () => {
          clearTimeout(timers.current.get(e.id))
          timers.current.delete(e.id)
          setHidden((h) => {
            const n = new Set(h)
            n.delete(e.id)
            return n
          })
          qc.invalidateQueries({ queryKey: keys.month(e.date.slice(0, 7)) })
        },
      },
    })
  }

  const shift = (delta: number) => {
    const d = parseIso(date)
    d.setDate(d.getDate() + delta)
    navigate({ params: { date: isoDate(d) } })
  }

  const closeToast = useCallback(() => setToast(null), [])

  return (
    <main className="page stack">
      <div className="month-picker">
        <button className="icon-btn" aria-label="Previous day" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1 style={{ fontSize: '1.125rem' }}>{dayLabel(date)}</h1>
        <button className="icon-btn" aria-label="Next day" onClick={() => shift(1)}>
          ›
        </button>
      </div>

      <section className="card">
        <div className="muted small">{date.replace(/-/g, '/')}</div>
        <div className="big-amount num">{yen(total)}</div>
      </section>

      <section>
        {list.length > 0 && <div className="section-label">Swipe left on an expense to delete it.</div>}
        <div className="list">
          {q.isPending ? (
            <div className="empty">Loading…</div>
          ) : list.length ? (
            list.map((e) => <SwipeRow key={e.id} e={e} onDelete={() => onDelete(e)} />)
          ) : (
            <Empty emoji="☕">No expenses on this day.</Empty>
          )}
        </div>
      </section>
      <Toast toast={toast} onDone={closeToast} />
    </main>
  )
}
