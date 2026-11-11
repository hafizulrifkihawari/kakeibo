import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ITEM_KINDS, KIND_BY_ID, perLabel, type ItemKind } from '../../../shared/products'
import { shortStore, yen } from '../../client/format'
import { productMatcher } from '../../client/product-search'
import { keys, productsQuery } from '../../client/queries'
import { linkOldItems } from '../../server/fns'
import { Empty, useOnline } from '../../components/bits'
import { BuyCheck } from '../../components/BuyCheck'

export const Route = createFileRoute('/_app/products')({ component: Products })

function Products() {
  const qc = useQueryClient()
  const online = useOnline()
  const q = useQuery(productsQuery)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<ItemKind | undefined>()
  const [checking, setChecking] = useState(false)

  // Items saved before product tracking get linked in the background, 30 names per call.
  const link = useMutation({
    mutationFn: () => linkOldItems(),
    onSuccess: (r) => {
      if (r.linked) qc.invalidateQueries({ queryKey: keys.products })
      if (r.remaining) setTimeout(() => link.mutate(), 500)
    },
  })
  useEffect(() => {
    if (online) link.mutate()
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const match = useMemo(() => productMatcher(q.data ?? []), [q.data])
  const list = useMemo(() => match(search).filter((p) => !kind || p.kind === kind), [match, search, kind])
  const kindsInUse = new Set((q.data ?? []).map((p) => p.kind))

  return (
    <main className="page stack">
      <h1 className="page-title">Products</h1>
      {!!q.data?.length && (
        <button type="button" className="btn btn-primary btn-block" onClick={() => setChecking(true)}>
          <span aria-hidden>🛒</span> Should I buy this?
        </button>
      )}
      <BuyCheck open={checking} onClose={() => setChecking(false)} />
      <input
        className="input"
        type="search"
        placeholder="Name, karubi, store, or kind"
        aria-label="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {kindsInUse.size > 1 && (
        <div className="chips">
          {ITEM_KINDS.filter((k) => kindsInUse.has(k.id)).map((k) => (
            <button
              key={k.id}
              type="button"
              className="chip"
              aria-pressed={kind === k.id}
              onClick={() => setKind(kind === k.id ? undefined : k.id)}
            >
              <span aria-hidden>{k.icon}</span> {k.en}
            </button>
          ))}
        </div>
      )}
      {link.isPending && <div className="muted small">Linking items from earlier receipts…</div>}

      <div className="list">
        {q.isPending ? (
          <div className="empty">Loading…</div>
        ) : list.length ? (
          list.map((p) => {
            const k = KIND_BY_ID[p.kind]
            const lastIsMin = p.minPrice === null || p.lastPrice === null || p.minPrice >= p.lastPrice
            const per = p.basis !== 'pc' ? perLabel(p.basis) : ''
            return (
              <Link key={p.id} to="/product/$id" params={{ id: String(p.id) }} className="list-row">
                <span className="cat-dot" style={{ '--dot-color': 'var(--accent)' } as React.CSSProperties} aria-hidden>
                  {k.icon}
                </span>
                <div className="main">
                  <div className="title">{p.name}</div>
                  <div className="sub">
                    {p.en || k.en} · {p.count}×
                  </div>
                  <div className="sub">
                    {p.lastStore && <>Last at {shortStore(p.lastStore)}</>}
                    {!lastIsMin && p.minStore && (
                      <>
                        {' · '}
                        <span className="price-down">cheapest at {shortStore(p.minStore)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="amount num">
                    {p.lastPrice !== null ? yen(p.lastPrice) : '—'}
                    {per && <span className="muted small">{per}</span>}
                  </div>
                  {!lastIsMin && <div className="sub price-down num">min {yen(p.minPrice!)}</div>}
                </div>
              </Link>
            )
          })
        ) : (
          <Empty emoji="🏷️">
            {q.data?.length
              ? 'No product matches.'
              : 'Scan a receipt with items. Products show up here, with their prices.'}
          </Empty>
        )}
      </div>
    </main>
  )
}
