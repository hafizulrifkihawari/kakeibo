/**
 * Text search that matches Japanese names in kanji, kana (hiragana or katakana), or romaji.
 * "カルビー", "かるびー", "karubi", and "karubii" all find a product named "カルビー".
 */

const KANA: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
}

// The vowel of a small kana after a consonant: "し" + "ょ" = "sho", "て" + "ぃ" = "ti".
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }
const SMALL_V: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }

/** Lower case, full-width to half-width, and katakana to hiragana. */
export function foldText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･·]+/g, '')
}

/** Hepburn romaji of the kana in a folded text. Other characters stay as they are. */
export function toRomaji(folded: string): string {
  let out = ''
  let doubleNext = false
  const chars = [...folded]
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const next = chars[i + 1]
    if (c === 'っ') {
      doubleNext = true
      continue
    }
    if (c === 'ー') {
      const vowel = out.match(/[aeiou]$/)
      if (vowel) out += vowel[0]
      continue
    }
    let r = KANA[c]
    if (r === undefined) {
      out += c
      doubleNext = false
      continue
    }
    if (next && r.length > 1 && (SMALL_Y[next] || SMALL_V[next])) {
      const stem = r.slice(0, -1)
      if (SMALL_Y[next]) {
        // き + ゃ = kya, し + ゃ = sha, ち + ゃ = cha, じ + ゃ = ja.
        r = /^(sh|ch|j)$/.test(stem) ? stem + SMALL_Y[next] : `${stem}y${SMALL_Y[next]}`
      } else {
        // ふ + ぁ = fa, て + ぃ = ti, ち + ぇ = che.
        r = stem + SMALL_V[next]
      }
      i++
    }
    if (doubleNext) {
      out += r.startsWith('ch') ? 't' : r[0]
      doubleNext = false
    }
    out += r
  }
  return out
}

/**
 * A loose romaji form, so different spellings match: "toufu" = "tofu", "karubii" = "karubi",
 * "shinbun" = "shimbun", "si" = "shi".
 */
export function looseRomaji(romaji: string): string {
  return romaji
    .replace(/[^a-z0-9]/g, '')
    .replace(/si/g, 'shi')
    .replace(/ti/g, 'chi')
    .replace(/tu/g, 'tsu')
    .replace(/(?<![sc])hu/g, 'fu')
    .replace(/zi/g, 'ji')
    .replace(/sy/g, 'sh')
    .replace(/ty/g, 'ch')
    .replace(/(jy|zy)/g, 'j')
    .replace(/m(?=[bp])/g, 'n')
    .replace(/ou/g, 'o')
    .replace(/([aeiou])\1+/g, '$1')
}

/** One searchable text in its two forms. */
interface Field {
  folded: string
  loose: string
}

function fieldOf(text: string): Field {
  const folded = foldText(text)
  return { folded, loose: looseRomaji(toRomaji(folded)) }
}

/** The search index of one record: build it once and reuse it for each query. */
export type SearchIndex = Field[]

export function buildIndex(texts: Array<string | null | undefined>): SearchIndex {
  return texts.filter((t): t is string => !!t && !!t.trim()).map(fieldOf)
}

/** The words of a query. A record matches when it matches every word. */
export function parseQuery(query: string): Field[] {
  return query
    .split(/[\s　,、]+/)
    .filter(Boolean)
    .map(fieldOf)
    .filter((w) => w.folded)
}

export function matchesIndex(index: SearchIndex, words: Field[]): boolean {
  return words.every((w) =>
    index.some((f) => f.folded.includes(w.folded) || (w.loose.length >= 2 && f.loose.includes(w.loose))),
  )
}
