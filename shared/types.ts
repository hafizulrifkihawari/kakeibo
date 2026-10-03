import type { CategoryId } from './categories'
import type { ItemKind, MeasureUnit } from './products'

export type OcrEngine = 'vision' | 'paddle' | 'paste' | 'manual'

export interface ExpenseItem {
  name: string
  price: number
  /** The linked product name. Empty or missing: not a product (a discount, a bag) or not linked yet. */
  product?: string
  /** The category of this line (dairy, clothing, ...). */
  kind?: ItemKind
  /** True when the user picked the kind: the linked product then takes this kind too. */
  kindManual?: boolean
  /** Count of a multi-pack line, or grams / ml when `unit` is 'g' or 'ml'. `price` is the line price. Missing means 1. */
  qty?: number
  /** Missing means 'pc'. */
  unit?: MeasureUnit
  /** Pack size of one piece, for unit 'pc'. Missing: read it from the name. 0: no size. */
  size?: number
  sizeUnit?: 'g' | 'ml'
}

export interface Expense {
  /** Client-generated UUID. */
  id: string
  /** YYYY-MM-DD */
  date: string
  amount: number
  store: string
  categoryId: CategoryId
  note: string
  ocrEngine: OcrEngine
  rawText: string
  items: ExpenseItem[]
  /** Epoch ms of the last edit. The newest edit wins on sync. */
  updatedAt: number
}

export interface User {
  id: number
  email: string
}
