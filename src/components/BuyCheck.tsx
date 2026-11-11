import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  KIND_BY_ID,
  parseSize,
  perLabel,
  priceVerdict,
  storeStats,
  unitPrice,
  type VerdictLevel,
} from '../../shared/products'
import type { ProductSummary } from '../server/products'
import { shortStore, yen } from '../client/format'
import { productMatcher } from '../client/product-search'
import { productQuery, productsQuery } from '../client/queries'
import { MoneyInput, useOnline } from './bits'

function toInt(s: string): number {
  const n = parseInt(s.normalize('NFKC').replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const VERDICT_CLASS: Record<VerdictLevel, string | undefined> = {
  lowest: 'price-down',
  good: 'price-down',
  normal: undefined,
  high: 'price-up',
  new: undefined,
}

/** The shelf price as the price the product compares by. Null when a weight is needed and missing. */
function shelfUnitPrice(p: ProductSummary, price: number, size: string): number | null {
  if (!price) return null
  if (p.basis === 'pc') return price
  const pack = parseSize(size) ?? parseSize(p.name)
  return pack && pack.unit === p.basis ? unitPrice(price, pack.size, p.basis) : null
}

/** "Should I buy this?": compare a shelf price with your earlier purchases. It saves nothing. */
export function BuyCheck({ open, onClose }: { open: boolean; onClose: () => void }) {
  const online = useOnline()
  const products = useQuery({ ...productsQuery, enabled: open })
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<ProductSummary | null>(null)
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const match = useMemo(() => productMatcher(products.data ?? []), [products.data])
  const matches = useMemo(() => (search.trim() ? match(search).slice(0, 6) : []), [match, search])

  const detail = useQuery({ ...productQuery(picked?.id ?? 0), enabled: open && online && !!picked })

  if (!open) return null

  const per = picked && picked.basis !== 'pc' ? perLabel(picked.basis) : ''
  const shelf = picked ? shelfUnitPrice(picked, toInt(price), size) : null
  const verdict =
    picked && shelf !== null && picked.recentAvg !== null && picked.minPrice !== null
      ? priceVerdict(shelf, { count: picked.basisCount, minPrice: picked.minPrice, recentAvg: picked.recentAvg })
      : null
  const stores = picked && detail.data ? storeStats(detail.data.purchases, picked.basis).slice(0, 3) : []
  const cheaperStore = shelf !== null ? stores.find((s) => s.avg < shelf) : undefined

  function pick(p: ProductSummary | null) {
    setPicked(p)
    setSearch('')
    setPrice('')
    setSize('')
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className="sheet stack"
        role="dialog"
        aria-label="Should I buy this?"
        style={{ maxHeight: '85vh', overflowY: 'auto', gap: 12 }}
      >
        <div className="grip" />
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Should I buy this?</h2>

        {!picked ? (
          <>
            <input
              className="input"
              type="search"
              autoFocus
              placeholder="Product: 豚こま, milk, ぎゅうにゅう"
              aria-label="Find a product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {matches.length > 0 && (
              <div className="list">
                {matches.map((p) => (
                  <button key={p.id} type="button" className="list-row row-button" onClick={() => pick(p)}>
                    <span aria-hidden>{KIND_BY_ID[p.kind].icon}</span>
                    <div className="main">
                      <div className="title">{p.name}</div>
                      <div className="sub">
                        {p.en || KIND_BY_ID[p.kind].en} · {p.count}×
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && !matches.length && !products.isPending && (
              <div className="muted small">No product matches. You can check only products you bought before.</div>
            )}
          </>
        ) : (
          <>
            <div className="spread">
              <b>{picked.name}</b>
              <button type="button" className="btn btn-ghost" onClick={() => pick(null)}>
                Change
              </button>
            </div>
            <label className="field">
              <span>Shelf price</span>
              <MoneyInput className="input num" autoFocus placeholder="¥" value={price} onChange={setPrice} />
            </label>
            {picked.basis !== 'pc' && (
              <label className="field">
                <span>Pack size</span>
                <input
                  className="input"
                  placeholder={picked.basis === 'g' ? '300g' : '500ml'}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                />
              </label>
            )}

            {toInt(price) > 0 && shelf === null && (
              <div className="muted small">Enter the pack size to compare with your {perLabel(picked.basis)} prices.</div>
            )}

            {verdict && shelf !== null && (
              <div className="card stack" style={{ gap: 4 }} role="status">
                <b style={{ fontSize: '1.1rem' }} className={VERDICT_CLASS[verdict.level]}>
                  {verdict.level === 'lowest' && '★ Buy: lower than any price you paid'}
                  {verdict.level === 'good' && `Buy: ${-verdict.pct}% under your usual price`}
                  {verdict.level === 'normal' && 'OK: about your usual price'}
                  {verdict.level === 'high' && `Wait: ${verdict.pct}% more than your usual price`}
                  {verdict.level === 'new' && 'You bought this only one time'}
                </b>
                <span className="muted small num">
                  This price {yen(shelf)}
                  {per}
                </span>
                {cheaperStore && (
                  <span className="price-down small">
                    Usually {yen(shelf - cheaperStore.avg)} less at {shortStore(cheaperStore.store)}
                  </span>
                )}
              </div>
            )}

            <div className="stat-grid">
              <div className="stat">
                <div className="label">Usual{per && ` (${per.trim()})`}</div>
                <div className="value num">{picked.recentAvg !== null ? yen(picked.recentAvg) : '—'}</div>
              </div>
              <div className="stat">
                <div className="label">Last</div>
                <div className="value num">{picked.lastPrice !== null ? yen(picked.lastPrice) : '—'}</div>
                <div className="muted small">{shortStore(picked.lastStore) || '—'}</div>
              </div>
              <div className="stat">
                <div className="label">Lowest</div>
                <div className="value num price-down">{picked.minPrice !== null ? yen(picked.minPrice) : '—'}</div>
                <div className="muted small">{shortStore(picked.minStore) || '—'}</div>
              </div>
            </div>

            {stores.length > 1 && (
              <div className="list">
                {stores.map((s, i) => (
                  <div key={s.store} className="list-row">
                    <div className="main">
                      <div className="title">
                        {i === 0 && <span aria-label="Cheapest">🏆 </span>}
                        {shortStore(s.store) || s.store}
                      </div>
                      <div className="sub">{s.count}× · average</div>
                    </div>
                    <div className="amount num">{yen(s.avg)}</div>
                  </div>
                ))}
              </div>
            )}
            {!online && <div className="muted small">Offline: the store list shows when you are online.</div>}
          </>
        )}
      </div>
    </>
  )
}
