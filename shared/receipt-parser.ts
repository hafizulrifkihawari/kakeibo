import { findKnownStore } from './categorizer'

export interface ReceiptItem {
  name: string
  /** The line price: unit price × qty. */
  price: number
  /** Count of a multi-pack line ("2個 × 単158"), or grams / ml of a line sold by weight. Missing means 1. */
  qty?: number
  /** 'g' or 'ml' for a line sold by weight or volume ("298g × @198/100g"). Missing means pieces. */
  unit?: 'g' | 'ml'
}

export interface ParsedReceipt {
  store: string | null
  /** YYYY-MM-DD */
  date: string | null
  total: number | null
  items: ReceiptItem[]
}

// Lines that carry a total, best first.
const TOTAL_KEYS = [
  /総合計/,
  /(?<!小)合\s*計(?!点|数)/,
  /お?買上\s*計|お?買上げ?合計/,
  /お会計(?!券)|ご会計/,
  /ご?請求額|ご?請求金額/,
  /領収金額|お支払[い]?金?額|支払金額/,
  /TOTAL/i,
]

// Lines whose amount is never the total or an item.
const IGNORE = /小\s*計|お?預[りか]|お?釣[りし銭]?|おつり|釣銭|消費税|税率|税額|内税|外税|対象|ポイント|残高|合計点数|点数|お買上点数|個数|クレジット|現金|電子マネー|交通系|支払方法|カード|TEL|電話|No\.|レジ|責任者|担当/i

const STOP_ITEMS = /小\s*計|合\s*計|お会計(?!券)|総合計|^(sub-?total|total|frete|shipping|imposto)\b/i

const HEADER_NOISE = /領収書|領収証|レシート|いらっしゃいませ|ありがとう|毎度|またお越し|TEL|電話|〒|登録番号|インボイス|^T\d{13}|http|www\.|営業時間/i

// The multilingual OCR model sometimes returns the Simplified Chinese form of a kanji.
const SIMPLIFIED: Record<string, string> = {
  对: '対', 绿: '録', 壳: '売', 卖: '売', 买: '買', 费: '費', 计: '計', 额: '額', 预: '預',
  钱: '銭', 备: '備', 业: '業', 门: '門', 东: '東', 场: '場', 无: '無', 时: '時', 间: '間',
  营: '営', 发: '発', 优: '優', 惠: '恵', 价: '価', 签: '署', 现: '現', 种: '種', 类: '類',
}
const SIMPLIFIED_RE = new RegExp(`[${Object.keys(SIMPLIFIED).join('')}]`, 'g')

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(SIMPLIFIED_RE, (c) => SIMPLIFIED[c])
    .replace(/\r/g, '')
    .replace(/[￥\\]/g, '¥')
    // OCR often splits thousands: "1, 280" → "1,280"; "1.280" → "1,280".
    .replace(/(\d)\s*,\s*(\d{3})(?!\d)/g, '$1,$2')
    // Not a weight such as "0.312kg" or "1.250 g".
    .replace(/(?<![\d.,])(\d+)\.(\d{3})(?!\d)(?!\s*(?:kg|g|ml|l|グラム|リットル)(?![a-z]))/gi, (m, a: string, b: string) =>
      a === '0' ? m : `${a},${b}`,
    )
    .replace(/[ \t　]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

function toInt(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10)
}

/** The money amount on a line, or null. Ignores counts, dates, times, and percentages. */
export function lineAmount(line: string): number | null {
  const l = line
    .replace(/\d{1,4}[\/年.\-]\d{1,2}[\/月.\-]\d{1,2}日?/g, ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
    .replace(/\d+(\.\d+)?\s*%/g, ' ')
    .replace(/\d+\s*(点|個|コ|ケ|本|枚|袋|名|様)/g, ' ')
    .replace(/[x×@]\s*\d+/gi, ' ')

  const neg = /[-−▲△]\s*¥?\s*[\d,]+\s*円?\s*$/.test(l) || /値引|割引/.test(l)

  let m: RegExpMatchArray | undefined = [...l.matchAll(/¥\s*([\d,]+)/g)].pop()
  m ??= [...l.matchAll(/([\d,]+)\s*円/g)].pop()
  m ??= l.match(/(?:^|[\s\-−▲△])([\d,]{1,9})\s*[※*軽外内税非]*\s*$/) ?? undefined
  if (!m) return null

  const digits = m[1]
  // A thousands separator must group exactly 3 digits.
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(digits)) return null
  const n = toInt(digits)
  if (!Number.isFinite(n) || n === 0 || n > 10_000_000) return null
  return neg ? -n : n
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  if (y < 2000 || y > 2100) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parseDate(text: string, today = new Date()): string | null {
  const t = text
  let m = t.match(/(20\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/)
  if (m) return validDate(+m[1], +m[2], +m[3])

  m = t.match(/(?:令和|R)\s*(\d{1,2}|元)\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/)
  if (m) {
    const ry = m[1] === '元' ? 1 : +m[1]
    return validDate(2018 + ry, +m[2], +m[3])
  }

  m = t.match(/(?<![\d\-])(\d{2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?![\d\-])/)
  if (m) return validDate(2000 + +m[1], +m[2], +m[3])

  m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (m) return validDate(today.getFullYear(), +m[1], +m[2])

  return null
}

// OCR often garbles 合計 (e.g. 金十, 合言十). Used as a weak hint only.
const FUZZY_TOTAL = /^[合金]\s*[言]?\s*[計十汁]/

interface Amount {
  value: number
  line: string
}

/**
 * Picks the total by evidence, so one misread keyword does not decide it:
 * a total keyword on the line, subtotal + tax = total, total + change = cash given,
 * and the same amount printed again (e.g. on the tax-base line).
 */
function parseTotal(lines: string[]): number | null {
  const amounts: Amount[] = []
  const keyed = new Map<number, number>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const a = lineAmount(line)
    if (a && a > 0 && /¥|円/.test(line)) amounts.push({ value: a, line })

    const isSub = /小\s*計|合計点数|点数|sub-?total/i.test(line)
    const keyIdx = TOTAL_KEYS.findIndex((k) => k.test(line))
    const weight = keyIdx >= 0 && !isSub ? 4 : FUZZY_TOTAL.test(line) && !isSub ? 2 : 0
    if (!weight) continue
    let v = keyIdx >= 0 ? lineAmount(line.replace(TOTAL_KEYS[keyIdx], ' ')) : a
    // The amount is often on the next line, in a separate column.
    for (const next of v ? [] : lines.slice(i + 1, i + 3)) {
      if (IGNORE.test(next)) break
      v = lineAmount(next)
      if (v) break
    }
    if (v && v > 0) keyed.set(v, Math.max(keyed.get(v) ?? 0, weight))
  }

  const values = amounts.map((a) => a.value)
  const change = amounts.filter((a) => /釣|おつり/.test(a.line)).map((a) => a.value)
  let best: number | null = null
  let bestScore = 0
  for (const t of new Set([...values, ...keyed.keys()])) {
    let score = keyed.get(t) ?? 0
    const own = amounts.filter((a) => a.value === t)
    if (own.length && own.every((a) => IGNORE.test(a.line))) score -= 3
    if (values.some((a, i) => a < t && values.some((b, j) => j !== i && b <= a && a + b === t))) score += 2
    if (change.some((c) => c !== t && values.includes(t + c))) score += 3
    score += Math.min(2, own.length - 1)
    if (score > bestScore || (score === bestScore && best !== null && score > 0 && t > best)) {
      best = t
      bestScore = score
    }
  }
  if (best !== null && bestScore > 0) return best

  // Fallback: the largest amount that is not on an ignored line.
  best = null
  for (const a of amounts) if (!IGNORE.test(a.line) && (best === null || a.value > best)) best = a.value
  return best
}

function cleanName(line: string): string {
  return line
    .replace(/[-−▲△]?\s*¥\s*[\d,]+.*$/, '')
    .replace(/[\d,]+\s*円.*$/, '')
    .replace(/\s[-−▲△]?[\d,]+\s*[※*軽外内税非]*\s*$/, '')
    .replace(/^[\d\s]{6,}/, '') // product codes
    .replace(/^[外内]\s*\d{0,2}\s+/, '') // tax-rate marker such as 外8
    .replace(/\s+特$/, '') // sale marker
    .replace(/^[※*軽]+|[※*軽]+$/g, '')
    .trim()
}

const COUNT = '(?:個|コ|ケ|点|本|枚|袋|パック|缶|P)'
const MUL = '[x×X*]'
const NUM = '(\\d[\\d,]*)(?![\\d,])'
const QTY = '(\\d{1,2})(?![\\d,])'
const UNIT_MARK = '(?:単価?|@)'
// Each pattern gives [qty, unit] from its groups.
const QTY_PATTERNS: [RegExp, (m: RegExpMatchArray) => [string, string]][] = [
  // @158 x 2, 単158 2コ, 単価158×2個
  [new RegExp(`${UNIT_MARK}\\s*¥?\\s*${NUM}\\s*円?\\s*(?:${MUL}\\s*)?${QTY}\\s*${COUNT}?`), (m) => [m[2], m[1]]],
  // 158円×2個
  [new RegExp(`¥?\\s*${NUM}\\s*円\\s*${MUL}\\s*${QTY}\\s*${COUNT}?`), (m) => [m[2], m[1]]],
  // 2個 @158, 2コX単158, 2個 × 158
  [new RegExp(`(?<![\\d,¥]\\s*)${QTY}\\s*${COUNT}?\\s*(?:${MUL}\\s*${UNIT_MARK}?|${UNIT_MARK})\\s*¥?\\s*${NUM}\\s*円?`), (m) => [m[1], m[2]]],
  // ¥158 x 2
  [new RegExp(`¥\\s*${NUM}\\s*${MUL}\\s*${QTY}\\s*${COUNT}?`), (m) => [m[2], m[1]]],
]

/** A multi-pack note such as "2個 × 単158". `rest` is the line without it. */
export function parseQty(line: string): { qty: number; unit: number; rest: string } | null {
  for (const [re, pick] of QTY_PATTERNS) {
    const m = line.match(re)
    if (!m) continue
    const [q, u] = pick(m)
    const qty = Number(q)
    const unit = toInt(u)
    if (qty >= 2 && qty <= 99 && unit > 0 && unit < 1_000_000) {
      return { qty, unit, rest: line.replace(m[0], ' ').replace(/\s+/g, ' ').trim() }
    }
  }
  return null
}

const MEASURE = '(kg|g|グラム|ml|l|リットル)(?![a-z])'
// [regex, group of the price, group of the base amount, group of the measure]
const PER_PATTERNS: [RegExp, number, number, number][] = [
  // @198/100g, 198円/100g, 単価¥1,980/kg
  [new RegExp(`(?:@|単価?)?\\s*¥?\\s*${NUM}\\s*円?\\s*/\\s*(\\d*)\\s*${MEASURE}`, 'i'), 1, 2, 3],
  // 100g当り198円, 100gあたり ¥198, 100g単価198
  [new RegExp(`(\\d*)\\s*${MEASURE}\\s*(?:当た?り|あたり|につき|単価)\\s*¥?\\s*${NUM}\\s*円?`, 'i'), 3, 1, 2],
]
const AMOUNT = new RegExp(`(?<![\\d.,])(\\d+(?:\\.\\d+)?)\\s*${MEASURE}`, 'i')

function toBase(n: number, measure: string): { value: number; unit: 'g' | 'ml' } {
  const m = measure.toLowerCase()
  if (m === 'kg') return { value: n * 1000, unit: 'g' }
  if (m === 'l' || m === 'リットル') return { value: n * 1000, unit: 'ml' }
  return { value: n, unit: m === 'ml' ? 'ml' : 'g' }
}

/** A price-by-weight note such as "298g × @198/100g". qty is in grams or ml. */
export function parseMeasure(line: string): { qty: number; unit: 'g' | 'ml'; total: number; rest: string } | null {
  for (const [re, pi, ai, mi] of PER_PATTERNS) {
    const m = line.match(re)
    if (!m) continue
    const per = toInt(m[pi])
    const base = toBase(m[ai] ? Number(m[ai]) : 1, m[mi])
    const without = line.replace(m[0], ' ')
    const a = without.match(AMOUNT)
    if (!a) continue
    const amount = toBase(Number(a[1]), a[2])
    if (amount.unit !== base.unit) continue
    const qty = Math.round(amount.value)
    const total = Math.round((amount.value * per) / base.value)
    if (qty < 1 || qty > 100_000 || per <= 0 || total <= 0) continue
    const rest = without.replace(a[0], ' ').replace(/[x×X*]/g, ' ').replace(/\s+/g, ' ').trim()
    return { qty, unit: amount.unit, total, rest }
  }
  return null
}

interface Note {
  qty: number
  unit?: 'g' | 'ml'
  /** The line price this note gives. */
  total: number
  /** A number left on the note line that is not a line price (the unit price of "2個 × 単158"). */
  ignore?: number
  rest: string
}

function parseNote(line: string): Note | null {
  const w = parseMeasure(line)
  if (w) return w
  const q = parseQty(line)
  return q && { qty: q.qty, total: q.qty * q.unit, ignore: q.unit, rest: q.rest }
}

/** Weight prices are rounded on the receipt, so allow ¥1 of difference. */
function fits(note: Note, price: number): boolean {
  return note.unit ? Math.abs(note.total - price) <= 1 : note.total === price
}

function withNote(item: ReceiptItem, note: Note): ReceiptItem {
  return note.unit ? { ...item, qty: note.qty, unit: note.unit } : { ...item, qty: note.qty }
}

function parseItems(lines: string[], start: number): ReceiptItem[] {
  // When most prices carry ¥, a bare number is a code or a count, not a price.
  const requireYen = lines.filter((l) => /¥/.test(l)).length >= 3
  const items: ReceiptItem[] = []
  let sum = 0
  // A multi-pack or weight note above its item line, waiting for that line.
  let pending: Note | null = null
  for (let i = start; i < lines.length; i++) {
    let line = lines[i]
    if (STOP_ITEMS.test(line)) break
    let note: Note | null = parseNote(line)
    if (note) {
      const rest = lineAmount(note.rest)
      if (rest === null || rest === note.ignore) {
        // A note on its own line: it belongs to the item above or below with the matching total.
        const prev = items[items.length - 1]
        if (prev && !prev.qty && fits(note, prev.price)) items[items.length - 1] = withNote(prev, note)
        else pending = note
        continue
      }
      // The note and the line price are on one line ("2コX単158 ¥316").
      line = note.rest
    }
    if (IGNORE.test(line) && !/値引|割引/.test(line)) continue
    if (requireYen && !/¥/.test(line) && !/値引|割引/.test(line)) continue
    const price = lineAmount(line)
    if (price === null) continue
    // A price equal to everything so far is the subtotal, even if OCR lost the 小計 label.
    if (items.length >= 2 && price === sum) break
    let name = cleanName(line)
    const usable = (l: string | undefined) =>
      l !== undefined && lineAmount(l) === null && !HEADER_NOISE.test(l) && !IGNORE.test(l) && /[\p{L}]{2,}/u.test(l)
    if (!/[\p{L}]/u.test(name)) {
      // Name on its own line: before the price (maybe above a note), or after it when OCR split the row.
      const above = i - 1 > start && parseNote(lines[i - 1]) ? i - 2 : i - 1
      if (above >= start && usable(lines[above])) name = cleanName(lines[above])
      else if (usable(lines[i + 1])) name = cleanName(lines[i + 1])
    }
    if (!name || !/[\p{L}]/u.test(name)) continue
    if (note && !fits(note, price) && note.unit) note = null
    if (!note && pending && fits(pending, price)) note = pending
    pending = null
    items.push(note ? withNote({ name, price }, note) : { name, price })
    sum += price
  }
  return items
}

function parseStore(lines: string[], text: string): string | null {
  const head = lines.slice(0, 8)
  const known = findKnownStore(head.join('\n')) ?? findKnownStore(text)
  const branch = head.find((l) => /\S+店\s*$/.test(l) && !HEADER_NOISE.test(l) && l.length <= 30)
  if (known) {
    const b = branch?.replace(known.match, '').trim()
    return b && b !== known.name ? `${known.name} ${b}` : known.name
  }
  const brandIdx = head.findIndex(
    (l) =>
      l !== branch &&
      l.length >= 2 &&
      l.length <= 30 &&
      !HEADER_NOISE.test(l) &&
      lineAmount(l) === null &&
      parseDate(l) === null &&
      /[\p{L}]{2,}/u.test(l),
  )
  let brand = brandIdx >= 0 ? head[brandIdx] : undefined
  // Logos read as mixed case ("GOREmO"); a mostly upper-case Latin word is all upper case.
  if (brand && /^[A-Za-z]+$/.test(brand) && brand.replace(/[^A-Z]/g, '').length >= brand.length * 0.6) {
    brand = brand.toUpperCase()
  }
  if (branch && brand && brandIdx < head.indexOf(branch)) return `${brand} ${branch}`
  return branch ?? brand ?? null
}

export function parseReceipt(raw: string, today = new Date()): ParsedReceipt {
  const text = normalize(raw)
  const lines = text.split('\n')

  const date = parseDate(text, today)
  const total = parseTotal(lines)
  const store = parseStore(lines, text)

  // Items start after the last header line that has the date, or at the top.
  const dateLine = lines.findIndex((l) => parseDate(l, today) !== null)
  const start = dateLine >= 0 && dateLine < lines.length / 2 ? dateLine + 1 : 0
  const items = parseItems(lines, start)

  return { store, date, total, items }
}
