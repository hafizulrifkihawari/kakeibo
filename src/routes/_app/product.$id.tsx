import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ITEM_KINDS, KIND_BY_ID, perLabel, type ItemKind, type Purchase } from '../../../shared/products'
import { yen } from '../../client/format'
import { keys, productQuery } from '../../client/queries'
import { setProductKind } from '../../server/fns'
import { Empty } from '../../components/bits'
import { PriceChart } from '../../components/charts'

export const Route = createFileRoute('/_app/product/$id')({
  params: {
    parse: ({ id }) => {
      if (!/^\d+$/.test(id)) throw notFound()
      return { id }
    },
  },
  component: ProductView,
})

/** The lowest price at each store, cheapest first. */
function byStore(list: Purchase[]): { store: string; min: number; count: number }[] {
  const m = new Map<string, { store: string; min: number; count: number }>()
  for (const p of list) {
    const store = p.store || '—'
    const s = m.get(store) ?? { store, min: Infinity, count: 0 }
    s.min = Math.min(s.min, p.price)
    s.count++
    m.set(store, s)
  }
  return [...m.values()].sort((a, b) => a.min - b.min)
}

function ProductView() {
  const id = Number(Route.useParams().id)
  const qc = useQueryClient()
  const q = useQuery(productQuery(id))
  const changeKind = useMutation({
    mutationFn: (kind: ItemKind) => setProductKind({ data: { id, kind } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.product(id) })
      qc.invalidateQueries({ queryKey: keys.products, exact: true })
    },
  })

  if (q.isPending)
    return (
      <main className="page">
        <div className="empty">Loading…</div>
      </main>
    )
  if (!q.data)
    return (
      <main className="page">
        <Empty emoji="🔍">This product does not exist.</Empty>
      </main>
    )

  const { product, purchases } = q.data
  const last = purchases[0]
  // Stats use the basis of the newest purchase: per 100 g when its weight is known, else per piece.
  const basis = last?.basis ?? 'pc'
  const comparable = purchases.filter((p) => (p.prices[basis] ?? 0) > 0).map((p) => ({ ...p, price: p.prices[basis]! }))
  const prices = comparable.map((p) => p.price)
  const min = Math.min(...prices)
  const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  const stores = byStore(comparable)
  // The newest purchase at the lowest price.
  const cheapestAt = comparable.find((p) => p.price === min) ?? last
  const per = basis !== 'pc' || comparable.some((p) => p.qty > 1) ? perLabel(basis) : ''
  const priceText = (p: Purchase) => {
    const b = p.prices[basis] !== undefined ? basis : p.basis
    return `${yen(p.prices[b]!)}${b !== 'pc' || p.qty > 1 ? perLabel(b) : ''}`
  }
  // "· ×2 350ml for ¥456", "· 412g for ¥733", or nothing for one plain piece.
  const amountText = (p: Purchase) => {
    const parts =
      p.unit !== 'pc' ? [`${p.qty}${p.unit}`] : [p.qty > 1 && `×${p.qty}`, p.pack && `${p.pack.size}${p.pack.unit}`]
    const what = parts.filter(Boolean).join(' ')
    return what ? ` · ${what} for ${yen(p.linePrice)}` : ''
  }
  const kind = changeKind.isPending ? changeKind.variables : product.kind

  return (
    <main className="page stack">
      <section className="card stack" style={{ gap: 6 }}>
        <div className="muted small">
          {KIND_BY_ID[kind].icon} {KIND_BY_ID[kind].en}
        </div>
        <h1 className="page-title" style={{ margin: 0 }}>
          {product.name}
        </h1>
        {(product.reading || product.en) && (
          <div className="gloss" style={{ margin: 0, padding: 0 }}>
            {product.reading && (
              <span className="gloss-reading" lang="ja">
                [{product.reading}]
              </span>
            )}
            {product.en && <span className="gloss-en">({product.en})</span>}
          </div>
        )}
      </section>

      {prices.length > 0 && (
        <section className="card stack">
          <div className="stat-grid">
            <div className="stat">
              <div className="label">Last price{per && ` (${per.trim()})`}</div>
              <div className="value num">{yen(last.price)}</div>
              <div className="muted small">{last.store || '—'}</div>
            </div>
            <div className="stat">
              <div className="label">
                {'Cheapest'}
                {per && ` (${per.trim()})`}
              </div>
              <div className="value num price-down">{yen(min)}</div>
              <div className="muted small">{cheapestAt.store || '—'}</div>
            </div>
            <div className="stat">
              <div className="label">
                {'Average'}
                {per && ` (${per.trim()})`}
              </div>
              <div className="value num">{yen(avg)}</div>
            </div>
            <div className="stat">
              <div className="label">Bought</div>
              <div className="value num">{purchases.length}×</div>
            </div>
          </div>
          {prices.length > 1 && <PriceChart purchases={comparable} />}
          {comparable.length < purchases.length && (
            <div className="muted small">
              {purchases.length - comparable.length} purchase(s) priced another way are not in these numbers.
            </div>
          )}
        </section>
      )}

      {stores.length > 1 && (
        <section>
          <div className="section-label">Lowest price at each store{per && ` (${per.trim()})`}</div>
          <div className="list">
            {stores.map((s, i) => (
              <div key={s.store} className="list-row">
                <div className="main">
                  <div className="title">
                    {i === 0 && <span aria-label="Cheapest">🏆 </span>}
                    {s.store}
                  </div>
                  <div className="sub">{s.count}×</div>
                </div>
                <div className={`amount num${i === 0 ? ' price-down' : ''}`}>{yen(s.min)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-label">Purchases</div>
        <div className="list">
          {purchases.map((p, i) => {
            const prev = purchases[i + 1]
            const b = p.prices[basis] !== undefined && prev?.prices[basis] !== undefined ? basis : null
            const diff = prev && b ? p.prices[b]! - prev.prices[b]! : 0
            return (
              <Link
                key={`${p.expenseId}-${i}`}
                to="/expense/$id"
                params={{ id: p.expenseId }}
                search={{ date: p.date }}
                className="list-row"
              >
                <div className="main">
                  <div className="title">{p.store || 'Unknown store'}</div>
                  <div className="sub num">
                    {p.date.replace(/-/g, '/')}
                    {amountText(p)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={`amount num${p.prices[basis] === min ? ' price-down' : ''}`}>{priceText(p)}</div>
                  {diff !== 0 && (
                    <div className={`sub num ${diff > 0 ? 'price-up' : 'price-down'}`}>
                      {diff > 0 ? '↑' : '↓'} {yen(Math.abs(diff))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="card stack" style={{ gap: 10 }}>
        <div className="section-label" style={{ margin: 0 }}>
          Kind
        </div>
        <div className="chips">
          {ITEM_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={kind === k.id}
              onClick={() => changeKind.mutate(k.id)}
            >
              <span aria-hidden>{k.icon}</span> {k.en}
              <span className="ja">{k.ja}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
