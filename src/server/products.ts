import { env } from 'cloudflare:workers'
import { glossKey } from '../../shared/gloss'
import {
  basisPrices,
  isNonProduct,
  linkedProduct,
  isItemKind,
  isMeasureUnit,
  parseSize,
  primaryBasis,
  productKey,
  statsFor,
  type ItemKind,
  type MeasureUnit,
  type PackSize,
  type PriceStats,
  type Purchase,
  type UnitStats,
} from '../../shared/products'
import type { ExpenseItem } from '../../shared/types'
import { lookupCatalog } from './catalog'
import { cachedGloss, glossItems } from './gloss'

export interface ProductSummary {
  id: number
  name: string
  en: string
  reading: string
  kind: ItemKind
  count: number
  basis: MeasureUnit
  lastPrice: number | null
  minPrice: number | null
  lastDate: string
  lastStore: string
  minStore: string
}

export interface ProductDetail {
  product: Pick<ProductSummary, 'id' | 'name' | 'en' | 'reading' | 'kind'>
  /** Newest first. */
  purchases: Purchase[]
}

function inList(n: number): string {
  return Array.from({ length: n }, () => '?').join(',')
}

/**
 * Product ids keyed by productKey(product name). Creates the products that do not exist yet.
 * The reading and translation come from the gloss cache of the scanned names.
 */
export async function ensureProducts(userId: number, items: ExpenseItem[]): Promise<Map<string, number>> {
  // Common items use the name of the shared catalog, so that every spelling becomes one product.
  const hits = await lookupCatalog(items.map((i) => i.product ?? ''))
  for (const i of items) {
    const hit = i.product ? hits.get(i.product) : undefined
    if (hit) i.product = hit.name
  }
  const catalog = new Map([...hits.values()].map((h) => [productKey(h.name), h]))

  const byKey = new Map<string, ExpenseItem>()
  for (const i of items) {
    const key = i.product ? productKey(i.product) : ''
    if (key && !byKey.has(key)) byKey.set(key, i)
  }
  const ids = new Map<string, number>()
  if (!byKey.size) return ids

  const keys = [...byKey.keys()]
  const gloss = await cachedGloss([...byKey.values()].map((i) => glossKey(i.name)))
  const now = Date.now()
  const insert = env.DB.prepare(
    `INSERT INTO products (user_id, key, name, en, reading, kind, catalog_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET catalog_id = COALESCE(products.catalog_id, excluded.catalog_id)`,
  )
  await env.DB.batch(
    keys.map((key) => {
      const i = byKey.get(key)!
      const c = catalog.get(key)
      if (c) return insert.bind(userId, key, c.name, c.en, c.reading, c.kind, c.id, now)
      const g = gloss[glossKey(i.name)]
      const kind = isItemKind(i.kind) ? i.kind : (g?.kind ?? 'other')
      return insert.bind(userId, key, i.product!.trim().slice(0, 80), g?.en ?? '', g?.reading ?? '', kind, null, now)
    }),
  )
  const { results } = await env.DB.prepare(`SELECT id, key FROM products WHERE user_id = ? AND key IN (${inList(keys.length)})`)
    .bind(userId, ...keys)
    .all<{ id: number; key: string }>()
  for (const r of results) ids.set(r.key, r.id)
  return ids
}

interface PurchaseRow {
  product_id: number
  price: number
  qty: number
  unit: string
  size: number | null
  size_unit: string | null
  item_name: string
  product_name: string | null
  expense_id: string
  date: string
  store: string | null
}

const PURCHASES_SQL = `SELECT i.product_id, i.price, i.qty, i.unit, i.size, i.size_unit, i.name AS item_name,
    pr.name AS product_name, e.id AS expense_id, e.date, e.store
  FROM expense_items i JOIN expenses e ON e.id = i.expense_id
  LEFT JOIN products pr ON pr.id = i.product_id
  WHERE e.user_id = ? AND e.deleted_at IS NULL`

/** The saved pack size; when none was saved, the size written in the product or item name. */
function packOf(r: PurchaseRow): PackSize | null {
  if (r.size === 0) return null
  if (r.size && (r.size_unit === 'g' || r.size_unit === 'ml')) return { size: r.size, unit: r.size_unit }
  return parseSize(r.product_name ?? undefined) ?? parseSize(r.item_name)
}

function toPurchase(r: PurchaseRow): Purchase {
  const unit: MeasureUnit = isMeasureUnit(r.unit) ? r.unit : 'pc'
  const qty = Math.max(1, r.qty)
  const pack = unit === 'pc' ? packOf(r) : null
  const prices = basisPrices({ linePrice: r.price, qty, unit, pack })
  const basis = primaryBasis(prices)
  return {
    expenseId: r.expense_id,
    date: r.date,
    store: r.store ?? '',
    linePrice: r.price,
    qty,
    unit,
    pack,
    prices,
    basis,
    price: prices[basis] ?? 0,
  }
}

/**
 * Fills in the product of lines saved before the AI answered (offline, or a quick save).
 * Every line is a product unless it is clearly not one; without an AI answer, the line's own name is used.
 */
export async function resolveProducts(items: ExpenseItem[]): Promise<void> {
  const open = items.filter((i) => i.product === undefined)
  if (!open.length) return
  const gloss = await glossItems(open.filter((i) => !isNonProduct(i.name, i.price)).map((i) => i.name))
  for (const i of open) {
    const g = gloss[glossKey(i.name)]
    i.product = linkedProduct(i.name, g?.product ?? '', i.price) ?? ''
    if (!i.kind && g) i.kind = g.kind
  }
}

/** Earlier prices of the given products, keyed by productKey. The expense being edited is left out. */
export async function priceStats(
  userId: number,
  productNames: string[],
  excludeExpenseId: string,
): Promise<Record<string, PriceStats>> {
  // A typed name such as "にんじん" finds the product "人参" through the catalog.
  const hits = await lookupCatalog(productNames)
  const keyOf = new Map(productNames.map((n) => [n, productKey(hits.get(n)?.name ?? n)]))
  const keys = [...new Set([...keyOf.values()].filter(Boolean))].slice(0, 50)
  if (!keys.length) return {}
  const { results: products } = await env.DB.prepare(
    `SELECT id, key, name, kind FROM products WHERE user_id = ? AND key IN (${inList(keys.length)})`,
  )
    .bind(userId, ...keys)
    .all<{ id: number; key: string; name: string; kind: string }>()
  if (!products.length) return {}

  const { results } = await env.DB.prepare(
    `${PURCHASES_SQL} AND e.id != ? AND i.product_id IN (${inList(products.length)})
     ORDER BY e.date DESC, e.updated_at DESC`,
  )
    .bind(userId, excludeExpenseId, ...products.map((p) => p.id))
    .all<PurchaseRow>()

  const out: Record<string, PriceStats> = {}
  for (const p of products) {
    const list = results.filter((r) => r.product_id === p.id).map(toPurchase)
    const byUnit: Partial<Record<MeasureUnit, UnitStats>> = {}
    for (const basis of ['pc', 'g', 'ml'] as const) {
      const st = statsFor(list, basis)
      if (st) byUnit[basis] = st
    }
    if (!Object.keys(byUnit).length) continue
    // Keyed by the name the caller sent, so the caller finds it with productKey(its own name).
    for (const [n, k] of keyOf) if (k === p.key) out[productKey(n)] = {
          productId: p.id,
          name: p.name,
          kind: isItemKind(p.kind) ? p.kind : 'other',
          byUnit,
        }
  }
  return out
}

export async function listProducts(userId: number): Promise<ProductSummary[]> {
  const [{ results: products }, { results: rows }] = await Promise.all([
    env.DB.prepare('SELECT id, name, en, reading, kind FROM products WHERE user_id = ?')
      .bind(userId)
      .all<{ id: number; name: string; en: string; reading: string; kind: string }>(),
    env.DB.prepare(`${PURCHASES_SQL} AND i.product_id IS NOT NULL ORDER BY e.date DESC, e.updated_at DESC`)
      .bind(userId)
      .all<PurchaseRow>(),
  ])
  const byProduct = new Map<number, Purchase[]>()
  for (const r of rows) {
    const list = byProduct.get(r.product_id) ?? []
    list.push(toPurchase(r))
    byProduct.set(r.product_id, list)
  }
  return products
    .map((p) => {
      const list = byProduct.get(p.id) ?? []
      // Compare by the basis of the newest purchase.
      const st = list.length ? statsFor(list, list[0].basis) : null
      return {
        ...p,
        kind: isItemKind(p.kind) ? p.kind : 'other',
        count: list.length,
        basis: list[0]?.basis ?? 'pc',
        lastPrice: st?.lastPrice ?? null,
        minPrice: st?.minPrice ?? null,
        lastDate: list[0]?.date ?? '',
        lastStore: st?.last.store ?? '',
        minStore: st?.min.store ?? '',
      }
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => (a.lastDate === b.lastDate ? b.count - a.count : a.lastDate < b.lastDate ? 1 : -1))
}

export async function productDetail(userId: number, id: number): Promise<ProductDetail | null> {
  const product = await env.DB.prepare('SELECT id, name, en, reading, kind FROM products WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<{ id: number; name: string; en: string; reading: string; kind: string }>()
  if (!product) return null
  const { results } = await env.DB.prepare(`${PURCHASES_SQL} AND i.product_id = ? ORDER BY e.date DESC, e.updated_at DESC`)
    .bind(userId, id)
    .all<PurchaseRow>()
  return {
    product: { ...product, kind: isItemKind(product.kind) ? product.kind : 'other' },
    purchases: results.map(toPurchase),
  }
}

export async function setProductKind(userId: number, id: number, kind: ItemKind): Promise<void> {
  await env.DB.prepare('UPDATE products SET kind = ? WHERE id = ? AND user_id = ?').bind(kind, id, userId).run()
}

/**
 * Links items saved before product tracking existed. Each call handles at most 30 new names,
 * so a large history is linked over a few visits to the Products page.
 */
export async function linkOldItems(userId: number): Promise<{ linked: number; remaining: boolean }> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT i.name FROM expense_items i JOIN expenses e ON e.id = i.expense_id
     WHERE e.user_id = ? AND e.deleted_at IS NULL AND i.product_id IS NULL LIMIT 300`,
  )
    .bind(userId)
    .all<{ name: string }>()
  if (!results.length) return { linked: 0, remaining: false }

  // Clear non-products (a discount, a bag) are skipped.
  const cached = await cachedGloss(results.map((r) => glossKey(r.name)))
  const todo = results.map((r) => r.name).filter((n) => !isNonProduct(n))
  const uncached = todo.filter((n) => !cached[glossKey(n)])
  const batch = [...todo.filter((n) => cached[glossKey(n)]), ...uncached.slice(0, 30)]
  const gloss = uncached.length ? { ...cached, ...(await glossItems(uncached.slice(0, 30))) } : cached

  const items: ExpenseItem[] = batch
    .map((name) => ({ name, price: 0, product: linkedProduct(name, gloss[glossKey(name)]?.product) ?? '' }))
    .filter((i) => i.product)
  const ids = await ensureProducts(userId, items)
  const update = env.DB.prepare(
    `UPDATE expense_items SET product_id = ?
     WHERE product_id IS NULL AND name = ? AND expense_id IN (SELECT id FROM expenses WHERE user_id = ?)`,
  )
  const stmts = items.flatMap((i) => {
    const id = ids.get(productKey(i.product!))
    return id ? [update.bind(id, i.name, userId)] : []
  })
  if (stmts.length) await env.DB.batch(stmts)
  return { linked: stmts.length, remaining: uncached.length > 30 }
}
