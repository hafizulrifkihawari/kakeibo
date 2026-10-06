/** Costs on a receipt that are not a product: consumption tax, shipping, fees, discounts. */
export type ChargeKind = 'tax' | 'shipping' | 'fee' | 'discount' | 'other'

export interface ExpenseCharge {
  kind: ChargeKind
  /** The label on the receipt, such as "消費税 8%". Can be empty. */
  name: string
  /** Yen. Negative for a discount. */
  amount: number
}

export const CHARGE_KINDS: { id: ChargeKind; icon: string; en: string; ja: string }[] = [
  { id: 'tax', icon: '🧾', en: 'Tax', ja: '消費税' },
  { id: 'shipping', icon: '🚚', en: 'Shipping', ja: '送料' },
  { id: 'fee', icon: '💳', en: 'Fee', ja: '手数料' },
  { id: 'discount', icon: '🏷️', en: 'Discount', ja: '値引' },
  { id: 'other', icon: '➕', en: 'Other', ja: 'その他' },
]

export const CHARGE_BY_ID = Object.fromEntries(CHARGE_KINDS.map((k) => [k.id, k])) as Record<
  ChargeKind,
  (typeof CHARGE_KINDS)[number]
>

export function isChargeKind(v: unknown): v is ChargeKind {
  return typeof v === 'string' && v in CHARGE_BY_ID
}

export function chargeTotal(charges: readonly ExpenseCharge[] | undefined): number {
  return (charges ?? []).reduce((s, c) => s + c.amount, 0)
}

// Item lines that are a cost, not a product.
const CHARGE_NAMES: [RegExp, ChargeKind][] = [
  [/^(送料|配送料|配達料)|^(shipping|delivery|frete)\b/i, 'shipping'],
  [/手数料|サービス料|^(service|handling) (fee|charge)/i, 'fee'],
]

/** The charge kind of an item line such as "送料", or null for a product. */
export function chargeKindOf(name: string): ChargeKind | null {
  return CHARGE_NAMES.find(([re]) => re.test(name.trim()))?.[1] ?? null
}
