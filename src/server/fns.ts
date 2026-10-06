import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { isCategoryId, type CategoryId } from '../../shared/categories'
import type { CategoryRule } from '../../shared/categorizer'
import { isChargeKind, type ExpenseCharge } from '../../shared/charges'
import type { Expense, OcrEngine, User } from '../../shared/types'
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  requireUser,
  verifyPassword,
} from './auth'
import { isItemKind, isMeasureUnit, productKey } from '../../shared/products'
import { glossItems as glossFromCache } from './gloss'
import {
  ensureProducts,
  resolveProducts,
  linkOldItems as linkOld,
  listProducts as listAll,
  priceStats,
  productDetail,
  setProductKind as setKind,
} from './products'
import { visionOcr, visionUsage } from './vision'
import { extractOrder } from './email-extract'
import { checkOrder, type CheckedOrder } from '../../shared/email-check'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ENGINES: OcrEngine[] = ['vision', 'paddle', 'paste', 'email', 'manual']

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function credentials(input: unknown): { email: string; password: string } {
  const o = (input ?? {}) as Record<string, unknown>
  const email = str(o.email, 254).trim().toLowerCase()
  const password = str(o.password, 200)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  if (password.length < 8) throw new Error('The password must have at least 8 characters.')
  return { email, password }
}

// ── Auth ────────────────────────────────────────────────────────────────

export const getMe = createServerFn({ method: 'GET' }).handler(
  async (): Promise<User | null> => getSessionUser(),
)

export const register = createServerFn({ method: 'POST' })
  .validator(credentials)
  .handler(async ({ data }): Promise<User> => {
    const { hash, salt, iterations } = await hashPassword(data.password)
    const row = await env.DB.prepare(
      `INSERT INTO users (email, password_hash, salt, iterations) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING RETURNING id`,
    )
      .bind(data.email, hash, salt, iterations)
      .first<{ id: number }>()
    if (!row) throw new Error('An account with this email already exists.')
    await createSession(row.id)
    return { id: row.id, email: data.email }
  })

export const login = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    return { email: str(o.email, 254).trim().toLowerCase(), password: str(o.password, 200) }
  })
  .handler(async ({ data }): Promise<User> => {
    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, salt, iterations FROM users WHERE email = ?',
    )
      .bind(data.email)
      .first<{ id: number; email: string; password_hash: string; salt: string; iterations: number }>()
    // Hash even when the user does not exist, so response time does not reveal valid emails.
    const ok = user
      ? await verifyPassword(data.password, user)
      : (await hashPassword(data.password), false)
    if (!user || !ok) throw new Error('The email or password is not correct.')
    await createSession(user.id)
    return { id: user.id, email: user.email }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroySession()
  return null
})

// ── Expenses ────────────────────────────────────────────────────────────

interface ExpenseRow {
  id: string
  date: string
  amount: number
  store: string | null
  category_id: string
  note: string | null
  ocr_engine: string
  raw_text: string | null
  updated_at: number
}

export const listExpenses = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    const from = str(o.from, 10)
    const to = str(o.to, 10)
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new Error('Bad date range.')
    return { from, to }
  })
  .handler(async ({ data }): Promise<Expense[]> => {
    const user = await requireUser()
    const { results } = await env.DB.prepare(
      `SELECT id, date, amount, store, category_id, note, ocr_engine, raw_text, updated_at
       FROM expenses
       WHERE user_id = ? AND deleted_at IS NULL AND date BETWEEN ? AND ?
       ORDER BY date DESC, updated_at DESC`,
    )
      .bind(user.id, data.from, data.to)
      .all<ExpenseRow>()

    const items = new Map<string, Expense['items']>()
    const charges = new Map<string, ExpenseCharge[]>()
    if (results.length) {
      const { results: itemRows } = await env.DB.prepare(
        `SELECT i.expense_id, i.name, i.price, i.qty, i.unit, i.size, i.size_unit, p.name AS product,
           COALESCE(i.kind, p.kind) AS kind FROM expense_items i
         JOIN expenses e ON e.id = i.expense_id
         LEFT JOIN products p ON p.id = i.product_id
         WHERE e.user_id = ? AND e.deleted_at IS NULL AND e.date BETWEEN ? AND ?
         ORDER BY i.expense_id, i.sort`,
      )
        .bind(user.id, data.from, data.to)
        .all<{
          expense_id: string
          name: string
          price: number
          qty: number
          unit: string
          size: number | null
          size_unit: string | null
          product: string | null
          kind: string | null
        }>()
      for (const r of itemRows) {
        const list = items.get(r.expense_id) ?? []
        const item: Expense['items'][number] = { name: r.name, price: r.price }
        if (r.product) item.product = r.product
        if (r.qty > 1) item.qty = r.qty
        if (isItemKind(r.kind)) item.kind = r.kind
        if (r.unit === 'g' || r.unit === 'ml') item.unit = r.unit
        if (r.size === 0) item.size = 0
        else if (r.size && (r.size_unit === 'g' || r.size_unit === 'ml')) Object.assign(item, { size: r.size, sizeUnit: r.size_unit })
        list.push(item)
        items.set(r.expense_id, list)
      }

      const { results: chargeRows } = await env.DB.prepare(
        `SELECT c.expense_id, c.kind, c.name, c.amount FROM expense_charges c
         JOIN expenses e ON e.id = c.expense_id
         WHERE e.user_id = ? AND e.deleted_at IS NULL AND e.date BETWEEN ? AND ?
         ORDER BY c.expense_id, c.sort`,
      )
        .bind(user.id, data.from, data.to)
        .all<{ expense_id: string; kind: string; name: string; amount: number }>()
      for (const r of chargeRows) {
        const list = charges.get(r.expense_id) ?? []
        list.push({ kind: isChargeKind(r.kind) ? r.kind : 'other', name: r.name, amount: r.amount })
        charges.set(r.expense_id, list)
      }
    }

    return results.map((r) => ({
      id: r.id,
      date: r.date,
      amount: r.amount,
      store: r.store ?? '',
      categoryId: (isCategoryId(r.category_id) ? r.category_id : 'other') as CategoryId,
      note: r.note ?? '',
      ocrEngine: (ENGINES.includes(r.ocr_engine as OcrEngine) ? r.ocr_engine : 'manual') as OcrEngine,
      rawText: r.raw_text ?? '',
      items: items.get(r.id) ?? [],
      charges: charges.get(r.id) ?? [],
      updatedAt: r.updated_at,
    }))
  })

/** A count of 2–999 pieces, or 1–100,000 g / ml. Anything else means one piece. */
function qtyAndUnit(qty: unknown, unit: unknown): Pick<Expense['items'][number], 'qty' | 'unit'> {
  const n = Number(qty)
  if (!Number.isInteger(n)) return {}
  if ((unit === 'g' || unit === 'ml') && isMeasureUnit(unit) && n >= 1 && n <= 100_000) return { qty: n, unit }
  return n > 1 && n < 1000 ? { qty: n } : {}
}

/** A pack size for a line in pieces: 1–100,000 g / ml, or 0 for "no size". */
function packSize(unit: unknown, size: unknown, sizeUnit: unknown): Pick<Expense['items'][number], 'size' | 'sizeUnit'> {
  if (unit === 'g' || unit === 'ml') return {}
  const n = Number(size)
  if (n === 0) return { size: 0 }
  if (Number.isInteger(n) && n >= 1 && n <= 100_000 && (sizeUnit === 'g' || sizeUnit === 'ml')) return { size: n, sizeUnit }
  return {}
}

function validateExpense(input: unknown): Expense {
  const o = (input ?? {}) as Record<string, unknown>
  const id = str(o.id, 64)
  const date = str(o.date, 10)
  const amount = Number(o.amount)
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Bad id.')
  if (!DATE_RE.test(date)) throw new Error('Enter a valid date.')
  if (!Number.isInteger(amount) || Math.abs(amount) > 100_000_000) throw new Error('Enter a valid amount.')
  const items = Array.isArray(o.items) ? o.items.slice(0, 200) : []
  const charges = Array.isArray(o.charges) ? o.charges.slice(0, 20) : []
  return {
    id,
    date,
    amount,
    store: str(o.store, 100).trim(),
    categoryId: isCategoryId(o.categoryId) ? o.categoryId : 'other',
    note: str(o.note, 500),
    ocrEngine: ENGINES.includes(o.ocrEngine as OcrEngine) ? (o.ocrEngine as OcrEngine) : 'manual',
    rawText: str(o.rawText, 20_000),
    items: items
      .map((raw) => {
        const i = (raw ?? {}) as Record<string, unknown>
        return {
          name: str(i.name, 100).trim(),
          price: Math.trunc(Number(i.price)),
          // Missing: the server finds the product. Empty: the user said "not a product".
          product: i.product === undefined || i.product === null ? undefined : str(i.product, 80).trim(),
          kind: isItemKind(i.kind) ? i.kind : undefined,
          kindManual: i.kindManual === true && isItemKind(i.kind) ? true : undefined,
          ...qtyAndUnit(i.qty, i.unit),
          ...packSize(i.unit, i.size, i.sizeUnit),
        }
      })
      .filter((i) => i.name && Number.isFinite(i.price)),
    charges: charges
      .map((raw) => {
        const c = (raw ?? {}) as Record<string, unknown>
        return {
          kind: isChargeKind(c.kind) ? c.kind : 'other',
          name: str(c.name, 100).trim(),
          amount: Math.trunc(Number(c.amount)),
        } satisfies ExpenseCharge
      })
      .filter((c) => Number.isFinite(c.amount) && c.amount !== 0 && Math.abs(c.amount) <= 100_000_000),
    updatedAt: Number.isFinite(Number(o.updatedAt)) ? Number(o.updatedAt) : Date.now(),
  }
}

export const saveExpense = createServerFn({ method: 'POST' })
  .validator(validateExpense)
  .handler(async ({ data: e }) => {
    const user = await requireUser()
    // Upsert keyed by the client UUID. An older offline edit never overwrites a newer one,
    // and a row of another user is never touched.
    const saved = await env.DB.prepare(
      `INSERT INTO expenses (id, user_id, date, amount, store, category_id, note, ocr_engine, raw_text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, amount = excluded.amount, store = excluded.store,
         category_id = excluded.category_id, note = excluded.note, ocr_engine = excluded.ocr_engine,
         raw_text = excluded.raw_text, updated_at = excluded.updated_at
       WHERE expenses.user_id = excluded.user_id
         AND excluded.updated_at >= expenses.updated_at
         AND expenses.deleted_at IS NULL
       RETURNING id`,
    )
      .bind(e.id, user.id, e.date, e.amount, e.store, e.categoryId, e.note, e.ocrEngine, e.rawText, e.updatedAt)
      .first<{ id: string }>()
    if (!saved) return { ok: true, stale: true }

    await resolveProducts(e.items)
    const productIds = await ensureProducts(user.id, e.items)
    const charges = e.charges ?? []
    const insertCharge = env.DB.prepare(
      'INSERT INTO expense_charges (expense_id, kind, name, amount, sort) VALUES (?, ?, ?, ?, ?)',
    )
    const insert = env.DB.prepare(
      `INSERT INTO expense_items (expense_id, name, price, sort, product_id, qty, unit, size, size_unit, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    await env.DB.batch([
      env.DB.prepare('DELETE FROM expense_items WHERE expense_id = ?').bind(e.id),
      env.DB.prepare('DELETE FROM expense_charges WHERE expense_id = ?').bind(e.id),
      ...charges.map((c, i) => insertCharge.bind(e.id, c.kind, c.name, c.amount, i)),
      ...e.items.map((item, i) =>
        insert.bind(
          e.id,
          item.name,
          item.price,
          i,
          (item.product && productIds.get(productKey(item.product))) || null,
          item.qty ?? 1,
          item.unit ?? 'pc',
          item.size ?? null,
          item.size ? item.sizeUnit! : null,
          item.kind ?? null,
        ),
      ),
      // A kind the user picked becomes the product's kind, so later scans of the product get it too.
      ...e.items.flatMap((item) => {
        const id = item.kindManual && item.product ? productIds.get(productKey(item.product)) : undefined
        return id ? [env.DB.prepare('UPDATE products SET kind = ? WHERE id = ? AND user_id = ?').bind(item.kind!, id, user.id)] : []
      }),
    ])
    return { ok: true, stale: false }
  })

export const deleteExpense = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const id = str((input as Record<string, unknown>)?.id, 64)
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Bad id.')
    return { id }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    await env.DB.prepare('UPDATE expenses SET deleted_at = ? WHERE id = ? AND user_id = ?')
      .bind(Date.now(), data.id, user.id)
      .run()
    return { ok: true }
  })

// ── Category rules ──────────────────────────────────────────────────────

export const listRules = createServerFn({ method: 'GET' }).handler(async (): Promise<CategoryRule[]> => {
  const user = await requireUser()
  const { results } = await env.DB.prepare(
    'SELECT pattern, category_id FROM category_rules WHERE user_id = ? ORDER BY length(pattern) DESC',
  )
    .bind(user.id)
    .all<{ pattern: string; category_id: string }>()
  return results
    .filter((r) => isCategoryId(r.category_id))
    .map((r) => ({ pattern: r.pattern, categoryId: r.category_id as CategoryId }))
})

export const saveRule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    const pattern = str(o.pattern, 100).trim()
    if (!pattern || !isCategoryId(o.categoryId)) throw new Error('Bad rule.')
    return { pattern, categoryId: o.categoryId }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    await env.DB.prepare(
      `INSERT INTO category_rules (user_id, pattern, category_id) VALUES (?, ?, ?)
       ON CONFLICT(user_id, pattern) DO UPDATE SET category_id = excluded.category_id`,
    )
      .bind(user.id, data.pattern, data.categoryId)
      .run()
    return { ok: true }
  })

// ── OCR ─────────────────────────────────────────────────────────────────

export const ocrImage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const image = str((input as Record<string, unknown>)?.image, 8_000_000)
    if (!/^[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Bad image.')
    return { image }
  })
  .handler(async ({ data }) => {
    await requireUser()
    return visionOcr(data.image)
  })

export const getVisionUsage = createServerFn({ method: 'GET' }).handler(async () => {
  await requireUser()
  return visionUsage()
})

// ── Item furigana and translation ───────────────────────────────────────

export const glossItems = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const names = (input as Record<string, unknown>)?.names
    return { names: Array.isArray(names) ? names.slice(0, 30).map((n) => str(n, 200)) : [] }
  })
  .handler(async ({ data }) => {
    await requireUser()
    return glossFromCache(data.names)
  })

// ── Order emails ────────────────────────────────────────────────────────

export const extractEmail = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    const text = str(o.text, 20_000).trim()
    if (!text) throw new Error('The email has no text.')
    const date = str(o.date, 10)
    return { text, from: str(o.from, 200), subject: str(o.subject, 300), date: DATE_RE.test(date) ? date : '' }
  })
  .handler(async ({ data }): Promise<CheckedOrder | null> => {
    await requireUser()
    const order = await extractOrder(data)
    return order && checkOrder(order)
  })

// ── Products and prices ─────────────────────────────────────────────────

const ID_RE = /^[0-9a-f-]{36}$/i

export const getPriceStats = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    const products = Array.isArray(o.products) ? o.products.slice(0, 50).map((n) => str(n, 80)) : []
    const excludeId = str(o.excludeId, 64)
    return { products, excludeId: ID_RE.test(excludeId) ? excludeId : '' }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    return priceStats(user.id, data.products, data.excludeId)
  })

export const listProducts = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser()
  return listAll(user.id)
})

export const getProduct = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    const id = Number((input as Record<string, unknown>)?.id)
    if (!Number.isInteger(id) || id <= 0) throw new Error('Bad id.')
    return { id }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    return productDetail(user.id, data.id)
  })

export const setProductKind = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    const o = (input ?? {}) as Record<string, unknown>
    const id = Number(o.id)
    if (!Number.isInteger(id) || id <= 0 || !isItemKind(o.kind)) throw new Error('Bad input.')
    return { id, kind: o.kind }
  })
  .handler(async ({ data }) => {
    const user = await requireUser()
    await setKind(user.id, data.id, data.kind)
    return { ok: true }
  })

export const linkOldItems = createServerFn({ method: 'POST' }).handler(async () => {
  const user = await requireUser()
  return linkOld(user.id)
})
