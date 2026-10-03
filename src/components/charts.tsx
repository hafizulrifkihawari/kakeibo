import { Link } from '@tanstack/react-router'
import { CATEGORY_BY_ID, type CategoryId } from '../../shared/categories'
import type { Expense } from '../../shared/types'
import { daysInMonth, isoDate, parseIso, shortDow, yen } from '../client/format'
import { CategoryDot } from './bits'

export function sumBy<K extends string>(list: Expense[], key: (e: Expense) => K): Map<K, number> {
  const m = new Map<K, number>()
  for (const e of list) m.set(key(e), (m.get(key(e)) ?? 0) + e.amount)
  return m
}

/** Daily totals for the 7 days that end today. */
export function WeekBars({ expenses }: { expenses: Expense[] }) {
  const byDay = sumBy(expenses, (e) => e.date)
  const days = Array.from({ length: 7 }, (_, i) => isoDate(new Date(Date.now() - (6 - i) * 86_400_000)))
  const max = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0))
  const today = isoDate()
  return (
    <div className="week-bars" role="img" aria-label="Spending in the last 7 days">
      {days.map((d) => {
        const v = byDay.get(d) ?? 0
        return (
          <Link key={d} to="/day/$date" params={{ date: d }} className={`col${d === today ? ' today' : ''}`} title={`${d}: ${yen(v)}`}>
            <div className="bar-track">
              <div className="bar" style={{ height: `${(v / max) * 100}%` }} />
            </div>
            <div className="day-label">{shortDow(d)}</div>
          </Link>
        )
      })}
    </div>
  )
}

export function CategoryBars({
  expenses,
  selected,
  onSelect,
}: {
  expenses: Expense[]
  selected?: CategoryId
  onSelect: (id: CategoryId | undefined) => void
}) {
  const totals = [...sumBy(expenses, (e) => e.categoryId)].sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...totals.map(([, v]) => v))
  if (!totals.length) return null
  return (
    <div className="cat-bars">
      {totals.map(([id, v]) => {
        const c = CATEGORY_BY_ID[id]
        return (
          <button
            key={id}
            className="cat-bar-row"
            aria-pressed={selected === id}
            onClick={() => onSelect(selected === id ? undefined : id)}
          >
            <CategoryDot id={id} />
            <div>
              <div className="spread small">
                <span>
                  {c.en}
                  <span className="ja">{c.ja}</span>
                </span>
              </div>
              <div className="track">
                <div className="fill" style={{ width: `${(v / max) * 100}%`, background: c.color }} />
              </div>
            </div>
            <span className="num small" style={{ fontWeight: 500 }}>
              {yen(v)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarGrid({ ym, expenses }: { ym: string; expenses: Expense[] }) {
  const byDay = sumBy(expenses, (e) => e.date)
  const n = daysInMonth(ym)
  const lead = parseIso(`${ym}-01`).getDay()
  const max = Math.max(1, ...byDay.values())
  const today = isoDate()
  return (
    <div className="cal">
      {DOW.map((d, i) => (
        <div key={i} className={`dow${i === 0 ? ' sun' : ''}`}>
          {d}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <div key={`b${i}`} className="cal-cell blank" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const date = `${ym}-${String(i + 1).padStart(2, '0')}`
        const v = byDay.get(date) ?? 0
        // Square root keeps small days visible next to one big day.
        const heat = v ? 0.15 + 0.85 * Math.sqrt(v / max) : 0
        return (
          <Link
            key={date}
            to="/day/$date"
            params={{ date }}
            className={`cal-cell${date === today ? ' is-today' : ''}`}
            style={{ '--heat': heat } as React.CSSProperties}
            aria-label={`${date}: ${yen(v)}`}
          >
            <span>{i + 1}</span>
            {v > 0 && <span className="amt num">{v >= 10000 ? `${Math.round(v / 1000)}k` : v.toLocaleString('ja-JP')}</span>}
          </Link>
        )
      })}
    </div>
  )
}

/** Price of one product over time: one dot per purchase, oldest on the left. */
export function PriceChart({ purchases }: { purchases: { date: string; price: number; store: string }[] }) {
  const points = purchases.filter((p) => p.price > 0).slice().reverse()
  if (points.length < 2) return null
  const W = 320
  const H = 140
  const PAD = { l: 44, r: 12, t: 12, b: 24 }
  const prices = points.map((p) => p.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const span = Math.max(1, hi - lo)
  const t = points.map((p) => parseIso(p.date).getTime())
  const t0 = t[0]
  const tSpan = Math.max(1, t[t.length - 1] - t0)
  // Same-day purchases would sit on top of each other: spread by index when the dates are equal.
  const x = (i: number) => PAD.l + (tSpan > 1 ? (t[i] - t0) / tSpan : i / (points.length - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
  const label = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Price from ${yen(points[0].price)} to ${yen(points[points.length - 1].price)}`}
    >
      {[hi, lo].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="axis">
            {yen(v)}
          </text>
        </g>
      ))}
      <path d={path} className="line" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.price)} r={4} className={p.price === lo ? 'dot min' : 'dot'}>
          <title>{`${p.date} ${p.store}: ${yen(p.price)}`}</title>
        </circle>
      ))}
      <text x={PAD.l} y={H - 6} className="axis">
        {label(points[0].date)}
      </text>
      <text x={W - PAD.r} y={H - 6} textAnchor="end" className="axis">
        {label(points[points.length - 1].date)}
      </text>
    </svg>
  )
}
