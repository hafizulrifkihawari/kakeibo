import { chargeTotal, type ExpenseCharge } from './charges'
import type { ReceiptItem } from './receipt-parser'

/** What the AI reads from an order email. Prices are line totals in yen. */
export interface EmailOrder {
  store: string
  /** YYYY-MM-DD, or '' when not found. */
  orderDate: string
  currency: string
  items: { name: string; qty: number; price: number }[]
  shipping: number
  discount: number
  total: number
}

export interface CheckedOrder {
  store: string
  date: string | null
  total: number
  items: ReceiptItem[]
  /** Shipping and the discount. */
  charges: ExpenseCharge[]
  /** The items and charges do not add up to the total, or the currency is not yen. */
  needsReview: boolean
}

export const SHIPPING_NAME = 'Frete / 送料'
export const DISCOUNT_NAME = '値引 / Discount'

function yen(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && Math.abs(n) <= 100_000_000 ? n : 0
}

/** Cleans the AI result and checks that items + shipping − discount = total. Shipping and the discount become charges. */
export function checkOrder(o: EmailOrder): CheckedOrder {
  const items: ReceiptItem[] = o.items
    .map((i) => {
      const qty = Math.round(Number(i.qty))
      const item: ReceiptItem = { name: String(i.name ?? '').trim().slice(0, 100), price: yen(i.price) }
      if (qty >= 2 && qty <= 99) item.qty = qty
      return item
    })
    .filter((i) => i.name && i.price !== 0)
  const shipping = yen(o.shipping)
  const discount = Math.abs(yen(o.discount))
  const charges: ExpenseCharge[] = []
  if (shipping > 0) charges.push({ kind: 'shipping', name: SHIPPING_NAME, amount: shipping })
  if (discount > 0) charges.push({ kind: 'discount', name: DISCOUNT_NAME, amount: -discount })

  const sum = items.reduce((s, i) => s + i.price, 0) + chargeTotal(charges)
  const total = yen(o.total) || sum
  // Weight prices are rounded on each line, so allow ¥1 per line.
  const fits = Math.abs(sum - total) <= Math.max(1, items.length + charges.length)
  const isYen = !o.currency || /^(JPY|¥|円|YEN)$/i.test(o.currency.trim())
  const date = /^\d{4}-\d{2}-\d{2}$/.test(o.orderDate) ? o.orderDate : null
  return { store: String(o.store ?? '').trim().slice(0, 100), date, total, items, charges, needsReview: !fits || !isYen || !items.length }
}
