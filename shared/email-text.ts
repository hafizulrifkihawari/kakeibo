// Reads an order email (a .eml file or pasted text) into plain text for the extractor.
// A small MIME reader: headers, multipart, base64, quoted-printable, and the part charset.

export interface EmailText {
  text: string
  from?: string
  subject?: string
  /** YYYY-MM-DD in Japan time, from the Date header. */
  date?: string
}

const MAX_TEXT = 20_000

/** True when the text starts with mail headers, as a .eml file does. */
export function looksLikeEml(s: string): boolean {
  const head = s.slice(0, 4000)
  return /^[\w-]+:/.test(head) && /^(from|date|subject|content-type|mime-version):/im.test(head)
}

/** A .eml file, or pasted text (plain or HTML). */
export function readEmail(input: Uint8Array | string): EmailText {
  if (typeof input === 'string' && !looksLikeEml(input)) {
    return { text: cutFooter(/<\/?(html|body|table|div|p|td)\b/i.test(input) ? htmlToText(input) : clean(input)) }
  }
  const raw = typeof input === 'string' ? latin1(new TextEncoder().encode(input)) : latin1(input)
  const { headers, body } = splitPart(raw)
  const part = pickBody(headers, body)
  const text = part ? (part.html ? htmlToText(part.text) : clean(part.text)) : ''
  return {
    text: cutFooter(text),
    from: headers.from ? decodeWords(headers.from) : undefined,
    subject: headers.subject ? decodeWords(headers.subject) : undefined,
    date: headers.date ? japanDate(headers.date) : undefined,
  }
}

// ── MIME ────────────────────────────────────────────────────────────────

/** Bytes as a string with one char per byte, so binary parts survive until we know their charset. */
function latin1(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return s
}

function bytesOf(s: string): Uint8Array {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}

function splitPart(raw: string): { headers: Record<string, string>; body: string } {
  const s = raw.replace(/\r\n/g, '\n')
  const end = s.indexOf('\n\n')
  const head = end >= 0 ? s.slice(0, end) : s
  const body = end >= 0 ? s.slice(end + 2) : ''
  const headers: Record<string, string> = {}
  // Folded header lines start with white space.
  for (const line of head.replace(/\n[ \t]+/g, ' ').split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/)
    const key = m?.[1].toLowerCase()
    // The first header wins: a forwarded mail can repeat headers lower down.
    if (key && !(key in headers)) headers[key] = m![2].trim()
  }
  return { headers, body }
}

function param(header: string | undefined, name: string): string | undefined {
  const m = header?.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i'))
  return m ? (m[1] ?? m[2]) : undefined
}

/** The text/plain part, or the text/html part when there is no plain part. */
function pickBody(headers: Record<string, string>, body: string): { text: string; html: boolean } | null {
  const type = (headers['content-type'] ?? 'text/plain').toLowerCase()
  if (type.startsWith('multipart/')) {
    const boundary = param(headers['content-type'], 'boundary')
    if (!boundary) return null
    const parts = body
      .split(`--${boundary}`)
      .slice(1)
      .filter((p) => !p.startsWith('--'))
      .map((p) => splitPart(p.replace(/^\n/, '')))
    const found = parts.map((p) => pickBody(p.headers, p.body)).filter((p) => p !== null)
    return found.find((p) => !p.html) ?? found[0] ?? null
  }
  if (!type.startsWith('text/plain') && !type.startsWith('text/html')) return null
  if (/attachment/i.test(headers['content-disposition'] ?? '')) return null
  const enc = (headers['content-transfer-encoding'] ?? '').toLowerCase()
  const bytes = enc === 'base64' ? base64(body) : enc === 'quoted-printable' ? quotedPrintable(body) : body
  return { text: decodeCharset(bytes, param(headers['content-type'], 'charset')), html: type.startsWith('text/html') }
}

function base64(s: string): string {
  try {
    return atob(s.replace(/[^A-Za-z0-9+/=]/g, ''))
  } catch {
    return ''
  }
}

function quotedPrintable(s: string): string {
  return s.replace(/=\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
}

function decodeCharset(binary: string, charset = 'utf-8'): string {
  try {
    return new TextDecoder(charset.toLowerCase()).decode(bytesOf(binary))
  } catch {
    return new TextDecoder('utf-8').decode(bytesOf(binary))
  }
}

/** RFC 2047 words in headers: =?utf-8?B?...?= and =?iso-2022-jp?Q?...?= */
function decodeWords(s: string): string {
  return s
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs: string, enc: string, data: string) =>
      decodeCharset(enc.toUpperCase() === 'B' ? base64(data) : quotedPrintable(data.replace(/_/g, ' ')), cs),
    )
    .replace(/^"|"(?=\s*<)/g, '')
    .trim()
}

function japanDate(header: string): string | undefined {
  const t = Date.parse(header)
  if (!Number.isFinite(t)) return undefined
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10)
}

// ── Text ────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', yen: '¥' }

export function htmlToText(html: string): string {
  return clean(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(style|script|head|title)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>|<\/(tr|p|div|li|h[1-6]|table|ul|ol)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
        if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1))
        return ENTITIES[e.toLowerCase()] ?? m
      }),
  )
}

function clean(s: string): string {
  return s
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t ​]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

// The line with the order total. Not "Subtotal" or 小計.
const TOTAL_LINE = /^(total|order total|grand total|合計|総合計|ご請求(金)?額|お支払(い)?(金)?額)(\s|$|[:：¥])/i

/**
 * Drops the text below the order total (address, delivery notes, links), so the address
 * does not go to the AI and the text stays short. The total line and its amount stay.
 */
export function cutFooter(text: string): string {
  const lines = text.split('\n')
  let idx = lines.length - 1
  while (idx >= 0 && !TOTAL_LINE.test(lines[idx])) idx--
  if (idx < 0 || !lines.slice(0, idx).some((l) => /[¥￥]|円/.test(l))) return text.slice(0, MAX_TEXT)
  const amountOnLine = /\d/.test(lines[idx])
  return lines
    .slice(0, idx + (amountOnLine ? 1 : 2))
    .join('\n')
    .slice(0, MAX_TEXT)
}
