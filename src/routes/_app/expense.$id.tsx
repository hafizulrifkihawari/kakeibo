import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { isoDate } from '../../client/format'
import { monthQuery } from '../../client/queries'
import { Empty } from '../../components/bits'
import { ExpenseForm } from '../../components/ExpenseForm'

export const Route = createFileRoute('/_app/expense/$id')({
  validateSearch: (s: Record<string, unknown>): { date: string } => ({
    date: typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : isoDate(),
  }),
  component: EditExpense,
})

function EditExpense() {
  const { id } = Route.useParams()
  const { date } = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const q = useQuery(monthQuery(date.slice(0, 7)))
  const expense = q.data?.find((e) => e.id === id)

  return (
    <main className="page stack">
      <div className="row">
        <button className="icon-btn" aria-label="Back" onClick={() => router.history.back()}>
          ←
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>
          Edit expense
        </h1>
      </div>
      {q.isPending ? (
        <div className="card empty">Loading…</div>
      ) : expense ? (
        <ExpenseForm
          key={expense.id}
          initial={expense}
          suggestedCategory={expense.categoryId}
          isNew={false}
          onDone={(saved) => navigate({ to: '/day/$date', params: { date: saved?.date ?? date } })}
        />
      ) : (
        <div className="card">
          <Empty emoji="🔍">This expense was not found. It may have been deleted.</Empty>
        </div>
      )}
    </main>
  )
}
