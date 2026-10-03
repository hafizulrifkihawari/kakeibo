import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { CATEGORY_BY_ID, type CategoryId } from '../../shared/categories'
import type { CategoryRule } from '../../shared/categorizer'
import type { Expense } from '../../shared/types'
import { glossKey, hasKanji, type Gloss } from '../../shared/gloss'
import {
  ITEM_KINDS,
  basisPrices,
  linkedProduct,
  parseSize,
  perLabel,
  primaryBasis,
  productKey,
  sizeText,
  type ItemKind,
  type MeasureUnit,
  type PriceStats,
  type UnitStats,
} from '../../shared/products'
import { glossQuery, priceStatsQuery, productsQuery, type DeleteVars, type SaveVars } from '../client/queries'
import { Link } from '@tanstack/react-router'
import { shortStore, yen } from '../client/format'
import { CategoryChips } from './bits'

interface ItemDraft {
  key: number
  name: string
  price: string
  /** The linked product. Missing: use the AI suggestion. Empty: not a product (a discount, a bag). */
  product?: string
  /** Count of a multi-pack line, or grams / ml. The price field holds the line price. */
  qty: string
  unit: MeasureUnit
  /** Pack size text such as "300g". Missing: read it from the product or item name. Empty: no size. */
  size?: string
  /** The category of the line. Missing: from the product or the AI. */
  kind?: ItemKind
  /** True after the user picked the kind in this form. */
  kindManual?: boolean
}

let nextKey = 1

function toDraft(items: Expense['items']): ItemDraft[] {
  return items.map((i) => ({
    key: nextKey++,
    name: i.name,
    price: String(i.price),
    product: i.product,
    qty: String(i.qty ?? 1),
    unit: i.unit ?? 'pc',
    size: i.size === 0 ? '' : i.size ? `${i.size}${i.sizeUnit}` : undefined,
    kind: i.kind,
  }))
}

/** A sorted, unique list that updates 600 ms after typing stops. */
function useSettledList(values: string[]): string[] {
  const now = [...new Set(values.filter(Boolean))].sort().join('\n')
  const [settled, setSettled] = useState(now)
  useEffect(() => {
    const t = setTimeout(() => setSettled(now), 600)
    return () => clearTimeout(t)
  }, [now])
  return settled ? settled.split('\n') : []
}

function shortDate(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
}

/** "↑ ¥20 vs last time (10/1 · LIFE)" and the cheapest earlier price. All prices are unit prices. */
function PriceCompare({ price, stats, per }: { price: number; stats: UnitStats; per: string }) {
  const { last, min, lastPrice, minPrice } = stats
  const diff = price - lastPrice
  const where = (p: { date: string; store: string }) =>
    [shortDate(p.date), shortStore(p.store)].filter(Boolean).join(' · ')
  const at = (p: { date: string; store: string }) => (p.store ? `at ${shortStore(p.store)}` : `on ${shortDate(p.date)}`)
  return (
    <>
      {diff === 0 ? (
        <span className="price-same">= same as last time ({where(last)})</span>
      ) : (
        <span className={diff > 0 ? 'price-up' : 'price-down'}>
          {diff > 0 ? '↑' : '↓'} {yen(Math.abs(diff))}
          {per} vs last time ({where(last)})
        </span>
      )}
      {minPrice < price && (
        <span className="price-same">
          Cheapest {yen(minPrice)}
          {per} {at(min)}
        </span>
      )}
      {price > 0 && minPrice > price && (
        <span className="price-down">
          ★ Lowest price so far (before: {yen(minPrice)}
          {per} {at(min)})
        </span>
      )}
      {price > 0 && minPrice === price && diff !== 0 && (
        <span className="price-same">= cheapest price, as {at(min)}</span>
      )}
    </>
  )
}

function ProductLine({
  product,
  showProduct,
  suggested,
  price,
  qty,
  unit,
  size,
  stats,
  options,
  onChange,
  onQty,
  onUnit,
  onSize,
  kind,
  onKind,
}: {
  product: string
  /** False until the AI answers or the user picks a product. */
  showProduct: boolean
  /** True while the link is the AI suggestion, not a choice of the user. */
  suggested: boolean
  /** The line price. */
  price: number
  qty: string
  unit: MeasureUnit
  /** Pack size text such as "300g", for a line in pieces. */
  size: string
  stats?: PriceStats
  options: string[]
  onChange: (product: string) => void
  onQty: (qty: string) => void
  onUnit: (unit: MeasureUnit) => void
  onSize: (size: string) => void
  kind: ItemKind | undefined
  onKind: (kind: ItemKind) => void
}) {
  const n = Math.max(1, toInt(qty))
  const pack = unit === 'pc' ? parseSize(size) : null
  const prices = basisPrices({ linePrice: price, qty: n, unit, pack })
  const basis = primaryBasis(prices)
  // Compare per 100 g when both sides know the weight; else per piece when both are in pieces.
  const cmpBasis: MeasureUnit | null = stats?.byUnit[basis] ? basis : unit === 'pc' && stats?.byUnit.pc ? 'pc' : null
  const same = cmpBasis ? stats?.byUnit[cmpBasis] : undefined
  const other = stats && !same ? (Object.keys(stats.byUnit)[0] as MeasureUnit | undefined) : undefined
  // "each" only matters when this line or the last one was a multi-pack.
  const per = cmpBasis && (cmpBasis !== 'pc' || n > 1 || (same?.last.qty ?? 1) > 1) ? perLabel(cmpBasis) : ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(product)
  const listId = 'product-options'

  if (editing) {
    const commit = () => {
      onChange(draft.trim())
      setEditing(false)
    }
    return (
      <div className="product-line">
        <input
          className="input product-input"
          autoFocus
          list={listId}
          aria-label="Product"
          placeholder="Product name (empty: not a product)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
    )
  }

  return (
    <div className="product-line">
      <span className="qty" title="Quantity, or weight for a line sold by weight">
        {unit === 'pc' && <span aria-hidden>×</span>}
        <input
          className="input num"
          type="number"
          inputMode="numeric"
          min={1}
          max={unit === 'pc' ? 999 : 100_000}
          aria-label={unit === 'pc' ? 'Quantity' : `Amount in ${unit}`}
          value={qty}
          onChange={(e) => onQty(e.target.value)}
        />
        <select
          className="qty-unit"
          aria-label="Unit"
          value={unit}
          onChange={(e) => onUnit(e.target.value as MeasureUnit)}
        >
          <option value="pc">pcs</option>
          <option value="g">g</option>
          <option value="ml">ml</option>
        </select>
        {unit === 'pc' && (
          <input
            className={`input size-input${size && !pack ? ' invalid' : ''}`}
            aria-label="Pack size, for example 300g or 500ml"
            placeholder="size"
            value={size}
            onChange={(e) => onSize(e.target.value)}
          />
        )}
      </span>
      {price > 0 && unit === 'pc' && n > 1 && (
        <span className="price-same num">
          {yen(prices.pc!)}
          {perLabel('pc')}
        </span>
      )}
      {price > 0 && basis !== 'pc' && (
        <span className="price-same num">
          {yen(prices[basis]!)}
          {perLabel(basis)}
        </span>
      )}
      <select
        className={`kind-select${kind ? '' : ' unset'}`}
        aria-label="Item category"
        title="Item category"
        value={kind ?? ''}
        onChange={(e) => onKind(e.target.value as ItemKind)}
      >
        {!kind && <option value="">🏷️ Category…</option>}
        {ITEM_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.icon} {k.en}
          </option>
        ))}
      </select>
      {showProduct && (
        <button
          type="button"
          className={`product-link${product ? '' : ' none'}`}
          title={suggested ? 'Suggested product. Tap to change.' : 'Tap to change the product.'}
          onClick={() => {
            setDraft(product)
            setEditing(true)
          }}
        >
          <span aria-hidden>🔗</span> {product || 'Not a product'}
          {suggested && product && <span className="sr-only"> (suggested)</span>} <span aria-hidden>✎</span>
        </button>
      )}
      {showProduct && product && stats && same && (
        <Link to="/product/$id" params={{ id: String(stats.productId) }} className="price-compare">
          <PriceCompare price={prices[cmpBasis!]!} stats={same} per={per} />
        </Link>
      )}
      {showProduct && product && other && (
        <Link to="/product/$id" params={{ id: String(stats!.productId) }} className="price-same">
          Earlier prices are {other === 'pc' ? 'per piece (add a size to compare)' : `by ${other}`}: not compared
        </Link>
      )}
      {showProduct && product && !stats && price > 0 && <span className="price-same">New product</span>}
    </div>
  )
}

function GlossLine({ name, gloss, loading }: { name: string; gloss?: Gloss; loading: boolean }) {
  if (!gloss) return loading && name.trim() ? <div className="gloss gloss-loading" aria-hidden /> : null
  const showReading = gloss.reading && hasKanji(name)
  // "CCL" → "CCL" adds nothing.
  const showEn = gloss.en && gloss.en.toLowerCase() !== name.trim().toLowerCase()
  if (!showReading && !showEn) return null
  return (
    <div className="gloss">
      {showReading && (
        <span className="gloss-reading" lang="ja">
          [{gloss.reading}]
        </span>
      )}
      {showEn && <span className="gloss-en">({gloss.en})</span>}
    </div>
  )
}

function toInt(s: string): number {
  const n = parseInt(s.normalize('NFKC').replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

export function ExpenseForm({
  initial,
  suggestedCategory,
  isNew,
  onDone,
}: {
  initial: Expense
  /** The category the app guessed; a different choice by the user becomes a rule for this store. */
  suggestedCategory?: CategoryId
  isNew: boolean
  onDone: (saved: Expense | null) => void
}) {
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [date, setDate] = useState(initial.date)
  const [store, setStore] = useState(initial.store)
  const [categoryId, setCategoryId] = useState<CategoryId>(initial.categoryId)
  const [note, setNote] = useState(initial.note)
  const [items, setItems] = useState<ItemDraft[]>(() => toDraft(initial.items))
  const [error, setError] = useState('')

  const save = useMutation<unknown, Error, SaveVars>({
    mutationKey: ['saveExpense'],
  })
  const remove = useMutation<unknown, Error, DeleteVars>({
    mutationKey: ['deleteExpense'],
  })
  const learn = useMutation<unknown, Error, CategoryRule>({
    mutationKey: ['saveRule'],
  })

  const glossNames = useSettledList(items.map((i) => glossKey(i.name)))
  const gloss = useQuery({
    ...glossQuery(glossNames),
    enabled: glossNames.length > 0,
    placeholderData: keepPreviousData,
  })

  // The linked product of an item: the choice of the user, else the AI suggestion.
  const productOf = (i: ItemDraft) =>
    i.product ?? linkedProduct(i.name, gloss.data?.[glossKey(i.name)]?.product, toInt(i.price)) ?? ''
  const productNames = useSettledList(items.map(productOf))
  const prices = useQuery({
    ...priceStatsQuery(productNames, initial.id),
    enabled: productNames.length > 0,
    placeholderData: keepPreviousData,
  })
  const products = useQuery({ ...productsQuery, enabled: items.length > 0 })
  const productOptions = (products.data ?? []).map((p) => p.name)

  // The pack size written in the product or item name ("カルビー 堅あげポテト 65g").
  const autoSize = (i: ItemDraft) => sizeText(parseSize(productOf(i)) ?? parseSize(i.name))
  // Saved as typed by the user; an automatic size is not saved, so it follows later product renames.
  const sizeOf = (i: ItemDraft): { size?: number; sizeUnit?: 'g' | 'ml' } => {
    if (i.unit !== 'pc' || i.size === undefined) return {}
    if (!i.size.trim()) return { size: 0 }
    const p = parseSize(i.size)
    return p ? { size: p.size, sizeUnit: p.unit } : {}
  }

  // The user's pick, else the kind the user gave the product before, else the AI's guess.
  const kindOf = (i: ItemDraft): ItemKind | undefined =>
    i.kind ?? prices.data?.[productKey(productOf(i))]?.kind ?? gloss.data?.[glossKey(i.name)]?.kind

  const itemTotal = items.reduce((s, i) => s + toInt(i.price), 0)
  const amountN = toInt(amount)
  // Item prices are often before tax (外税): a gap of up to 10% is consumption tax, not an error.
  const gap = amountN - itemTotal
  const isTax = items.length > 0 && gap > 0 && gap <= Math.ceil(itemTotal * 0.1) + 1
  const mismatch = items.length > 0 && gap !== 0 && !isTax

  function updateItem(key: number, patch: Partial<ItemDraft>) {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amountN) return setError('Enter the amount.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter the date.')
    const expense: Expense = {
      ...initial,
      amount: amountN,
      date,
      store: store.trim(),
      categoryId,
      note,
      items: items
        .map((i) => ({
          name: i.name.trim(),
          price: toInt(i.price),
          qty: i.unit !== 'pc' || toInt(i.qty) > 1 ? Math.max(1, toInt(i.qty)) : undefined,
          unit: i.unit === 'pc' ? undefined : i.unit,
          ...sizeOf(i),
          // Undefined when the AI has not answered yet: the server links the product on save.
          product: i.product ?? linkedProduct(i.name, gloss.data?.[glossKey(i.name)]?.product, toInt(i.price)),
          kind: kindOf(i),
          kindManual: i.kindManual || undefined,
        }))
        .filter((i) => i.name),
      updatedAt: Date.now(),
    }
    // Fire and forget: offline, the save waits in the queue and the UI moves on.
    save.mutate({ expense, prevDate: isNew ? undefined : initial.date })
    if (expense.store && suggestedCategory && categoryId !== suggestedCategory) {
      learn.mutate({ pattern: expense.store.split(' ')[0], categoryId })
    }
    onDone(expense)
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="card stack">
        <label className="field">
          <span>Amount (¥)</span>
          <input
            className="input amount-input num"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={isNew && !initial.amount}
          />
        </label>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Store</span>
          <input
            className="input"
            value={store}
            placeholder="e.g. ローソン"
            onChange={(e) => setStore(e.target.value)}
          />
        </label>
      </div>

      <div className="card stack">
        <div className="spread">
          <span style={{ fontWeight: 500 }}>Category</span>
          {suggestedCategory && suggestedCategory === categoryId && <span className="engine-badge">✨ Suggested</span>}
        </div>
        <CategoryChips value={categoryId} onChange={setCategoryId} />
      </div>

      <details className="card collapse" open={items.length > 0 && mismatch}>
        <summary>
          <span>
            Items <span className="muted small">({items.length})</span>
          </span>
          {items.length > 0 && <span className="num muted small">{yen(itemTotal)}</span>}
        </summary>
        <div className="items" style={{ marginTop: 8 }}>
          {items.map((i) => (
            <div key={i.key} className="item-row">
              <input
                className="input"
                aria-label="Item name"
                value={i.name}
                onChange={(e) => updateItem(i.key, { name: e.target.value })}
              />
              <input
                className="input num"
                aria-label="Price"
                inputMode="numeric"
                value={i.price}
                onChange={(e) => updateItem(i.key, { price: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${i.name}`}
                onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))}
              >
                ✕
              </button>
              <GlossLine
                name={i.name}
                gloss={gloss.data?.[glossKey(i.name)]}
                loading={gloss.fetchStatus === 'fetching'}
              />
              {i.name.trim() && (
                <ProductLine
                  product={productOf(i)}
                  showProduct={i.product !== undefined || !!gloss.data?.[glossKey(i.name)]}
                  suggested={i.product === undefined}
                  price={toInt(i.price)}
                  qty={i.qty}
                  unit={i.unit}
                  size={i.size ?? autoSize(i)}
                  stats={prices.data?.[productKey(productOf(i))]}
                  options={productOptions}
                  onChange={(product) => updateItem(i.key, { product })}
                  onQty={(qty) => updateItem(i.key, { qty })}
                  onSize={(size) => updateItem(i.key, { size })}
                  kind={kindOf(i)}
                  onKind={(kind) => updateItem(i.key, { kind, kindManual: true })}
                  onUnit={(unit) =>
                    updateItem(i.key, { unit, qty: unit === i.unit ? i.qty : unit === 'pc' ? '1' : '' })
                  }
                />
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setItems((l) => [...l, { key: nextKey++, name: '', price: '', qty: '1', unit: 'pc' }])}
          >
            + Add item
          </button>
          {isTax && (
            <div className="muted small">
              Total includes <b className="num">{yen(gap)}</b> consumption tax (消費税).
            </div>
          )}
          {mismatch && (
            <div className="warn spread">
              <span>
                Items add up to <b className="num">{yen(itemTotal)}</b>, not {yen(amountN)}.
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setAmount(String(itemTotal))}>
                Use
              </button>
            </div>
          )}
        </div>
      </details>

      <div className="card">
        <label className="field">
          <span>Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
      </div>

      {initial.rawText && (
        <details className="card collapse">
          <summary>
            <span>Scanned text</span>
          </summary>
          <pre className="small muted" style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
            {initial.rawText}
          </pre>
        </details>
      )}

      <button className="btn btn-primary btn-block" style={{ minHeight: 56, fontSize: '1.0625rem' }}>
        {isNew ? `Save ${amountN ? yen(amountN) : ''}` : 'Save changes'}
      </button>
      {!isNew && (
        <button
          type="button"
          className="btn btn-ghost btn-danger btn-block"
          onClick={() => {
            if (!confirm(`Delete this ${CATEGORY_BY_ID[categoryId].en.toLowerCase()} expense?`)) return
            remove.mutate({ id: initial.id, date: initial.date })
            onDone(null)
          }}
        >
          Delete expense
        </button>
      )}
    </form>
  )
}
