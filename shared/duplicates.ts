import type { Expense } from './types'

/** Days between two YYYY-MM-DD dates, in UTC so that the time zone has no effect. */
export function dayGap(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.abs(utc(a) - utc(b)) / 86_400_000
}

/** Full-width to half-width, lower case, no spaces or punctuation. */
function normStore(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
}

/** Equal, or one name holds the other ("ライフ" and "ライフ 西五反田店"). An empty name matches any store. */
export function sameStore(a: string, b: string): boolean {
  const x = normStore(a)
  const y = normStore(b)
  return !x || !y || x.includes(y) || y.includes(x)
}

/**
 * An earlier expense that looks like the same receipt: the same amount, a date within 1 day,
 * and a similar store. The draft itself (same ID) is skipped, so an edit does not match itself.
 */
export function findDuplicate(
  draft: Pick<Expense, 'id' | 'date' | 'amount' | 'store'>,
  list: Expense[],
): Expense | undefined {
  if (!draft.amount) return undefined
  return list.find(
    (e) =>
      e.id !== draft.id &&
      e.amount === draft.amount &&
      dayGap(e.date, draft.date) <= 1 &&
      sameStore(e.store, draft.store),
  )
}
