import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lineAmount, parseDate, parseMeasure, parseQty, parseReceipt } from '../receipt-parser'
import { categorize } from '../categorizer'
import { basisPrices, isItemKind, linkedProduct, matchKeys, parseSize, productKey, toKatakana } from '../products'
import { GROCERY_CATALOG } from '../grocery-catalog'

const today = new Date('2026-10-02T12:00:00+09:00')

describe('lineAmount', () => {
  it.each([
    ['おにぎり ¥150', 150],
    ['牛乳 ￥２１８※', 218],
    ['合計 1,280円', 1280],
    ['サラダチキン 248軽', 248],
    ['値引 -50', -50],
    ['2026/10/02 12:34', null],
    ['合計点数 3点', null],
    ['(8% 対象 ¥1,000)', 1000],
  ])('%s → %s', (line, expected) => {
    expect(lineAmount(line.normalize('NFKC').replace(/[￥\\]/g, '¥'))).toBe(expected)
  })
})

describe('parseDate', () => {
  it.each([
    ['2026年10月2日(金)', '2026-10-02'],
    ['2026/10/02 12:34', '2026-10-02'],
    ['26.10.02', '2026-10-02'],
    ['令和8年10月2日', '2026-10-02'],
    ['R8.10.2', '2026-10-02'],
    ['10月2日', '2026-10-02'],
    ['TEL 03-1234-5678', null],
  ])('%s → %s', (text, expected) => {
    expect(parseDate(text.normalize('NFKC'), today)).toBe(expected)
  })
})

describe('parseQty', () => {
  it.each([
    ['2個 × 単158', 2, 158],
    ['2コX単158', 2, 158],
    ['@158 x 2', 2, 158],
    ['単158 3コ', 3, 158],
    ['158円×2個', 2, 158],
    ['2個 @1,280', 2, 1280],
    ['(2個 × 158)', 2, 158],
    ['¥98 × 4', 4, 98],
  ])('%s → %d × %d', (line, qty, unit) => {
    expect(parseQty(line.normalize('NFKC'))).toMatchObject({ qty, unit })
  })
  it.each(['お茶 500ml×24本', '@158 316', 'カルビー 6P ¥398', '1個 × 158', 'TEL 075-123-4567'])('%s → null', (line) => {
    expect(parseQty(line.normalize('NFKC'))).toBeNull()
  })
})

describe('parseMeasure', () => {
  it.each([
    ['298g × @198/100g', 298, 'g', 590],
    ['@198/100g 298g', 298, 'g', 590],
    ['100g当り198円 298g', 298, 'g', 590],
    ['100gあたり ¥128 × 0.45kg', 450, 'g', 576],
    ['単価¥1,980/kg 0.312kg', 312, 'g', 618],
    ['1.2kg @98/100g', 1200, 'g', 1176],
    ['520ml × @30/100ml', 520, 'ml', 156],
  ])('%s → %d %s, ¥%d', (line, qty, unit, total) => {
    expect(parseMeasure(line.normalize('NFKC'))).toMatchObject({ qty, unit, total })
  })
  it.each(['アサヒ スーパードライ 350ml ¥228', 'お茶 2L ¥158', '298g', '@198/100g'])('%s → null', (line) => {
    expect(parseMeasure(line.normalize('NFKC'))).toBeNull()
  })
})

describe('parseReceipt', () => {
  it('reads a konbini receipt and ignores cash given and change', () => {
    const text = `ローソン
渋谷道玄坂店
東京都渋谷区道玄坂1-2-3
TEL 03-1234-5678
領収書
2026年10月2日(金) 12:34
おにぎり 鮭 ¥150※
サラダチキン ¥248※
ペットボトル お茶 ¥140※
小計 ¥538
合計 ¥581
(内消費税等 ¥43)
お預り ¥1,000
お釣り ¥419`
    const r = parseReceipt(text, today)
    expect(r.store).toBe('ローソン 渋谷道玄坂店')
    expect(r.date).toBe('2026-10-02')
    expect(r.total).toBe(581)
    expect(r.items).toEqual([
      { name: 'おにぎり 鮭', price: 150 },
      { name: 'サラダチキン', price: 248 },
      { name: 'ペットボトル お茶', price: 140 },
    ])
    expect(categorize({ store: r.store!, text, items: r.items })).toBe('konbini')
  })

  it('reads full-width numbers, a Reiwa date, and a total on the next line', () => {
    const text = `スーパーまるやま
令和８年９月３０日
キャベツ　　　　１９８
牛乳　　　　　　２１８
値引　　　　　　－２０
合　計
￥３９６
お預かり　　　　￥５００`
    const r = parseReceipt(text, today)
    expect(r.date).toBe('2026-09-30')
    expect(r.total).toBe(396)
    expect(r.store).toBe('スーパーまるやま')
    expect(r.items).toEqual([
      { name: 'キャベツ', price: 198 },
      { name: '牛乳', price: 218 },
      { name: '値引', price: -20 },
    ])
    expect(categorize({ store: r.store!, text, items: r.items })).toBe('groceries')
  })

  it('reads multi-pack lines in the common layouts', () => {
    const text = `スーパーまるやま
2026/10/02
おにぎり 鮭 ¥316
  2個 × 単158
  3コX単98
ヨーグルト ¥294
牛乳 2個×218 ¥436
食パン
2コX単150 ¥300
バナナ ¥198
小計 ¥1,544`
    const r = parseReceipt(text, today)
    expect(r.items).toEqual([
      { name: 'おにぎり 鮭', price: 316, qty: 2 },
      { name: 'ヨーグルト', price: 294, qty: 3 },
      { name: '牛乳', price: 436, qty: 2 },
      { name: '食パン', price: 300, qty: 2 },
      { name: 'バナナ', price: 198 },
    ])
  })

  it('reads lines sold by weight', () => {
    const text = `フレスコ 千本店
2026/10/02
国産豚こま切れ ¥590
  298g × @198/100g
  100g当り128円 452g
鶏もも肉 ¥579
バラ売りトマト 0.312kg @1,980/kg ¥618
バナナ ¥198
合計 ¥1,985`
    const r = parseReceipt(text, today)
    expect(r.items).toEqual([
      { name: '国産豚こま切れ', price: 590, qty: 298, unit: 'g' },
      { name: '鶏もも肉', price: 579, qty: 452, unit: 'g' },
      { name: 'バラ売りトマト', price: 618, qty: 312, unit: 'g' },
      { name: 'バナナ', price: 198 },
    ])
  })

  it('falls back to the largest yen amount when no total keyword exists', () => {
    const r = parseReceipt(`喫茶 ひまわり\n2026/10/01\nブレンドコーヒー ¥480\nケーキ ¥520\n¥1,000`, today)
    expect(r.total).toBe(1000)
  })
})

// A real thermal receipt from GOREMO (Kyoto), photographed on a phone.
describe('GOREMO receipt', () => {
  const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
  const prices = [119, 279, 159, 159, 219, 258]

  it('reads a clean transcription', () => {
    const text = fixture('goremo.clean.txt')
    const r = parseReceipt(text, today)
    expect(r.store).toBe('GOREMO 千本中立売店')
    expect(r.date).toBe('2026-10-02')
    expect(r.total).toBe(1288)
    expect(r.items.map((i) => i.price)).toEqual(prices)
    expect(r.items[0].name).toBe('サントリー CCレ')
    expect(categorize({ store: r.store!, text, items: r.items })).toBe('groceries')
  })

  it('reads the on-device PaddleOCR output despite misread labels', () => {
    // In this output 合計 reads as "金言十" and some kanji come back in Simplified Chinese.
    const text = fixture('goremo.paddle.txt')
    const r = parseReceipt(text, today)
    expect(r.store).toBe('GOREMO 千本中立売店')
    expect(r.date).toBe('2026-10-02')
    expect(r.total).toBe(1288)
    expect(r.items.map((i) => i.price)).toEqual(prices)
    expect(categorize({ store: r.store!, text, items: r.items })).toBe('groceries')
  })
})

describe('parseSize', () => {
  it.each([
    ['国産豚こま 300g', 300, 'g'],
    ['アサヒ スーパードライ 350ml', 350, 'ml'],
    ['お茶 2L', 2000, 'ml'],
    ['サラダ油 1.5Ｌ', 1500, 'ml'],
    ['お茶 500ml×24本', 12000, 'ml'],
    ['米 5kg', 5000, 'g'],
  ])('%s → %d %s', (name, size, unit) => {
    expect(parseSize(name)).toEqual({ size, unit })
  })
  it.each(['カルビー 6P', '298g × @198/100g'.replace('298g × ', ''), 'バナナ', 'R1 ¥98'])('%s → null', (name) => {
    expect(parseSize(name)).toBeNull()
  })
})

describe('basisPrices', () => {
  it('prices a pack per piece and per 100 g', () => {
    expect(basisPrices({ linePrice: 796, qty: 2, unit: 'pc', pack: { size: 300, unit: 'g' } })).toEqual({ pc: 398, g: 133 })
  })
  it('prices a line sold by weight per 100 g only', () => {
    expect(basisPrices({ linePrice: 733, qty: 412, unit: 'g' })).toEqual({ g: 178 })
  })
})

describe('linkedProduct', () => {
  it('tracks a line when the AI is not sure', () => {
    expect(linkedProduct('七食品 てるたま', '', 279)).toBe('七食品 てるたま')
    expect(linkedProduct('カルビー 堅あげポ', 'カルビー 堅あげポテト', 159)).toBe('カルビー 堅あげポテト')
  })
  it('does not track clear non-products', () => {
    expect(linkedProduct('レジ袋 L', 'レジ袋', 5)).toBe('')
    expect(linkedProduct('値引', '', -50)).toBe('')
    expect(linkedProduct('おにぎり 鮭', 'おにぎり 鮭', -30)).toBe('')
    expect(linkedProduct('ポイント値引', '', 100)).toBe('')
    expect(linkedProduct('引き割り納豆', '', 98)).toBe('引き割り納豆')
  })
  it('waits for the AI answer', () => {
    expect(linkedProduct('バナナ', undefined, 198)).toBeUndefined()
  })
})

describe('grocery catalog', () => {
  it('has unique names and valid kinds', () => {
    const keys = GROCERY_CATALOG.map((c) => productKey(c.name))
    expect(new Set(keys).size).toBe(keys.length)
    for (const c of GROCERY_CATALOG) {
      expect(isItemKind(c.kind)).toBe(true)
      expect(c.reading).toMatch(/^[\u3041-\u309fー]+$/)
      expect(c.en).not.toBe('')
    }
  })
  it.each([
    ['国産 にんじん 3本', 'にんじん'],
    ['北海道産 玉ねぎ 3玉', '玉ねぎ'],
    ['牛乳 1000ml', '牛乳'],
    ['卵 10個入', '卵'],
    ['ニンジン', 'ニンジン'],
  ])('%s matches %s', (name, alias) => {
    expect(matchKeys(name)).toContain(productKey(alias))
  })
  it('makes katakana aliases from readings', () => {
    expect(toKatakana('にんじん')).toBe('ニンジン')
  })
})

describe('categorize', () => {
  it('uses user rules before the dictionary', () => {
    expect(
      categorize({ store: 'ローソン' }, [{ pattern: 'ローソン', categoryId: 'dining' }]),
    ).toBe('dining')
  })
  it('uses keywords when the store is unknown', () => {
    expect(categorize({ store: '山田薬局', text: '処方 調剤' })).toBe('medical')
  })
})
