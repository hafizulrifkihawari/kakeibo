import { env } from 'cloudflare:workers'
import { glossKey, type Gloss } from '../../shared/gloss'
import { ITEM_KIND_IDS, isItemKind } from '../../shared/products'
import { lookupCatalog } from './catalog'

export const MODEL = '@cf/google/gemma-4-26b-a4b-it'
const MAX_NAMES = 30

const PROMPT = `You annotate item names from Japanese shop receipts. The names come from OCR, so some characters can be wrong.
For each name, give:
- "reading": the full reading in hiragana. Keep Latin letters and numbers as they are.
- "en": a short English translation (6 words or fewer). For a brand or product name, romanize it and add the product type after a dash, for example "Meiji Takenoko no Sato – chocolate snack". Do not use parentheses.
- "product": the full product name in Japanese, with OCR errors corrected and cut-off words completed, for example "力ルe 堅あけポ" → "カルビー 堅あげポテト". Use the same spelling every time for the same product. Leave out the pack size and count ("300g", "350ml", "2L", "6P", "×24本"), so that different sizes of one product get the same name. For unbranded fresh food, use the plain common name, for example "人参", "豚こま切れ", "卵". Use "" only when the line is clearly not something you buy: a discount, a coupon, a bag fee, points, a delivery or service fee, or a tax line. When you are not sure, give your best product name.
- "kind": one of ${ITEM_KIND_IDS.join(', ')}.
Return one object for each name, in the same order.`

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reading: { type: 'string' },
          en: { type: 'string' },
          product: { type: 'string' },
          kind: { type: 'string', enum: ITEM_KIND_IDS },
        },
        required: ['reading', 'en', 'product', 'kind'],
      },
    },
  },
  required: ['items'],
}

export function replyText(out: unknown): string {
  const o = out as { response?: unknown; choices?: { message?: { content?: string } }[] }
  if (typeof o?.response === 'string') return o.response
  if (o?.response && typeof o.response === 'object') return JSON.stringify(o.response)
  return o?.choices?.[0]?.message?.content ?? ''
}

async function askModel(names: string[]): Promise<Gloss[] | null> {
  try {
    const out = await env.AI.run(MODEL as Parameters<Ai['run']>[0], {
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: JSON.stringify(names) },
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      chat_template_kwargs: { enable_thinking: false },
      max_tokens: 100 * names.length + 100,
      temperature: 0.1,
    } as never)
    const text = replyText(out)
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { items?: unknown }
    if (!Array.isArray(json.items) || json.items.length !== names.length) return null
    return json.items.map((i) => {
      const g = (i ?? {}) as Record<string, unknown>
      return {
        reading: typeof g.reading === 'string' ? g.reading.trim().slice(0, 120) : '',
        en: typeof g.en === 'string' ? g.en.replace(/\s*\(([^)]*)\)/g, ' – $1').trim().slice(0, 120) : '',
        product: typeof g.product === 'string' ? g.product.normalize('NFKC').trim().slice(0, 80) : '',
        kind: isItemKind(g.kind) ? g.kind : 'other',
      }
    })
  } catch (e) {
    console.warn('gloss: AI call failed', e)
    return null
  }
}

/** Cached glosses only; never calls the AI. Keyed by glossKey(name). */
export async function cachedGloss(keys: string[]): Promise<Record<string, Gloss>> {
  const result: Record<string, Gloss> = {}
  for (let i = 0; i < keys.length; i += 90) {
    const part = keys.slice(i, i + 90)
    const { results } = await env.DB.prepare(
      `SELECT name, reading, en, product, kind FROM item_gloss
       WHERE product IS NOT NULL AND name IN (${part.map(() => '?').join(',')})`,
    )
      .bind(...part)
      .all<{ name: string; reading: string; en: string; product: string; kind: string }>()
    for (const r of results) {
      result[r.name] = { reading: r.reading, en: r.en, product: r.product, kind: isItemKind(r.kind) ? r.kind : 'other' }
    }
  }
  return result
}

/** Reading, translation, and product for each item name, keyed by glossKey(name). Uses the D1 cache first. */
export async function glossItems(input: string[]): Promise<Record<string, Gloss>> {
  const names = [...new Set(input.map(glossKey).filter(Boolean))].slice(0, MAX_NAMES)
  if (!names.length) return {}
  return toCatalogNames(await glossFromAi(names))
}

/** Product names that match the shared catalog get the catalog's name and kind ("にんじん" → "人参"). */
async function toCatalogNames(result: Record<string, Gloss>): Promise<Record<string, Gloss>> {
  const hits = await lookupCatalog(Object.values(result).map((g) => g.product))
  for (const g of Object.values(result)) {
    const hit = hits.get(g.product)
    if (hit) Object.assign(g, { product: hit.name, kind: hit.kind })
  }
  return result
}

async function glossFromAi(names: string[]): Promise<Record<string, Gloss>> {
  const result = await cachedGloss(names)
  const missing = names.filter((n) => !result[n])
  if (!missing.length) return result

  // Without the AI binding, or above the free daily limit, the user gets the cached rows only.
  const glosses = await askModel(missing)
  if (!glosses) return result

  const now = Date.now()
  const insert = env.DB.prepare(
    `INSERT INTO item_gloss (name, reading, en, product, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET reading = excluded.reading, en = excluded.en,
       product = excluded.product, kind = excluded.kind`,
  )
  await env.DB.batch(
    missing.map((n, i) => {
      const g = glosses[i]
      return insert.bind(n, g.reading, g.en, g.product, g.kind, now)
    }),
  )
  missing.forEach((n, i) => (result[n] = glosses[i]))
  return result
}
