import { ONCE_A_MONTH, projectMonth, type Budget } from './budget'
import { CATEGORY_BY_ID, type CategoryId } from './categories'
import type { IncomeSource } from './income'
import type { ItemKind } from './products'

/** One month, the year to date, or one full year. */
export type ReportPeriod = { kind: 'month'; ym: string } | { kind: 'ytd' } | { kind: 'year'; year: number }

export interface PeriodRange {
  /** YYYY-MM-DD, inclusive. For the current month or year, `to` is today. */
  from: string
  to: string
  /** The span that the period is compared with: last month, or the same span last year. */
  prevFrom: string
  prevTo: string
  /** The months to show, YYYY-MM, oldest first. Includes months with no data. */
  months: string[]
  /** Days from `from` to `to`, at least 1. */
  days: number
  label: string
  prevLabel: string
}

/** The sums that the server returns for a report. Small: one row for each month and category. */
export interface ReportRaw {
  catMonths: { ym: string; id: CategoryId; amount: number }[]
  prevCategories: { id: CategoryId; amount: number }[]
  incomeMonths: { ym: string; source: IncomeSource; amount: number }[]
  prevIncome: number
  /** Spending by store name, largest first. */
  stores: { store: string; amount: number; count: number }[]
  /** Item line totals by item kind. Only lines that have a kind. */
  kinds: { kind: ItemKind; amount: number }[]
}

export interface Report {
  range: PeriodRange
  spent: number
  income: number
  prevSpent: number
  prevIncome: number
  months: { ym: string; spent: number; income: number }[]
  /** Largest first. Includes categories that had spending only in the previous span. */
  categories: { id: CategoryId; amount: number; prev: number }[]
  sources: { id: IncomeSource; amount: number }[]
  /** The top 5 store chains. */
  stores: { store: string; amount: number; count: number }[]
  kinds: { kind: ItemKind; amount: number }[]
  catMonths: ReportRaw['catMonths']
}

export interface Insight {
  icon: string
  text: string
  tone: 'good' | 'bad' | 'info'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function dayCount(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

/** The same date in another year. Feb 29 becomes Feb 28. */
function shiftYear(date: string, delta: number): string {
  const y = Number(date.slice(0, 4)) + delta
  const m = Number(date.slice(5, 7))
  const d = Math.min(Number(date.slice(8, 10)), lastDay(y, m))
  return `${y}-${pad(m)}-${pad(d)}`
}

function prevMonth(ym: string): string {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`
}

function monthsOf(year: number, upTo = 12): string[] {
  return Array.from({ length: upTo }, (_, i) => `${year}-${pad(i + 1)}`)
}

export function monthName(ym: string): string {
  return `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月`
}

/** The dates of a period. `today` is YYYY-MM-DD. A current period ends today, so it compares like with like. */
export function periodRange(period: ReportPeriod, today: string): PeriodRange {
  const curYear = Number(today.slice(0, 4))
  if (period.kind === 'month') {
    const { ym } = period
    const y = Number(ym.slice(0, 4))
    const m = Number(ym.slice(5, 7))
    const current = ym === today.slice(0, 7)
    const to = current ? today : `${ym}-${pad(lastDay(y, m))}`
    const prev = prevMonth(ym)
    const prevDays = lastDay(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)))
    const prevDay = current ? Math.min(Number(today.slice(8, 10)), prevDays) : prevDays
    return {
      from: `${ym}-01`,
      to,
      prevFrom: `${prev}-01`,
      prevTo: `${prev}-${pad(prevDay)}`,
      months: [ym],
      days: dayCount(`${ym}-01`, to),
      label: monthName(ym),
      prevLabel: current ? 'the same days last month' : 'last month',
    }
  }
  const year = period.kind === 'ytd' ? curYear : period.year
  const current = year === curYear
  const from = `${year}-01-01`
  const to = current ? today : `${year}-12-31`
  return {
    from,
    to,
    prevFrom: `${year - 1}-01-01`,
    prevTo: shiftYear(to, -1),
    months: period.kind === 'ytd' ? monthsOf(year, Number(today.slice(5, 7))) : monthsOf(year),
    days: dayCount(from, to),
    label: period.kind === 'ytd' ? `${year} so far` : `${year}年`,
    prevLabel: current ? 'the same days last year' : 'last year',
  }
}

/** The chain part of a store name: "ライフ 千本店" → "ライフ". */
export function storeChain(store: string): string {
  return store.trim().split(/\s+/)[0] ?? ''
}

export function buildReport(range: PeriodRange, raw: ReportRaw): Report {
  const months = new Map(range.months.map((ym) => [ym, { ym, spent: 0, income: 0 }]))
  const cats = new Map<CategoryId, { id: CategoryId; amount: number; prev: number }>()
  const cat = (id: CategoryId) => cats.get(id) ?? cats.set(id, { id, amount: 0, prev: 0 }).get(id)!
  for (const r of raw.catMonths) {
    const m = months.get(r.ym)
    if (m) m.spent += r.amount
    cat(r.id).amount += r.amount
  }
  for (const r of raw.prevCategories) cat(r.id).prev += r.amount

  const sources = new Map<IncomeSource, number>()
  for (const r of raw.incomeMonths) {
    const m = months.get(r.ym)
    if (m) m.income += r.amount
    sources.set(r.source, (sources.get(r.source) ?? 0) + r.amount)
  }

  const chains = new Map<string, { store: string; amount: number; count: number }>()
  for (const r of raw.stores) {
    const name = storeChain(r.store)
    if (!name) continue
    const s = chains.get(name) ?? chains.set(name, { store: name, amount: 0, count: 0 }).get(name)!
    s.amount += r.amount
    s.count += r.count
  }

  const monthList = [...months.values()]
  const byAmount = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount
  return {
    range,
    spent: monthList.reduce((s, m) => s + m.spent, 0),
    income: monthList.reduce((s, m) => s + m.income, 0),
    prevSpent: raw.prevCategories.reduce((s, r) => s + r.amount, 0),
    prevIncome: raw.prevIncome,
    months: monthList,
    categories: [...cats.values()].sort((a, b) => b.amount - a.amount || b.prev - a.prev),
    sources: [...sources].map(([id, amount]) => ({ id, amount })).sort(byAmount),
    stores: [...chains.values()].sort(byAmount).slice(0, 5),
    kinds: raw.kinds.filter((k) => k.amount > 0).sort(byAmount),
    catMonths: raw.catMonths,
  }
}

const yenFmt = new Intl.NumberFormat('ja-JP')
const yen = (n: number) => `¥${yenFmt.format(Math.round(n))}`

/** Change as a whole percent. Null when there is nothing to compare with. */
export function change(now: number, prev: number): number | null {
  return prev > 0 ? Math.round(((now - prev) / prev) * 100) : null
}

/** Category changes under this amount are noise. */
const MIN_CATEGORY_CHANGE = 1000

/** Short plain-language findings for a report. They need no network. */
export function insights(r: Report, budgets: Budget[], today: string): Insight[] {
  const out: Insight[] = []
  const { range } = r

  const pct = change(r.spent, r.prevSpent)
  if (pct !== null && r.spent > 0) {
    const diff = r.spent - r.prevSpent
    out.push({
      icon: diff > 0 ? '📈' : '📉',
      text: `Spending is ${diff > 0 ? 'up' : 'down'} ${Math.abs(pct)}% (${yen(Math.abs(diff))}) compared with ${range.prevLabel}.`,
      tone: diff > 0 ? 'bad' : 'good',
    })
  }

  const moved = r.categories
    .map((c) => ({ ...c, diff: c.amount - c.prev }))
    .filter((c) => c.prev > 0 && Math.abs(c.diff) >= MIN_CATEGORY_CHANGE)
  const up = moved.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
  const down = moved.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]
  if (up) {
    out.push({
      icon: CATEGORY_BY_ID[up.id].icon,
      text: `${CATEGORY_BY_ID[up.id].en} went up the most: +${yen(up.diff)} (${change(up.amount, up.prev)}%).`,
      tone: 'bad',
    })
  }
  if (down) {
    out.push({
      icon: CATEGORY_BY_ID[down.id].icon,
      text: `${CATEGORY_BY_ID[down.id].en} went down the most: −${yen(-down.diff)} (${change(down.amount, down.prev)}%).`,
      tone: 'good',
    })
  }

  if (r.income > 0) {
    const kept = r.income - r.spent
    out.push(
      kept >= 0
        ? { icon: '🐷', text: `You kept ${Math.round((kept / r.income) * 100)}% of your income (${yen(kept)}).`, tone: 'good' }
        : { icon: '⚠️', text: `You spent ${yen(-kept)} more than your income.`, tone: 'bad' },
    )
  }

  out.push(...budgetInsights(r, budgets, today))
  return out.slice(0, 6)
}

function budgetInsights(r: Report, budgets: Budget[], today: string): Insight[] {
  const out: Insight[] = []
  const total = budgets.find((b) => b.scope === 'total')?.amount ?? 0
  const curYm = today.slice(0, 7)
  const day = Number(today.slice(8, 10))

  if (r.range.months.length === 1) {
    const ym = r.range.months[0]
    if (ym !== curYm) return out
    const days = lastDay(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))
    const once = r.categories.filter((c) => ONCE_A_MONTH.includes(c.id)).reduce((s, c) => s + c.amount, 0)
    const projected = projectMonth(r.spent, once, day, days)
    if (!total) {
      if (r.spent > 0) out.push({ icon: '🔮', text: `At this pace the month ends at ${yen(projected)}.`, tone: 'info' })
    } else if (projected <= total) {
      out.push({ icon: '✅', text: `At this pace the month ends at ${yen(projected)}, inside your budget.`, tone: 'good' })
    } else {
      out.push({
        icon: '🔮',
        text: `At this pace the month ends at ${yen(projected)}, ${yen(projected - total)} over your budget.`,
        tone: 'bad',
      })
    }
    return out
  }

  // Only months that have started and have spending count. Empty months are before the user started.
  const started = r.months.filter((m) => m.ym <= curYm && m.spent > 0)
  if (total && started.length) {
    const over = started.filter((m) => m.spent > total).length
    out.push(
      over
        ? {
            icon: '🚨',
            text: `You went over the total budget in ${over} of ${started.length} ${started.length === 1 ? 'month' : 'months'}.`,
            tone: 'bad',
          }
        : { icon: '✅', text: `You stayed inside the total budget in every month.`, tone: 'good' },
    )
  }

  let worst: { id: CategoryId; over: number } | null = null
  for (const b of budgets) {
    if (b.scope === 'total') continue
    const over = r.catMonths.filter((c) => c.id === b.scope && c.ym <= curYm && c.amount > b.amount).length
    if (over && (!worst || over > worst.over)) worst = { id: b.scope, over }
  }
  if (worst) {
    const c = CATEGORY_BY_ID[worst.id]
    out.push({
      icon: c.icon,
      text: `${c.en} went over its budget in ${worst.over} ${worst.over === 1 ? 'month' : 'months'}.`,
      tone: 'bad',
    })
  }
  return out
}
