import { normalize } from './receipt-parser'

/** Item-level categories for products. They are finer than the expense categories. */
export const ITEM_KINDS = [
  { id: 'produce', en: 'Produce', ja: '野菜・果物', icon: '🥬' },
  { id: 'meat_fish', en: 'Meat & fish', ja: '肉・魚', icon: '🐟' },
  { id: 'dairy_eggs', en: 'Dairy & eggs', ja: '乳製品・卵', icon: '🥚' },
  { id: 'tofu', en: 'Tofu & soy', ja: '豆腐・大豆製品', icon: '🫘' },
  { id: 'bread_rice', en: 'Bread, rice & noodles', ja: '主食', icon: '🍞' },
  { id: 'snacks', en: 'Snacks & sweets', ja: 'お菓子', icon: '🍪' },
  { id: 'drinks', en: 'Drinks', ja: '飲料', icon: '🥤' },
  { id: 'alcohol', en: 'Alcohol', ja: 'お酒', icon: '🍺' },
  { id: 'frozen', en: 'Frozen', ja: '冷凍食品', icon: '🧊' },
  { id: 'ready_meals', en: 'Ready meals', ja: '惣菜・弁当', icon: '🍱' },
  { id: 'seasonings', en: 'Seasonings', ja: '調味料', icon: '🧂' },
  { id: 'household', en: 'Household', ja: '日用品', icon: '🧻' },
  { id: 'personal_care', en: 'Personal care', ja: '化粧品・衛生', icon: '🧴' },
  { id: 'medicine', en: 'Medicine', ja: '医薬品', icon: '💊' },
  { id: 'clothing', en: 'Clothing', ja: '衣類', icon: '👕' },
  { id: 'baby', en: 'Baby', ja: 'ベビー用品', icon: '🍼' },
  { id: 'pet', en: 'Pet supplies', ja: 'ペット用品', icon: '🐾' },
  { id: 'stationery', en: 'Stationery', ja: '文具', icon: '✏️' },
  { id: 'electronics', en: 'Electronics', ja: '家電・電子機器', icon: '🔌' },
  { id: 'other', en: 'Other', ja: 'その他', icon: '📦' },
] as const

export type ItemKind = (typeof ITEM_KINDS)[number]['id']
export const ITEM_KIND_IDS = ITEM_KINDS.map((k) => k.id) as ItemKind[]
export const KIND_BY_ID = Object.fromEntries(ITEM_KINDS.map((k) => [k.id, k])) as Record<
  ItemKind,
  (typeof ITEM_KINDS)[number]
>

export function isItemKind(v: unknown): v is ItemKind {
  return typeof v === 'string' && (ITEM_KIND_IDS as string[]).includes(v)
}

/** Two product names with the same key are the same product ("カルビー 堅あげポテト" = "カルビー堅あげポテト"). */
export function productKey(name: string): string {
  return normalize(name).replace(/[\s・･·]+/g, '').toLowerCase().slice(0, 80)
}

/** How qty is counted: pieces, or grams / ml of a line sold by weight or volume. */
export type MeasureUnit = 'pc' | 'g' | 'ml'

export function isMeasureUnit(v: unknown): v is MeasureUnit {
  return v === 'pc' || v === 'g' || v === 'ml'
}

/** The price that purchases are compared by: per piece, or per 100 g / 100 ml. */
export function unitPrice(linePrice: number, qty: number, unit: MeasureUnit): number {
  const q = Math.max(1, qty)
  return Math.round(unit === 'pc' ? linePrice / q : (linePrice * 100) / q)
}

/** The suffix for a unit price: " each", "/100g", "/100ml". */
export function perLabel(unit: MeasureUnit): string {
  return unit === 'pc' ? ' each' : `/100${unit}`
}

export interface PackSize {
  /** Grams or ml in one piece. */
  size: number
  unit: 'g' | 'ml'
}

// "300g", "1.5L", "350ml", "500ml×24本" (a case of 24). Not "/100g" or "@198/100g", which are rates.
const SIZE_RE =
  /(?<![\d.,/@])(\d+(?:\.\d+)?)\s*(kg|g|グラム|ml|l|リットル)(?![a-z])(?:\s*[x×*]\s*(\d{1,2})(?!\d)\s*(?:本|個|缶|袋|パック|p|入)?)?/i

/** The pack size written in a product or item name. */
export function parseSize(name: string | undefined): PackSize | null {
  if (!name) return null
  const m = name.normalize('NFKC').match(SIZE_RE)
  if (!m) return null
  const measure = m[2].toLowerCase()
  const n = Number(m[1]) * (measure === 'kg' || measure === 'l' || measure === 'リットル' ? 1000 : 1) * (m[3] ? Number(m[3]) : 1)
  const size = Math.round(n)
  if (!(size >= 1 && size <= 100_000)) return null
  return { size, unit: measure === 'ml' || measure === 'l' || measure === 'リットル' ? 'ml' : 'g' }
}

export function sizeText(s: PackSize | null): string {
  return s ? `${s.size}${s.unit}` : ''
}

/** What a receipt line holds: pieces (maybe with a pack size), or grams / ml sold by weight. */
export interface LineAmount {
  linePrice: number
  qty: number
  unit: MeasureUnit
  /** Pack size of one piece, for unit 'pc'. */
  pack?: PackSize | null
}

/** Every price a line can be compared by: per piece, and per 100 g / 100 ml when its weight is known. */
export function basisPrices(l: LineAmount): Partial<Record<MeasureUnit, number>> {
  const qty = Math.max(1, l.qty)
  if (l.unit !== 'pc') return { [l.unit]: unitPrice(l.linePrice, qty, l.unit) }
  const out: Partial<Record<MeasureUnit, number>> = { pc: unitPrice(l.linePrice, qty, 'pc') }
  if (l.pack) out[l.pack.unit] = unitPrice(l.linePrice, qty * l.pack.size, l.pack.unit)
  return out
}

/** Compare by weight or volume when it is known; else per piece. */
export function primaryBasis(prices: Partial<Record<MeasureUnit, number>>): MeasureUnit {
  return prices.g !== undefined ? 'g' : prices.ml !== undefined ? 'ml' : 'pc'
}

/** One purchase of a product. */
export interface Purchase {
  expenseId: string
  date: string
  store: string
  /** The price on the receipt line. */
  linePrice: number
  qty: number
  unit: MeasureUnit
  pack: PackSize | null
  /** basisPrices() of this line. */
  prices: Partial<Record<MeasureUnit, number>>
  /** primaryBasis() of this line. */
  basis: MeasureUnit
  /** prices[basis]. */
  price: number
}

/** Earlier prices of one product, by one basis. A price per piece and per 100 g do not compare. */
export interface UnitStats {
  count: number
  last: Purchase
  min: Purchase
  lastPrice: number
  minPrice: number
}

export interface PriceStats {
  productId: number
  name: string
  /** The kind of the product, as the user last set it. */
  kind: ItemKind
  byUnit: Partial<Record<MeasureUnit, UnitStats>>
}

/** The newest purchase and the cheapest one by `basis`, from a list sorted newest first. */
export function statsFor(list: Purchase[], basis: MeasureUnit): UnitStats | null {
  const same = list.filter((p) => (p.prices[basis] ?? 0) > 0)
  if (!same.length) return null
  let min = same[0]
  for (const p of same) if (p.prices[basis]! < min.prices[basis]!) min = p
  return { count: same.length, last: same[0], min, lastPrice: same[0].prices[basis]!, minPrice: min.prices[basis]! }
}

// Lines that are clearly not something you buy. Anything else is tracked as a product.
const NON_PRODUCT =
  /値引|割引|クーポン|レジ袋|袋代|ポイント|\bpt\b|手数料|送料|配送料|お?預り|デポジット|保証金|容器代|サービス料|チャージ|消費税|税額|外税|内税|小\s*計|合\s*計|お?釣り?|釣銭/i

/** True for a discount, a bag, points, a fee, or a tax line. A negative price is always a discount. */
export function isNonProduct(name: string, price?: number): boolean {
  return (price !== undefined && price < 0) || NON_PRODUCT.test(name.normalize('NFKC'))
}

/**
 * The product to link a line to. Every line is a product unless it is clearly not one:
 * when the AI gives no product name for a normal line, the line's own name is used.
 * Returns undefined while there is no AI answer yet.
 */
export function linkedProduct(name: string, aiProduct: string | undefined, price?: number): string | undefined {
  if (aiProduct === undefined) return undefined
  if (isNonProduct(name, price)) return ''
  return aiProduct || name.trim()
}

/** ひらがな → カタカナ. */
export function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

// "国産", "北海道産", "九州産" before a name; counts and pack sizes after it ("3本", "1玉", "10個入", "300g").
const ORIGIN = /^(?:国産|国内産|輸入|[\p{Script=Han}]{1,4}産)\s*/u
const AMOUNT_SUFFIX =
  /\s*(?:\d+(?:\.\d+)?\s*(?:kg|g|ml|l|リットル)(?:\s*[x×]\s*\d+\s*(?:本|個|缶|袋|パック|p)?)?|\d+\s*(?:個入り?|個|玉|袋|本|パック|p|枚|束|株|尾|切れ?|コ|ケ|入り?))\s*$/i

/** The keys a name can match a catalog entry by: the name itself, without its origin, and without a pack size. */
export function matchKeys(name: string): string[] {
  const n = name.normalize('NFKC').trim()
  const bare = n.replace(ORIGIN, '').replace(AMOUNT_SUFFIX, '').replace(AMOUNT_SUFFIX, '').trim()
  return [...new Set([productKey(n), productKey(bare)].filter(Boolean))]
}
