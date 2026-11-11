import { CATEGORY_BY_ID, isCategoryId } from '../../shared/categories'
import { KIND_BY_ID } from '../../shared/products'
import { buildIndex, matchesIndex, parseQuery, type SearchIndex } from '../../shared/search'
import type { ProductSummary } from '../server/products'

/** The texts that a product search looks at: names, reading, stores, kind, and categories. */
function productIndex(p: ProductSummary): SearchIndex {
  const kind = KIND_BY_ID[p.kind]
  // A cached list from an older app version has no stores or categories.
  const stores = p.stores ?? [p.lastStore, p.minStore]
  const categories = (p.categories ?? []).filter(isCategoryId).map((id) => CATEGORY_BY_ID[id])
  return buildIndex([
    p.name,
    p.en,
    p.reading,
    ...stores,
    kind?.en,
    kind?.ja,
    p.kind.replace(/_/g, ' '),
    ...categories.flatMap((c) => [c.en, c.ja, c.id]),
  ])
}

/** Returns a filter for the products that match a query. An empty query matches all. */
export function productMatcher(products: ProductSummary[]): (query: string) => ProductSummary[] {
  const indexed = products.map((p) => ({ p, index: productIndex(p) }))
  return (query) => {
    const words = parseQuery(query)
    if (!words.length) return products
    return indexed.filter((x) => matchesIndex(x.index, words)).map((x) => x.p)
  }
}
