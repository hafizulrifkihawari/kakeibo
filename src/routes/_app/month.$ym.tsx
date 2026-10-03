import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { isCategoryId, CATEGORY_BY_ID, type CategoryId } from '../../../shared/categories'
import { addMonths, dayLabel, monthLabel, yen } from '../../client/format'
import { monthQuery } from '../../client/queries'
import { Empty, ExpenseRow } from '../../components/bits'
import { CalendarGrid, CategoryBars, sumBy } from '../../components/charts'

export const Route = createFileRoute('/_app/month/$ym')({
  params: {
    parse: ({ ym }) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw notFound()
      return { ym }
    },
  },
  validateSearch: (s: Record<string, unknown>): { cat?: CategoryId } => ({
    cat: isCategoryId(s.cat) ? s.cat : undefined,
  }),
  component: MonthView,
})

function MonthView() {
  const { ym } = Route.useParams()
  const { cat } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const qc = useQueryClient()
  const q = useQuery(monthQuery(ym))

  // Prefetch the next and previous months so switching is instant.
  useEffect(() => {
    qc.prefetchQuery(monthQuery(addMonths(ym, -1)))
    qc.prefetchQuery(monthQuery(addMonths(ym, 1)))
  }, [ym, qc])

  // Swipe left or right to change the month.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const go = (delta: number) => navigate({ params: { ym: addMonths(ym, delta) }, search: {} })

  const all = q.data ?? []
  const list = cat ? all.filter((e) => e.categoryId === cat) : all
  const total = list.reduce((s, e) => s + e.amount, 0)
  const days = [...sumBy(list, (e) => e.date)].sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <main
      className="page stack"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current
        touch.current = null
        if (!t) return
        const dx = e.changedTouches[0].clientX - t.x
        const dy = e.changedTouches[0].clientY - t.y
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
      }}
    >
      <div className="month-picker">
        <button className="icon-btn" aria-label="Previous month" onClick={() => go(-1)}>
          ‹
        </button>
        <h1>{monthLabel(ym)}</h1>
        <button className="icon-btn" aria-label="Next month" onClick={() => go(1)}>
          ›
        </button>
      </div>

      <section className="card">
        <div className="muted small">{cat ? `${CATEGORY_BY_ID[cat].en} this month` : 'Spent this month'}</div>
        <div className="big-amount num">{yen(total)}</div>
        <div style={{ marginTop: 16 }}>
          <CalendarGrid ym={ym} expenses={list} />
        </div>
      </section>

      {all.length > 0 && (
        <section className="card">
          <div className="spread" style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>By category</span>
            {cat && (
              <button className="btn btn-ghost small" style={{ minHeight: 36 }} onClick={() => navigate({ search: {} })}>
                Show all
              </button>
            )}
          </div>
          <CategoryBars expenses={all} selected={cat} onSelect={(c) => navigate({ search: { cat: c } })} />
        </section>
      )}

      <section>
        {q.isPending ? (
          <div className="list">
            <div className="empty">Loading…</div>
          </div>
        ) : days.length ? (
          days.map(([date, dayTotal]) => (
            <div key={date}>
              <Link to="/day/$date" params={{ date }} className="day-head">
                <span style={{ fontWeight: 500 }}>{dayLabel(date)}</span>
                <span className="num muted">{yen(dayTotal)}</span>
              </Link>
              <div className="list">
                {list
                  .filter((e) => e.date === date)
                  .map((e) => (
                    <ExpenseRow key={e.id} e={e} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div className="list">
            <Empty emoji="🌱">Nothing recorded for {monthLabel(ym)}.</Empty>
          </div>
        )}
      </section>
    </main>
  )
}
