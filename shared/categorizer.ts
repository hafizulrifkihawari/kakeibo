import type { CategoryId } from './categories'

export interface CategoryRule {
  pattern: string
  categoryId: CategoryId
}

interface KnownStore {
  name: string
  /** Patterns matched against NFKC-normalized text, without spaces. */
  match: RegExp
  category: CategoryId
}

// Order matters: the first match wins.
export const KNOWN_STORES: KnownStore[] = [
  { name: 'セブン-イレブン', match: /セブン[-ー‐]?イレブン|7[-‐]?ELEVEN|SEVEN[-‐]?ELEVEN/i, category: 'konbini' },
  { name: 'ファミリーマート', match: /ファミリーマート|FamilyMart|ファミマ/i, category: 'konbini' },
  { name: 'ローソン', match: /ローソン|LAWSON/i, category: 'konbini' },
  { name: 'ミニストップ', match: /ミニストップ|MINISTOP/i, category: 'konbini' },
  { name: 'デイリーヤマザキ', match: /デイリーヤマザキ/, category: 'konbini' },
  { name: 'セイコーマート', match: /セイコーマート/, category: 'konbini' },
  { name: 'NewDays', match: /NewDays|ニューデイズ/i, category: 'konbini' },
  { name: 'イオン', match: /イオン|AEON/i, category: 'groceries' },
  { name: 'まいばすけっと', match: /まいばすけっと/, category: 'groceries' },
  { name: '西友', match: /西友|SEIYU/i, category: 'groceries' },
  { name: 'ライフ', match: /ライフコーポレーション|ライフ(?!スタイル)|LIFE\s*CORPORATION/i, category: 'groceries' },
  { name: 'イトーヨーカドー', match: /イトーヨーカ[ドド]ー|Ito[-\s]?Yokado/i, category: 'groceries' },
  { name: '業務スーパー', match: /業務スーパー/, category: 'groceries' },
  { name: 'サミット', match: /サミットストア|サミット/, category: 'groceries' },
  { name: 'マルエツ', match: /マルエツ/, category: 'groceries' },
  { name: 'OKストア', match: /OKストア|オーケー/, category: 'groceries' },
  { name: 'ヤオコー', match: /ヤオコー/, category: 'groceries' },
  { name: 'コープ', match: /コープ|生協|CO-?OP/i, category: 'groceries' },
  { name: 'マツモトキヨシ', match: /マツモトキヨシ|マツキヨ/, category: 'daily' },
  { name: 'ウエルシア', match: /ウエルシア/, category: 'daily' },
  { name: 'ツルハドラッグ', match: /ツルハ/, category: 'daily' },
  { name: 'スギ薬局', match: /スギ薬局/, category: 'daily' },
  { name: 'ココカラファイン', match: /ココカラファイン/, category: 'daily' },
  { name: 'サンドラッグ', match: /サンドラッグ/, category: 'daily' },
  { name: 'ダイソー', match: /ダイソー|DAISO/i, category: 'daily' },
  { name: 'セリア', match: /セリア|Seria/i, category: 'daily' },
  { name: '無印良品', match: /無印良品|MUJI/i, category: 'daily' },
  { name: 'ニトリ', match: /ニトリ|NITORI/i, category: 'daily' },
  { name: 'ドン・キホーテ', match: /ドン[・.]?キホーテ|ドンキ/, category: 'daily' },
  { name: 'ユニクロ', match: /ユニクロ|UNIQLO/i, category: 'clothing' },
  { name: 'GU', match: /\bGU\b|ジーユー/, category: 'clothing' },
  { name: 'しまむら', match: /しまむら/, category: 'clothing' },
  { name: 'スターバックス', match: /スターバックス|STARBUCKS/i, category: 'dining' },
  { name: 'ドトール', match: /ドトール|DOUTOR/i, category: 'dining' },
  { name: 'タリーズ', match: /タリーズ|TULLY/i, category: 'dining' },
  { name: 'マクドナルド', match: /マクドナルド|McDonald/i, category: 'dining' },
  { name: 'すき家', match: /すき家/, category: 'dining' },
  { name: '吉野家', match: /吉野家/, category: 'dining' },
  { name: '松屋', match: /松屋(?!銀座)/, category: 'dining' },
  { name: 'サイゼリヤ', match: /サイゼリヤ/, category: 'dining' },
  { name: 'ガスト', match: /ガスト/, category: 'dining' },
  { name: 'CoCo壱番屋', match: /CoCo壱|ココイチ/i, category: 'dining' },
  { name: '丸亀製麺', match: /丸亀製麺/, category: 'dining' },
  { name: 'JR', match: /JR東日本|JR西日本|JR東海|旅客鉄道/, category: 'transport' },
  { name: '東京メトロ', match: /東京メトロ|Tokyo\s*Metro/i, category: 'transport' },
  { name: 'タクシー', match: /タクシー|TAXI/i, category: 'transport' },
  { name: 'ビックカメラ', match: /ビックカメラ/, category: 'entertainment' },
  { name: 'ヨドバシカメラ', match: /ヨドバシ/, category: 'entertainment' },
  { name: 'TSUTAYA', match: /TSUTAYA|ツタヤ/i, category: 'entertainment' },
]

// Item or receipt keywords, checked only when the store is unknown.
const KEYWORDS: [RegExp, CategoryId][] = [
  [/薬|処方|医院|クリニック|病院|歯科|調剤/, 'medical'],
  [/乗車|運賃|切符|乗車券|定期|IC|Suica|PASMO|駐車|ガソリン|給油/i, 'transport'],
  [/電気|ガス料金|水道|電話料金|通信料/, 'utilities'],
  [/映画|チケット|入場|カラオケ|ゲーム|書籍|書店|雑誌|コミック/, 'entertainment'],
  [/シャツ|パンツ|靴|ソックス|ジャケット|衣料/, 'clothing'],
  [/ランチ|定食|ラーメン|ドリンク|コーヒー|珈琲|生ビール|お通し|席料|テイクアウト|店内/, 'dining'],
  [/洗剤|ティッシュ|トイレット|シャンプー|歯ブラシ|電池|ゴミ袋/, 'daily'],
  [/牛乳|野菜|玉子|卵|豆腐|納豆|パン|肉|豚|鶏|牛|魚|米|弁当|おにぎり|惣菜|果物|バナナ|りんご|キャベツ|もやし|ヨーグルト/, 'groceries'],
  // Food and drink makers, and the reduced 8% tax rate that applies only to food.
  [/食品|サントリー|カルビー|明治|森永|ロッテ|グリコ|日清|伊藤園|キリン|アサヒ|コカ[・.]?コーラ|ハウス|味の素|キユーピー|ブルボン|軽減税率/, 'groceries'],
]

function compact(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, '')
}

export function findKnownStore(text: string): KnownStore | undefined {
  const t = compact(text)
  return KNOWN_STORES.find((s) => s.match.test(t))
}

export function categorize(
  input: { store?: string; text?: string; items?: { name: string }[] },
  rules: CategoryRule[] = [],
): CategoryId {
  const store = compact(input.store ?? '')

  // 1. The user's own corrections.
  if (store) {
    const rule = rules.find((r) => r.pattern && store.includes(compact(r.pattern)))
    if (rule) return rule.categoryId
  }

  // 2. Known chains, by the store name first and then by the whole receipt.
  const known = (store && findKnownStore(store)) || (input.text && findKnownStore(input.text))
  if (known) return known.category

  // 3. Keywords in the items, then anywhere in the receipt.
  const haystacks = [
    (input.items ?? []).map((i) => i.name).join('\n'),
    input.text ?? '',
  ]
  for (const hay of haystacks) {
    if (!hay) continue
    const t = hay.normalize('NFKC')
    // Count hits so that one stray keyword does not win.
    const scores = new Map<CategoryId, number>()
    for (const [re, cat] of KEYWORDS) {
      const hits = t.match(new RegExp(re.source, re.flags + 'g'))?.length ?? 0
      if (hits) scores.set(cat, (scores.get(cat) ?? 0) + hits)
    }
    let best: CategoryId | undefined
    let bestScore = 0
    for (const [cat, score] of scores) {
      if (score > bestScore) {
        best = cat
        bestScore = score
      }
    }
    if (best) return best
  }

  return 'other'
}
