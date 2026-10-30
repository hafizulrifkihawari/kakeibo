import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { INCOME_BY_ID, INCOME_SOURCES, type Income, type IncomeSource } from '../../../shared/income'
import { addMonths, dayLabel, isoDate, isoMonth, monthLabel, uuid, yen } from '../../client/format'
import { incomeQuery, monthQuery, type DeleteVars, type SaveIncomeVars } from '../../client/queries'
import { Empty, MoneyInput } from '../../components/bits'

export const Route = createFileRoute('/_app/income/$ym')({
  params: {
    parse: ({ ym }) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) throw notFound()
      return { ym }
    },
  },
  component: IncomeView,
})

function toInt(s: string): number {
  const n = parseInt(s.normalize('NFKC').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function IncomeView() {
  const { ym } = Route.useParams()
  const navigate = useNavigate({ from: Route.fullPath })
  const income = useQuery(incomeQuery(ym))
  const spent = useQuery(monthQuery(ym))
  // The income being edited, or null for a new one.
  const [editing, setEditing] = useState<Income | null>(null)

  const list = income.data ?? []
  const total = list.reduce((s, i) => s + i.amount, 0)
  const spentTotal = (spent.data ?? []).reduce((s, e) => s + e.amount, 0)
  const go = (delta: number) => {
    setEditing(null)
    navigate({ params: { ym: addMonths(ym, delta) } })
  }

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

      <section className="card">
        <div className="muted small">Income this month</div>
        <div className="big-amount num">{yen(total)}</div>
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat">
            <div className="label">Spent</div>
            <div className="value num">{yen(spentTotal)}</div>
          </div>
          <div className="stat">
            <div className="label">Left</div>
            <div className="value num" style={total - spentTotal < 0 ? { color: 'var(--danger)' } : undefined}>
              {yen(total - spentTotal)}
            </div>
          </div>
        </div>
      </section>

      <IncomeForm
        // A new key resets the form when the user picks another row or changes the month.
        key={editing?.id ?? `new-${ym}`}
        ym={ym}
        initial={editing}
        onDone={() => setEditing(null)}
      />

      <section>
        <div className="section-label">Income</div>
        <div className="list">
          {income.isPending ? (
            <div className="empty">Loading…</div>
          ) : list.length ? (
            list.map((i) => {
              const s = INCOME_BY_ID[i.source]
              return (
                <button
                  key={i.id}
                  type="button"
                  className="list-row income-row"
                  aria-pressed={editing?.id === i.id}
                  onClick={() => setEditing(i)}
                >
                  <span className="cat-dot" style={{ '--dot-color': 'var(--accent)' } as React.CSSProperties} aria-hidden>
                    {s.icon}
                  </span>
                  <div className="main">
                    <div className="title">{i.note || s.en}</div>
                    <div className="sub">
                      {s.en} <span className="ja">{s.ja}</span> · {dayLabel(i.date)}
                    </div>
                  </div>
                  <div className="amount num" style={{ color: 'var(--link)' }}>
                    +{yen(i.amount)}
                  </div>
                </button>
              )
            })
          ) : (
            <Empty emoji="💴">No income recorded for {monthLabel(ym)}.</Empty>
          )}
        </div>
      </section>
    </main>
  )
}

function IncomeForm({ ym, initial, onDone }: { ym: string; initial: Income | null; onDone: () => void }) {
  const save = useMutation<unknown, Error, SaveIncomeVars>({ mutationKey: ['saveIncome'] })
  const remove = useMutation<unknown, Error, DeleteVars>({ mutationKey: ['deleteIncome'] })
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? (ym === isoMonth() ? isoDate() : `${ym}-01`))
  const [source, setSource] = useState<IncomeSource>(initial?.source ?? 'salary')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = toInt(amount)
    if (n <= 0) return setError('Enter an amount.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter a valid date.')
    setError('')
    save.mutate({
      income: { id: initial?.id ?? uuid(), date, amount: n, source, note: note.trim(), updatedAt: Date.now() },
      prevDate: initial?.date,
    })
    setAmount('')
    setNote('')
    onDone()
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div style={{ fontWeight: 500 }}>{initial ? 'Edit income' : 'Add income'}</div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <label className="field">
        <span>Amount (¥)</span>
        <MoneyInput
          className="input amount-input num"
          placeholder="0"
          value={amount}
          onChange={setAmount}
        />
      </label>
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Source">
        {INCOME_SOURCES.map((s) => (
          <button key={s.id} type="button" className="chip" aria-pressed={source === s.id} onClick={() => setSource(s.id)}>
            <span aria-hidden>{s.icon}</span>
            {s.en}
            <span className="ja">{s.ja}</span>
          </button>
        ))}
      </div>
      <label className="field">
        <span>Note</span>
        <input className="input" value={note} placeholder="e.g. October pay" onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn btn-primary btn-block">{initial ? 'Save' : 'Add income'}</button>
      {initial && (
        <div className="row">
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onDone}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ flex: 1 }}
            onClick={() => {
              if (!confirm('Delete this income?')) return
              remove.mutate({ id: initial.id, date: initial.date })
              onDone()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </form>
  )
}
