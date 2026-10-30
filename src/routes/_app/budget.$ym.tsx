import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CATEGORIES } from '../../../shared/categories'
import type { Budget, BudgetScope } from '../../../shared/budget'
import { addMonths, monthLabel } from '../../client/format'
import { budgetsQuery, monthQuery } from '../../client/queries'
import { BudgetMeter, CategoryDot, MoneyInput } from '../../components/bits'
import { sumBy } from '../../components/charts'

export const Route = createFileRoute('/_app/budget/$ym')({
  params: {
    parse: ({ ym }) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw notFound()
      return { ym }
    },
  },
  component: BudgetView,
})

function toInt(s: string): number {
  const n = parseInt(s.normalize('NFKC').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function BudgetView() {
  const { ym } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })
  const budgets = useQuery(budgetsQuery)
  const month = useQuery(monthQuery(ym))
  const [editing, setEditing] = useState(false)

  const limits = new Map((budgets.data ?? []).map((b) => [b.scope, b.amount]))
  const list = month.data ?? []
  const total = list.reduce((s, e) => s + e.amount, 0)
  const byCat = sumBy(list, (e) => e.categoryId)
  const go = (delta: number) => navigate({ params: { ym: addMonths(ym, delta) } })

  return (
    <main className="page stack">
      <div className="month-picker">
        <button className="icon-btn" aria-label="Previous month" onClick={() => go(-1)}>
          ‹
        </button>
        <h1>{monthLabel(ym)}</h1>
        <button className="icon-btn" aria-label="Next month" onClick={() => go(1)}>
          ›
        </button>
      </div>

      {editing ? (
        <BudgetForm limits={limits} onDone={() => setEditing(false)} />
      ) : (
        <>
          <section className="card stack">
            <div className="spread">
              <span style={{ fontWeight: 500 }}>Monthly budget</span>
              <button className="btn btn-ghost small" style={{ minHeight: 36 }} onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
            {limits.get('total') ? (
              <BudgetMeter ym={ym} limit={limits.get('total')!} spent={total} detail />
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                No monthly budget yet. Tap Edit to set one.
              </p>
            )}
          </section>

          {CATEGORIES.some((c) => limits.get(c.id)) && (
            <section className="card stack">
              <div style={{ fontWeight: 500 }}>Category limits</div>
              {CATEGORIES.filter((c) => limits.get(c.id)).map((c) => (
                <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <CategoryDot id={c.id} />
                  <div style={{ flex: 1 }}>
                    <div className="small">
                      {c.en}
                      <span className="ja">{c.ja}</span>
                    </div>
                    <BudgetMeter ym={ym} limit={limits.get(c.id)!} spent={byCat.get(c.id) ?? 0} color={c.color} />
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}

function BudgetForm({ limits, onDone }: { limits: Map<BudgetScope, number>; onDone: () => void }) {
  const save = useMutation<unknown, Error, Budget>({ mutationKey: ['saveBudget'] })
  const scopes: BudgetScope[] = ['total', ...CATEGORIES.map((c) => c.id)]
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(scopes.map((s) => [s, limits.get(s) ? String(limits.get(s)) : ''])),
  )

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const now = Date.now()
    for (const scope of scopes) {
      const amount = toInt(values[scope] ?? '')
      if (amount !== (limits.get(scope) ?? 0)) save.mutate({ scope, amount, updatedAt: now })
    }
    onDone()
  }

  const field = (scope: BudgetScope) => (
    <MoneyInput
      className="input num"
      placeholder="No limit"
      value={values[scope]}
      onChange={(raw) => setValues((v) => ({ ...v, [scope]: raw }))}
    />
  )

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div style={{ fontWeight: 500 }}>Edit budget</div>
      <p className="muted small" style={{ margin: 0 }}>
        The limits apply to every month. Leave a field empty for no limit.
      </p>
      <label className="field">
        <span>Monthly budget (¥)</span>
        {field('total')}
      </label>
      <div className="section-label" style={{ margin: 0 }}>
        Category limits (¥)
      </div>
      {CATEGORIES.map((c) => (
        <label key={c.id} className="field">
          <span>
            {c.icon} {c.en} <span className="ja">{c.ja}</span>
          </span>
          {field(c.id)}
        </label>
      ))}
      <button className="btn btn-primary btn-block">Save</button>
      <button type="button" className="btn btn-block" onClick={onDone}>
        Cancel
      </button>
    </form>
  )
}
