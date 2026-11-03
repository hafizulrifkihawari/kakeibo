import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { CATEGORY_BY_ID } from '../../../shared/categories'
import { INCOME_BY_ID } from '../../../shared/income'
import { KIND_BY_ID } from '../../../shared/products'
import { budgetStatus, ONCE_A_MONTH, type Budget } from '../../../shared/budget'
import {
  buildReport,
  change,
  insights,
  periodRange,
  type Insight,
  type Report,
  type ReportPeriod,
} from '../../../shared/report'
import { addMonths, daysInMonth, isoDate, isoMonth, yen } from '../../client/format'
import { budgetsQuery, monthQuery, reportQuery, reportSummaryQuery } from '../../client/queries'
import { BudgetMeter, CategoryDot, Empty, useOnline } from '../../components/bits'
import { CategoryDonut, CumulativeLine, MonthlyBars, RankBars } from '../../components/charts'

type Kind = ReportPeriod['kind']

interface Search {
  p?: Kind
  ym?: string
  y?: number
}

export const Route = createFileRoute('/_app/report')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    p: s.p === 'month' || s.p === 'ytd' || s.p === 'year' ? s.p : undefined,
    ym: typeof s.ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.ym) ? s.ym : undefined,
    y: Number.isInteger(Number(s.y)) && Number(s.y) >= 2000 && Number(s.y) <= 2100 ? Number(s.y) : undefined,
  }),
  component: ReportView,
})

function toPeriod(s: Search): ReportPeriod {
  if (s.p === 'ytd') return { kind: 'ytd' }
  if (s.p === 'year') return { kind: 'year', year: s.y ?? new Date().getFullYear() - 1 }
  return { kind: 'month', ym: s.ym ?? isoMonth() }
}

/** A short stable hash, so the AI summary is cached per set of numbers. */
function hashOf(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** What the AI sees: sums and names only. */
function factsOf(r: Report, budgets: Budget[], found: Insight[]) {
  return {
    period: r.range.label,
    from: r.range.from,
    to: r.range.to,
    days: r.range.days,
    comparedWith: r.range.prevLabel,
    spent: r.spent,
    income: r.income,
    previousSpent: r.prevSpent,
    previousIncome: r.prevIncome,
    months: r.months.length > 1 ? r.months : undefined,
    categories: r.categories.map((c) => ({ name: CATEGORY_BY_ID[c.id].en, spent: c.amount, previous: c.prev })),
    income_sources: r.sources.map((s) => ({ name: INCOME_BY_ID[s.id].en, amount: s.amount })),
    top_stores: r.stores,
    item_kinds: r.kinds.slice(0, 8).map((k) => ({ name: KIND_BY_ID[k.kind].en, amount: k.amount })),
    monthly_budgets: budgets.map((b) => ({
      scope: b.scope === 'total' ? 'total' : CATEGORY_BY_ID[b.scope].en,
      limit: b.amount,
    })),
    findings: found.map((i) => i.text),
  }
}

const KINDS: { id: Kind; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'ytd', label: 'YTD' },
  { id: 'year', label: 'Year' },
]

function ReportView() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const period = toPeriod(search)
  const today = isoDate()
  const range = periodRange(period, today)
  const q = useQuery(reportQuery(range))
  const budgets = useQuery(budgetsQuery)
  const ym = period.kind === 'month' ? period.ym : isoMonth()
  const month = useQuery({ ...monthQuery(ym), enabled: period.kind === 'month' })

  const curYear = new Date().getFullYear()
  const canNext = period.kind === 'month' ? period.ym < isoMonth() : period.kind === 'year' && period.year < curYear
  const go = (delta: number) => {
    if (period.kind === 'month') navigate({ search: { p: 'month', ym: addMonths(period.ym, delta) } })
    else if (period.kind === 'year') navigate({ search: { p: 'year', y: period.year + delta } })
  }
  const step = (delta: number) => (delta < 0 || canNext) && go(delta)

  // Swipe left or right to change the month or year.
  const touch = useRef<{ x: number; y: number } | null>(null)

  const report = q.data ? buildReport(range, q.data) : null
  const limits = budgets.data ?? []
  const found = report ? insights(report, limits, today) : []
  const empty = report && !report.spent && !report.income

  return (
    <main
      className="page stack"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current
        touch.current = null
        if (!t || period.kind === 'ytd') return
        const dx = e.changedTouches[0].clientX - t.x
        const dy = e.changedTouches[0].clientY - t.y
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
      }}
    >
      <div className="chips seg" role="group" aria-label="Report period">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className="chip"
            aria-pressed={period.kind === k.id}
            onClick={() => navigate({ search: { p: k.id } })}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="month-picker">
        {period.kind === 'ytd' ? (
          <span className="icon-btn" aria-hidden />
        ) : (
          <button className="icon-btn" aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
        )}
        <h1>{range.label}</h1>
        {period.kind === 'ytd' ? (
          <span className="icon-btn" aria-hidden />
        ) : (
          <button className="icon-btn" aria-label="Next" disabled={!canNext} onClick={() => step(1)}>
            ›
          </button>
        )}
      </div>

      {!report ? (
        <div className="list">
          <div className="empty">{q.isError ? 'Could not load the report.' : 'Loading…'}</div>
        </div>
      ) : empty ? (
        <div className="list">
          <Empty emoji="🌱">Nothing recorded for {range.label}.</Empty>
        </div>
      ) : (
        <>
          <Totals r={report} />
          <InsightsCard r={report} found={found} budgets={limits} />

          <section className="card">
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              {period.kind === 'month' ? 'Spending through the month' : 'Month by month'}
            </div>
            {period.kind === 'month' ? (
              <CumulativeLine
                ym={period.ym}
                expenses={month.data ?? []}
                limit={limits.find((b) => b.scope === 'total')?.amount ?? 0}
              />
            ) : (
              <MonthlyBars months={report.months} />
            )}
          </section>

          {report.spent > 0 && <Categories r={report} ym={period.kind === 'month' ? period.ym : undefined} />}
          {limits.length > 0 && <BudgetCard r={report} budgets={limits} ym={period.kind === 'month' ? period.ym : undefined} />}

          {report.sources.length > 0 && (
            <section className="card">
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Income by source</div>
              <RankBars
                color="var(--income)"
                rows={report.sources.map((s) => ({
                  key: s.id,
                  icon: INCOME_BY_ID[s.id].icon,
                  label: INCOME_BY_ID[s.id].en,
                  amount: s.amount,
                }))}
              />
            </section>
          )}

          {report.stores.length > 0 && (
            <section className="card">
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Top stores</div>
              <RankBars
                color="var(--spend)"
                rows={report.stores.map((s) => ({
                  key: s.store,
                  icon: '🏬',
                  label: s.store,
                  sub: `${s.count} ${s.count === 1 ? 'visit' : 'visits'}`,
                  amount: s.amount,
                }))}
              />
            </section>
          )}

          {report.kinds.length > 0 && (
            <section className="card">
              <div className="spread" style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>Items by kind</span>
                <span className="muted small">From receipt lines</span>
              </div>
              <RankBars
                color="var(--spend)"
                rows={report.kinds.slice(0, 8).map((k) => ({
                  key: k.kind,
                  icon: KIND_BY_ID[k.kind].icon,
                  label: KIND_BY_ID[k.kind].en,
                  amount: k.amount,
                }))}
              />
            </section>
          )}
        </>
      )}
    </main>
  )
}

function Delta({ now, prev, invert = false }: { now: number; prev: number; invert?: boolean }) {
  const pct = change(now, prev)
  if (pct === null || pct === 0) return null
  // For spending, up is bad. For income, up is good.
  const bad = invert ? pct < 0 : pct > 0
  return (
    <span className="delta num" style={{ color: bad ? 'var(--price-up)' : 'var(--price-down)' }}>
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

function Totals({ r }: { r: Report }) {
  const net = r.income - r.spent
  return (
    <section className="card">
      <div className="muted small">Spent</div>
      <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
        <div className="big-amount num">{yen(r.spent)}</div>
        <Delta now={r.spent} prev={r.prevSpent} />
      </div>
      {r.prevSpent > 0 && (
        <div className="muted small">
          {yen(r.prevSpent)} in {r.range.prevLabel}
        </div>
      )}
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">
            Income <Delta now={r.income} prev={r.prevIncome} invert />
          </div>
          <div className="value num">{yen(r.income)}</div>
        </div>
        <div className="stat">
          <div className="label">Net</div>
          <div className="value num" style={net < 0 ? { color: 'var(--danger)' } : undefined}>
            {yen(net)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Daily average</div>
          <div className="value num">{yen(Math.round(r.spent / r.range.days))}</div>
        </div>
        <div className="stat">
          <div className="label">Kept</div>
          <div className="value num">{r.income > 0 ? `${Math.round((net / r.income) * 100)}%` : '—'}</div>
        </div>
      </div>
    </section>
  )
}

function InsightsCard({ r, found, budgets }: { r: Report; found: Insight[]; budgets: Budget[] }) {
  const online = useOnline()
  const facts = factsOf(r, budgets, found)
  const summary = useQuery(reportSummaryQuery(r.range, hashOf(JSON.stringify(facts)), facts))
  return (
    <section className="card">
      <div style={{ fontWeight: 500, marginBottom: 8 }}>Insights</div>
      {found.length ? (
        <ul className="insights">
          {found.map((i) => (
            <li key={i.text}>
              <span aria-hidden>{i.icon}</span>
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="muted small">Add more expenses and income to see what changed.</div>
      )}

      <div className="ai-summary">
        {summary.data && (
          <>
            <ul className="insights">
              {summary.data.map((b) => (
                <li key={b}>
                  <span aria-hidden>✨</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="muted small">Written by AI from your totals. Check the numbers before you act.</div>
          </>
        )}
        {summary.isError && !summary.isFetching && (
          <div className="error small" role="alert">
            {summary.error.message}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-ghost small"
            disabled={!online || summary.isFetching}
            onClick={() => summary.refetch()}
          >
            {summary.isFetching ? 'Writing…' : summary.data ? 'Refresh summary' : '✨ Summarize with AI'}
          </button>
          {!online && <span className="muted small">Needs a connection</span>}
        </div>
      </div>
    </section>
  )
}

function Categories({ r, ym }: { r: Report; ym?: string }) {
  const rows = r.categories.filter((c) => c.amount > 0)
  const max = Math.max(1, ...rows.map((c) => c.amount))
  return (
    <section className="card">
      <div style={{ fontWeight: 500, marginBottom: 8 }}>By category</div>
      <CategoryDonut rows={rows} total={r.spent} />
      <div className="cat-bars">
        {rows.map((c) => {
          const cat = CATEGORY_BY_ID[c.id]
          const body = (
            <>
              <CategoryDot id={c.id} />
              <div style={{ minWidth: 0 }}>
                <div className="spread small">
                  <span>
                    {cat.en}
                    <span className="ja">{cat.ja}</span>
                  </span>
                  <span className="muted">{Math.round((c.amount / r.spent) * 100)}%</span>
                </div>
                <div className="track">
                  <div className="fill" style={{ width: `${(c.amount / max) * 100}%`, background: cat.color }} />
                </div>
              </div>
              <span className="num small" style={{ fontWeight: 500, textAlign: 'right' }}>
                {yen(c.amount)}
                <br />
                {c.prev > 0 ? <Delta now={c.amount} prev={c.prev} /> : <span className="delta muted">new</span>}
              </span>
            </>
          )
          return ym ? (
            <Link key={c.id} to="/month/$ym" params={{ ym }} search={{ cat: c.id }} className="cat-bar-row rank-row">
              {body}
            </Link>
          ) : (
            <div key={c.id} className="cat-bar-row rank-row">
              {body}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function BudgetCard({ r, budgets, ym }: { r: Report; budgets: Budget[]; ym?: string }) {
  const total = budgets.find((b) => b.scope === 'total')?.amount ?? 0
  if (ym) {
    return (
      <Link to="/budget/$ym" params={{ ym }} className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>Budget</span>
          <span className="small" style={{ color: 'var(--link)' }}>
            Details →
          </span>
        </div>
        {total ? (
          <BudgetMeter
            ym={ym}
            limit={total}
            spent={r.spent}
            once={r.categories.filter((c) => ONCE_A_MONTH.includes(c.id)).reduce((s, c) => s + c.amount, 0)}
          />
        ) : (
          <div className="muted small">Only category limits are set.</div>
        )}
      </Link>
    )
  }
  if (!total) return null
  const cur = isoMonth()
  return (
    <section className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 500 }}>Budget by month</span>
        <span className="muted small num">{yen(total)} / month</span>
      </div>
      <div className="budget-months">
        {r.months.map((m) => {
          const days = daysInMonth(m.ym)
          // No spending: the month has not started, or it is before the user started the app.
          const future = m.ym > cur || m.spent === 0
          const once = r.catMonths
            .filter((c) => c.ym === m.ym && ONCE_A_MONTH.includes(c.id))
            .reduce((sum, c) => sum + c.amount, 0)
          const s = budgetStatus(total, m.spent, m.ym === cur ? new Date().getDate() : days, days, once)
          const state = future ? 'future' : s.pace
          const mark = future ? '·' : s.pace === 'over' ? '✕' : s.pace === 'fast' ? '!' : '✓'
          const word = future ? 'no spending' : s.pace === 'over' ? 'over' : s.pace === 'fast' ? 'on pace to go over' : 'inside'
          return (
            <Link
              key={m.ym}
              to="/budget/$ym"
              params={{ ym: m.ym }}
              className={`budget-month ${state}`}
              aria-label={`${m.ym}: ${yen(m.spent)}, ${word}`}
              title={`${yen(m.spent)} — ${word}`}
            >
              <span className="small">{Number(m.ym.slice(5, 7))}月</span>
              <span aria-hidden>{mark}</span>
            </Link>
          )
        })}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        ✓ inside · ! on pace to go over · ✕ over
      </div>
    </section>
  )
}
