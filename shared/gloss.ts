import type { ItemKind } from './products'
import { normalize } from './receipt-parser'

/** Furigana and English for one receipt item name. */
export interface Gloss {
  /** Hiragana reading. Latin letters and numbers stay as they are. */
  reading: string
  /** Short English translation. */
  en: string
  /** The full, corrected product name in Japanese ("カルビー 堅あげポテト"). Empty for a discount or a fee. */
  product: string
  kind: ItemKind
}

export const GLOSS_MAX_LEN = 60

/** The cache key of an item name. The browser and the server must use the same key. */
export function glossKey(name: string): string {
  return normalize(name).replace(/\s+/g, ' ').trim().slice(0, GLOSS_MAX_LEN)
}

/** A reading helps only when the name has kanji; for kana or Latin text it repeats the name. */
export function hasKanji(text: string): boolean {
  return /[㐀-鿿豈-﫿々]/.test(text)
}
