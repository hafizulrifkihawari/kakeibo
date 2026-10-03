import { env } from 'cloudflare:workers'
import { isItemKind, matchKeys, type ItemKind } from '../../shared/products'

export interface CatalogHit {
  id: number
  name: string
  reading: string
  en: string
  kind: ItemKind
}

/** The catalog entry of each name that matches one, keyed by the input name. */
export async function lookupCatalog(names: string[]): Promise<Map<string, CatalogHit>> {
  const keysOf = new Map(names.filter(Boolean).map((n) => [n, matchKeys(n)]))
  const keys = [...new Set([...keysOf.values()].flat())]
  const byKey = new Map<string, CatalogHit>()
  for (let i = 0; i < keys.length; i += 90) {
    const part = keys.slice(i, i + 90)
    const { results } = await env.DB.prepare(
      `SELECT a.key, c.id, c.name, c.reading, c.en, c.kind FROM catalog_aliases a
       JOIN catalog c ON c.id = a.catalog_id WHERE a.key IN (${part.map(() => '?').join(',')})`,
    )
      .bind(...part)
      .all<{ key: string; id: number; name: string; reading: string; en: string; kind: string }>()
    for (const r of results) {
      byKey.set(r.key, { id: r.id, name: r.name, reading: r.reading, en: r.en, kind: isItemKind(r.kind) ? r.kind : 'other' })
    }
  }
  const out = new Map<string, CatalogHit>()
  for (const [name, ks] of keysOf) {
    const hit = ks.map((k) => byKey.get(k)).find(Boolean)
    if (hit) out.set(name, hit)
  }
  return out
}
