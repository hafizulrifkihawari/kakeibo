const yenFmt = new Intl.NumberFormat('ja-JP')

export function yen(n: number): string {
  return `¥${yenFmt.format(n)}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local date as YYYY-MM-DD. */
export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isoMonth(d = new Date()): string {
  return isoDate(d).slice(0, 7)
}

export function parseIso(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d ?? 1)
}

export function addMonths(ym: string, delta: number): string {
  const d = parseIso(`${ym}-01`)
  d.setMonth(d.getMonth() + delta)
  return isoMonth(d)
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function monthRange(ym: string): { from: string; to: string } {
  return { from: `${ym}-01`, to: `${ym}-${pad(daysInMonth(ym))}` }
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年${m}月`
}

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayLabel(date: string): string {
  const d = parseIso(date)
  const today = isoDate()
  const yesterday = isoDate(new Date(Date.now() - 86_400_000))
  if (date === today) return 'Today'
  if (date === yesterday) return 'Yesterday'
  return `${DOW_EN[d.getDay()]}, ${d.getMonth() + 1}月${d.getDate()}日`
}

export function shortDow(date: string): string {
  return DOW_EN[parseIso(date).getDay()].slice(0, 2)
}

export function uuid(): string {
  return crypto.randomUUID()
}

/** The chain part of a store name: "ライフ 千本店" → "ライフ". */
export function shortStore(store: string): string {
  return store.trim().split(/\s+/)[0] ?? ''
}
