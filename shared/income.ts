/** Where money comes from. */
export type IncomeSource = 'salary' | 'parttime' | 'bonus' | 'gift' | 'refund' | 'other'

export interface Income {
  /** Client-generated UUID. */
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Yen. Always positive. */
  amount: number
  source: IncomeSource
  note: string
  /** Epoch ms of the last edit. The newest edit wins on sync. */
  updatedAt: number
}

export const INCOME_SOURCES: { id: IncomeSource; icon: string; en: string; ja: string }[] = [
  { id: 'salary', icon: '💼', en: 'Salary', ja: '給料' },
  { id: 'parttime', icon: '⏱️', en: 'Part-time', ja: 'バイト' },
  { id: 'bonus', icon: '🎉', en: 'Bonus', ja: '賞与' },
  { id: 'gift', icon: '🎁', en: 'Gift', ja: '贈与' },
  { id: 'refund', icon: '↩️', en: 'Refund', ja: '返金' },
  { id: 'other', icon: '➕', en: 'Other', ja: 'その他' },
]

export const INCOME_BY_ID = Object.fromEntries(INCOME_SOURCES.map((s) => [s.id, s])) as Record<
  IncomeSource,
  (typeof INCOME_SOURCES)[number]
>

export function isIncomeSource(v: unknown): v is IncomeSource {
  return typeof v === 'string' && v in INCOME_BY_ID
}
