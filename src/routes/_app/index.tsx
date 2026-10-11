import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { addMonths, isoDate, isoMonth, yen } from '../../client/format'
import { budgetsQuery, incomeQuery, monthQuery } from '../../client/queries'
import { BudgetMeter, Empty, ExpenseRow } from '../../components/bits'
import { WeekBars } from '../../components/charts'

export const Route = createFileRoute('/_app/')({ component: Home })

function Home() {
  const ym = isoMonth()
  const month = useQuery(monthQuery(ym))
  // The 7-day chart can reach into last month during the first week.
  const income = useQuery(incomeQuery(ym))
  const budgets = useQuery(budgetsQuery)
  const prev = useQuery({ ...monthQuery(addMonths(ym, -1)), enabled: new Date().getDate() < 7 })

  const list = month.data ?? []
  const today = isoDate()
  const todayTotal = list.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0)
  const monthTotal = list.reduce((s, e) => s + e.amount, 0)
  const avg = Math.round(monthTotal / new Date().getDate())
  const incomeTotal = (income.data ?? []).reduce((s, i) => s + i.amount, 0)
  const totalLimit = budgets.data?.find((b) => b.scope === 'total')?.amount ?? 0
  const recent = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)

  return (
    <main className="page stack">
      <section className="card">
        <div className="muted small">Today</div>
        <div className="big-amount num">{yen(todayTotal)}</div>
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat">
            <div className="label">This month</div>
            <div className="value num">{yen(monthTotal)}</div>
          </div>
          <div className="stat">
            <div className="label">Daily average</div>
            <div className="value num">{yen(avg)}</div>
          </div>
        </div>
      </section>

      <Link to="/budget/$ym" params={{ ym }} className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>Budget</span>
          <span className="small" style={{ color: 'var(--accent)' }}>
            {totalLimit ? 'Details →' : 'Set →'}
          </span>
        </div>
        {totalLimit ? (
          <BudgetMeter ym={ym} limit={totalLimit} spent={monthTotal} detail />
        ) : (
          <div className="muted small">Set a monthly budget to see what is left and your pace.</div>
        )}
      </Link>

      <Link to="/income/$ym" params={{ ym }} className="card" style={{ display: 'block', color: 'inherit' }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>Income</span>
          <span className="small" style={{ color: 'var(--accent)' }}>
            {incomeTotal ? 'Details →' : 'Add →'}
          </span>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">This month</div>
            <div className="value num">{yen(incomeTotal)}</div>
          </div>
          <div className="stat">
            <div className="label">Left</div>
            <div className="value num" style={incomeTotal - monthTotal < 0 ? { color: 'var(--danger)' } : undefined}>
              {yen(incomeTotal - monthTotal)}
            </div>
          </div>
        </div>
      </Link>

      <section className="card">
        <div className="spread" style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>Last 7 days</span>
          <Link to="/month/$ym" params={{ ym }} className="small" style={{ color: 'var(--accent)' }}>
            Calendar →
          </Link>
        </div>
        <WeekBars expenses={[...list, ...(prev.data ?? [])]} />
      </section>

      <section>
        <div className="section-label">Recent</div>
        {month.isPending ? (
          <div className="list">
            <div className="empty">Loading…</div>
          </div>
        ) : recent.length ? (
          <div className="list">
            {recent.map((e) => (
              <ExpenseRow key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <div className="list">
            <Empty emoji="🧾">
              No expenses this month yet.
              <br />
              Tap <b>+</b> and scan your first receipt.
            </Empty>
          </div>
        )}
      </section>
    </main>
  )
}
