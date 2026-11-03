import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CATEGORY_BY_ID, type CategoryId } from '../../shared/categories'
import type { Expense } from '../../shared/types'
import { ONCE_A_MONTH, projectMonth } from '../../shared/budget'
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

/** A bar with rounded top corners, standing on the baseline `y0`. Negative values hang below it. */
function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y0 - y1)
  const r = Math.min(4, w / 2, h)
  if (y1 <= y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`
}

function compactYen(v: number): string {
  const a = Math.abs(v)
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 10_000 ? `${Math.round(a / 1000)}k` : yen(a).slice(1)
  return `${v < 0 ? '−' : ''}¥${s}`
}

export function ChartLegend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="chart-legend small">
      {items.map((i) => (
        <span key={i.label}>
          <span className={i.line ? 'swatch line' : 'swatch'} style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Income and spending for each month, side by side, with the net amount as a line.
 * Tap a month to read its numbers.
 */
export function MonthlyBars({ months }: { months: { ym: string; spent: number; income: number }[] }) {
  const lastWithData = months.reduce((at, m, i) => (m.spent || m.income ? i : at), months.length - 1)
  const [sel, setSel] = useState(lastWithData)
  const W = 340
  const H = 180
  const PAD = { l: 44, r: 8, t: 12, b: 22 }
  const nets = months.map((m) => m.income - m.spent)
  const hi = Math.max(1, ...months.map((m) => Math.max(m.income, m.spent)), ...nets)
  const lo = Math.min(0, ...nets)
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  const slot = (W - PAD.l - PAD.r) / months.length
  const bw = Math.max(3, Math.min(14, (slot - 8) / 2))
  const cx = (i: number) => PAD.l + slot * (i + 0.5)
  const net = nets.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const short = months.length > 6
  const m = months[Math.min(sel, months.length - 1)]

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Income', color: 'var(--income)' },
          { label: 'Spent', color: 'var(--spend)' },
          { label: 'Net', color: 'var(--ink)', line: true },
        ]}
      />
      <div className="readout small" aria-live="polite">
        <b>{Number(m.ym.slice(5, 7))}月</b>
        <span className="num">In {yen(m.income)}</span>
        <span className="num">Out {yen(m.spent)}</span>
        <span className="num" style={m.income - m.spent < 0 ? { color: 'var(--danger)' } : undefined}>
          Net {yen(m.income - m.spent)}
        </span>
        <Link to="/month/$ym" params={{ ym: m.ym }} style={{ color: 'var(--link)', marginLeft: 'auto' }}>
          Open →
        </Link>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Income and spending by month. Highest month total ${yen(hi)}.`}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={y(hi)} y2={y(hi)} className="grid" />
        <text x={PAD.l - 6} y={y(hi) + 4} textAnchor="end" className="axis">
          {compactYen(hi)}
        </text>
        {lo < 0 && (
          <text x={PAD.l - 6} y={y(lo) + 4} textAnchor="end" className="axis">
            {compactYen(lo)}
          </text>
        )}
        <rect
          x={cx(sel) - slot / 2 + 1}
          y={PAD.t - 6}
          width={slot - 2}
          height={H - PAD.t - PAD.b + 6}
          rx={6}
          className="sel-band"
        />
        {months.map((mo, i) => (
          <g key={mo.ym}>
            {mo.income > 0 && <path d={barPath(cx(i) - bw - 1, bw, y(0), y(mo.income))} fill="var(--income)" />}
            {mo.spent > 0 && <path d={barPath(cx(i) + 1, bw, y(0), y(mo.spent))} fill="var(--spend)" />}
            <text x={cx(i)} y={H - 6} textAnchor="middle" className={i === sel ? 'axis on' : 'axis'}>
              {short ? Number(mo.ym.slice(5, 7)) : `${Number(mo.ym.slice(5, 7))}月`}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="base" />
        {months.length > 1 && <path d={net} className="net" />}
        {nets.map((v, i) => (
          <circle key={i} cx={cx(i)} cy={y(v)} r={4} className="net-dot" />
        ))}
        {months.map((mo, i) => (
          <rect
            key={mo.ym}
            x={cx(i) - slot / 2}
            y={0}
            width={slot}
            height={H}
            className="hit"
            onClick={() => setSel(i)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setSel(i)}
          >
            <title>{`${mo.ym}: income ${yen(mo.income)}, spent ${yen(mo.spent)}`}</title>
          </rect>
        ))}
      </svg>
      <details className="chart-table small">
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Spent</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((mo) => (
              <tr key={mo.ym}>
                <td>{Number(mo.ym.slice(5, 7))}月</td>
                <td className="num">{yen(mo.income)}</td>
                <td className="num">{yen(mo.spent)}</td>
                <td className="num">{yen(mo.income - mo.spent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/**
 * Spending in one month as a running total, with the budget, an even pace to the budget,
 * and the month-end projection when the month is still running.
 */
export function CumulativeLine({ ym, expenses, limit }: { ym: string; expenses: Expense[]; limit: number }) {
  const days = daysInMonth(ym)
  const today = isoDate()
  const last = ym < today.slice(0, 7) ? days : ym > today.slice(0, 7) ? 0 : Number(today.slice(8, 10))
  const byDay = sumBy(expenses, (e) => e.date)
  const run: number[] = []
  for (let d = 1, sum = 0; d <= last; d++) {
    sum += byDay.get(`${ym}-${String(d).padStart(2, '0')}`) ?? 0
    run.push(sum)
  }
  const total = run[run.length - 1] ?? 0
  const once = expenses.filter((e) => ONCE_A_MONTH.includes(e.categoryId)).reduce((s, e) => s + e.amount, 0)
  const projected = last && last < days ? projectMonth(total, once, last, days) : total
  const [hover, setHover] = useState<number | null>(null)

  const W = 340
  const H = 170
  const PAD = { l: 44, r: 12, t: 14, b: 22 }
  const hi = Math.max(1, limit, projected, total) * 1.05
  const x = (d: number) => PAD.l + (d / days) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b)
  const line = [`M${x(0)},${y(0)}`, ...run.map((v, i) => `L${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`)].join(' ')
  const at = hover ?? last
  const atValue = at ? run[at - 1] : 0

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - box.left) / box.width) * W
    const d = Math.round(((vx - PAD.l) / (W - PAD.l - PAD.r)) * days)
    setHover(last ? Math.min(last, Math.max(1, d)) : null)
  }

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Spent so far', color: 'var(--spend)', line: true },
          ...(limit ? [{ label: 'Budget', color: 'var(--muted)', line: true }] : []),
        ]}
      />
      <div className="readout small" aria-live="polite">
        {at ? (
          <>
            <b>{`${Number(ym.slice(5, 7))}月${at}日`}</b>
            <span className="num">{yen(atValue)} so far</span>
            {hover === null && projected !== total && (
              <span className="num muted">→ {yen(projected)} at month end</span>
            )}
          </>
        ) : (
          <span className="muted">This month has not started.</span>
        )}
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Spent ${yen(total)} by day ${last}${limit ? ` of a ${yen(limit)} budget` : ''}.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="base" />
        {limit > 0 && (
          <g>
            <line x1={x(0)} y1={y(0)} x2={x(days)} y2={y(limit)} className="pace" />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(limit)} y2={y(limit)} className="limit" />
            <text x={PAD.l - 6} y={y(limit) + 4} textAnchor="end" className="axis">
              {compactYen(limit)}
            </text>
          </g>
        )}
        {(!limit || Math.abs(y(projected) - y(limit)) > 14) && projected > 0 && (
          <text x={PAD.l - 6} y={y(projected) + 4} textAnchor="end" className="axis">
            {compactYen(projected)}
          </text>
        )}
        {last > 0 && last < days && (
          <line x1={x(last)} y1={y(total)} x2={x(days)} y2={y(projected)} className="projection" />
        )}
        {last > 0 && <path d={line} className="spend-line" />}
        {at > 0 && (
          <>
            {hover !== null && <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={y(0)} className="crosshair" />}
            <circle cx={x(at)} cy={y(atValue)} r={4.5} className="end-dot" />
          </>
        )}
        {[1, Math.ceil(days / 2), days].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="axis">
            {d}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Share of each category as a ring, with the total in the middle. Rows below the ring name the colors. */
export function CategoryDonut({ rows, total }: { rows: { id: CategoryId; amount: number }[]; total: number }) {
  const R = 62
  const C = 2 * Math.PI * R
  const parts = rows.filter((r) => r.amount > 0)
  let start = 0
  return (
    <svg className="donut" viewBox="0 0 160 160" role="img" aria-label={`Spending by category, total ${yen(total)}`}>
      <circle cx={80} cy={80} r={R} className="donut-track" />
      {parts.map((r) => {
        const len = (r.amount / total) * C
        // A 2px surface gap between parts. One part fills the whole ring.
        const dash = parts.length > 1 ? Math.max(0.5, len - 2) : C
        const el = (
          <circle
            key={r.id}
            cx={80}
            cy={80}
            r={R}
            className="donut-part"
            style={{ stroke: CATEGORY_BY_ID[r.id].color }}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-start}
            transform="rotate(-90 80 80)"
          >
            <title>{`${CATEGORY_BY_ID[r.id].en}: ${yen(r.amount)} (${Math.round((r.amount / total) * 100)}%)`}</title>
          </circle>
        )
        start += len
        return el
      })}
      <text x={80} y={78} textAnchor="middle" className="donut-total">
        {compactYen(total)}
      </text>
      <text x={80} y={96} textAnchor="middle" className="donut-label">
        spent
      </text>
    </svg>
  )
}

/** A ranked list with a bar for each row, scaled to the largest row. */
export function RankBars({
  rows,
  color,
}: {
  rows: { key: string; icon?: string; label: string; sub?: string; amount: number }[]
  color: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  return (
    <div className="cat-bars">
      {rows.map((r) => (
        <div key={r.key} className="cat-bar-row rank-row">
          <span className="rank-icon" aria-hidden>
            {r.icon ?? '•'}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="spread small">
              <span className="ellipsis">
                {r.label}
                {r.sub && <span className="muted"> · {r.sub}</span>}
              </span>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${(r.amount / max) * 100}%`, background: color }} />
            </div>
          </div>
          <span className="num small" style={{ fontWeight: 500 }}>
            {yen(r.amount)}
          </span>
        </div>
      ))}
    </div>
  )
}
