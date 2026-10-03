import type { ItemKind } from './products'

/**
 * Common grocery items in Japan: the seed of the shared product catalog.
 * Each line: name | reading | English | other spellings (comma-separated).
 * The reading and its katakana form are aliases too, so they do not need to be listed.
 * After an edit, run `npm run catalog` to write the seed migration.
 */
const DATA: Record<ItemKind, string> = {
  produce: `
キャベツ|きゃべつ|Cabbage
レタス|れたす|Lettuce
白菜|はくさい|Napa cabbage
大根|だいこん|Daikon radish
人参|にんじん|Carrot
玉ねぎ|たまねぎ|Onion|玉葱
じゃがいも|じゃがいも|Potato|馬鈴薯,男爵いも,メークイン
さつまいも|さつまいも|Sweet potato|薩摩芋
長ねぎ|ながねぎ|Japanese leek|長ネギ,白ねぎ,白ネギ
青ねぎ|あおねぎ|Green onion|青ネギ,万能ねぎ,小ねぎ,九条ねぎ,九条ネギ
ほうれん草|ほうれんそう|Spinach
小松菜|こまつな|Komatsuna greens
水菜|みずな|Mizuna greens
もやし|もやし|Bean sprouts|大豆もやし
きゅうり|きゅうり|Cucumber|胡瓜
トマト|とまと|Tomato
ミニトマト|みにとまと|Cherry tomato|プチトマト
なす|なす|Eggplant|茄子
ピーマン|ぴーまん|Green pepper
パプリカ|ぱぷりか|Bell pepper
ブロッコリー|ぶろっこりー|Broccoli
カリフラワー|かりふらわー|Cauliflower
かぼちゃ|かぼちゃ|Kabocha squash|南瓜
ごぼう|ごぼう|Burdock root|牛蒡
れんこん|れんこん|Lotus root|蓮根
しいたけ|しいたけ|Shiitake mushroom|椎茸,生しいたけ
しめじ|しめじ|Shimeji mushroom|ぶなしめじ
えのき|えのき|Enoki mushroom|えのき茸,えのきたけ
まいたけ|まいたけ|Maitake mushroom|舞茸
エリンギ|えりんぎ|King oyster mushroom
生姜|しょうが|Ginger
にんにく|にんにく|Garlic
大葉|おおば|Shiso leaves|青じそ
アボカド|あぼかど|Avocado
オクラ|おくら|Okra
ズッキーニ|ずっきーに|Zucchini
アスパラガス|あすぱらがす|Asparagus|アスパラ
枝豆|えだまめ|Edamame
春菊|しゅんぎく|Garland chrysanthemum
ニラ|にら|Garlic chives|韮
セロリ|せろり|Celery
豆苗|とうみょう|Pea shoots
かいわれ大根|かいわれだいこん|Radish sprouts|かいわれ
里芋|さといも|Taro
長いも|ながいも|Chinese yam|長芋,山芋,やまいも
こんにゃく|こんにゃく|Konjac|蒟蒻
バナナ|ばなな|Banana
りんご|りんご|Apple|林檎
みかん|みかん|Mandarin orange|蜜柑
オレンジ|おれんじ|Orange
いちご|いちご|Strawberry|苺
ぶどう|ぶどう|Grapes|葡萄
キウイ|きうい|Kiwi|キウイフルーツ
レモン|れもん|Lemon
グレープフルーツ|ぐれーぷふるーつ|Grapefruit
梨|なし|Japanese pear
柿|かき|Persimmon
桃|もも|Peach
メロン|めろん|Melon
すいか|すいか|Watermelon|西瓜
パイナップル|ぱいなっぷる|Pineapple`,
  meat_fish: `
豚バラ肉|ぶたばらにく|Pork belly|豚バラ,豚ばら肉,豚ばら,豚バラ薄切り
豚こま切れ|ぶたこまぎれ|Pork scraps|豚こま,豚小間切れ,豚肉こま切れ,豚こま切れ肉
豚ロース|ぶたろーす|Pork loin|豚ロース肉,豚ロース薄切り
豚肩ロース|ぶたかたろーす|Pork shoulder loin|豚肩ロース肉
豚ひき肉|ぶたひきにく|Ground pork|豚挽肉,豚ミンチ
鶏もも肉|とりももにく|Chicken thigh|鶏もも,若鶏もも肉,若鶏もも
鶏むね肉|とりむねにく|Chicken breast|鶏むね,若鶏むね肉,鶏胸肉
ささみ|ささみ|Chicken tenderloin|鶏ささみ,若鶏ささみ
手羽元|てばもと|Chicken drumettes|鶏手羽元,若鶏手羽元
手羽先|てばさき|Chicken wings|鶏手羽先,若鶏手羽先
鶏ひき肉|とりひきにく|Ground chicken|鶏挽肉,鶏ミンチ
牛こま切れ|ぎゅうこまぎれ|Beef scraps|牛こま,牛肉こま切れ
牛切り落とし|ぎゅうきりおとし|Beef slices|牛肉切り落とし,牛切落し
牛ひき肉|ぎゅうひきにく|Ground beef|牛挽肉,牛ミンチ
合いびき肉|あいびきにく|Ground beef and pork|合挽肉,合挽き肉,合びき肉
ベーコン|べーこん|Bacon
ハム|はむ|Ham|ロースハム
ウインナー|ういんなー|Sausages|ウィンナー,ソーセージ
生鮭|なまざけ|Fresh salmon|鮭切身,秋鮭
塩鮭|しおざけ|Salted salmon|甘塩鮭,塩さけ
サバ|さば|Mackerel|鯖,さば切身
塩サバ|しおさば|Salted mackerel
アジ|あじ|Horse mackerel|鯵,真あじ
ぶり|ぶり|Yellowtail|鰤,ぶり切身
まぐろ刺身|まぐろさしみ|Tuna sashimi|マグロ刺身,刺身まぐろ,まぐろ
サーモン刺身|さーもんさしみ|Salmon sashimi|サーモン
エビ|えび|Shrimp|海老,むきえび
イカ|いか|Squid|烏賊
タコ|たこ|Octopus|蛸,ゆでだこ
しらす|しらす|Whitebait|しらす干し
ちくわ|ちくわ|Chikuwa fish cake|竹輪
かまぼこ|かまぼこ|Kamaboko fish cake|蒲鉾
はんぺん|はんぺん|Hanpen fish cake
ツナ缶|つなかん|Canned tuna|ツナ,シーチキン
サバ缶|さばかん|Canned mackerel|さば水煮
明太子|めんたいこ|Spicy cod roe|辛子明太子
たらこ|たらこ|Cod roe
あさり|あさり|Clams`,
  dairy_eggs: `
卵|たまご|Eggs|玉子,鶏卵,生卵
牛乳|ぎゅうにゅう|Milk
低脂肪乳|ていしぼうにゅう|Low-fat milk
ヨーグルト|よーぐると|Yogurt|プレーンヨーグルト
飲むヨーグルト|のむよーぐると|Drinking yogurt
バター|ばたー|Butter
マーガリン|まーがりん|Margarine
チーズ|ちーず|Cheese|プロセスチーズ
スライスチーズ|すらいすちーず|Sliced cheese
とろけるチーズ|とろけるちーず|Melting cheese|ピザ用チーズ,シュレッドチーズ
粉チーズ|こなちーず|Grated cheese|パルメザンチーズ
生クリーム|なまくりーむ|Fresh cream`,
  tofu: `
豆腐|とうふ|Tofu
絹豆腐|きぬどうふ|Silken tofu|絹ごし豆腐,きぬ豆腐
木綿豆腐|もめんどうふ|Firm tofu|もめん豆腐
納豆|なっとう|Natto
油揚げ|あぶらあげ|Fried tofu|油あげ
厚揚げ|あつあげ|Thick fried tofu|厚あげ,生揚げ
豆乳|とうにゅう|Soy milk|調整豆乳,無調整豆乳`,
  bread_rice: `
米|こめ|Rice|お米,白米,精米
食パン|しょくぱん|Sliced bread
ロールパン|ろーるぱん|Bread rolls|バターロール
うどん|うどん|Udon noodles|ゆでうどん
そば|そば|Soba noodles|蕎麦,ゆでそば
中華麺|ちゅうかめん|Chinese noodles|生中華麺
焼きそば|やきそば|Yakisoba noodles|焼そば
パスタ|ぱすた|Pasta|スパゲッティ,スパゲティ
そうめん|そうめん|Somen noodles|素麺
カップ麺|かっぷめん|Cup noodles|カップラーメン
袋麺|ふくろめん|Instant noodles|インスタントラーメン
餅|もち|Rice cakes|切り餅,切餅
パン粉|ぱんこ|Breadcrumbs
小麦粉|こむぎこ|Flour|薄力粉
シリアル|しりある|Cereal|コーンフレーク,グラノーラ
オートミール|おーとみーる|Oatmeal`,
  snacks: `
ポテトチップス|ぽてとちっぷす|Potato chips|ポテチ
チョコレート|ちょこれーと|Chocolate|チョコ,板チョコ
クッキー|くっきー|Cookies|ビスケット
せんべい|せんべい|Rice crackers|煎餅
グミ|ぐみ|Gummies
ガム|がむ|Chewing gum
プリン|ぷりん|Pudding
ゼリー|ぜりー|Jelly
大福|だいふく|Daifuku
ナッツ|なっつ|Nuts|ミックスナッツ,アーモンド
飴|あめ|Candy|キャンディ,のど飴`,
  drinks: `
水|みず|Water|ミネラルウォーター,天然水
緑茶|りょくちゃ|Green tea|お茶
麦茶|むぎちゃ|Barley tea
ウーロン茶|うーろんちゃ|Oolong tea|烏龍茶
紅茶|こうちゃ|Black tea|ティーバッグ
缶コーヒー|かんこーひー|Canned coffee
インスタントコーヒー|いんすたんとこーひー|Instant coffee
コーヒー豆|こーひーまめ|Coffee beans|レギュラーコーヒー
オレンジジュース|おれんじじゅーす|Orange juice
野菜ジュース|やさいじゅーす|Vegetable juice
炭酸水|たんさんすい|Sparkling water
コーラ|こーら|Cola
スポーツドリンク|すぽーつどりんく|Sports drink
乳酸菌飲料|にゅうさんきんいんりょう|Probiotic drink`,
  alcohol: `
ビール|びーる|Beer
発泡酒|はっぽうしゅ|Low-malt beer
新ジャンル|しんじゃんる|New-genre beer|第三のビール
チューハイ|ちゅーはい|Chuhai|酎ハイ,サワー
ハイボール|はいぼーる|Highball
日本酒|にほんしゅ|Sake|清酒
ワイン|わいん|Wine
焼酎|しょうちゅう|Shochu
ウイスキー|ういすきー|Whisky|ウィスキー
梅酒|うめしゅ|Plum wine`,
  frozen: `
冷凍うどん|れいとううどん|Frozen udon
冷凍餃子|れいとうぎょうざ|Frozen gyoza
冷凍野菜|れいとうやさい|Frozen vegetables
冷凍チャーハン|れいとうちゃーはん|Frozen fried rice
冷凍唐揚げ|れいとうからあげ|Frozen fried chicken
冷凍ピザ|れいとうぴざ|Frozen pizza
アイスクリーム|あいすくりーむ|Ice cream|アイス
冷凍たこ焼き|れいとうたこやき|Frozen takoyaki`,
  ready_meals: `
弁当|べんとう|Bento|お弁当
おにぎり|おにぎり|Rice ball|おむすび
サンドイッチ|さんどいっち|Sandwich
唐揚げ|からあげ|Fried chicken|から揚げ
コロッケ|ころっけ|Croquette
寿司|すし|Sushi|にぎり寿司
天ぷら|てんぷら|Tempura|天麩羅
サラダ|さらだ|Salad
ポテトサラダ|ぽてとさらだ|Potato salad|ポテサラ
餃子|ぎょうざ|Gyoza|ギョーザ`,
  seasonings: `
醤油|しょうゆ|Soy sauce|こいくち醤油
味噌|みそ|Miso|合わせみそ
塩|しお|Salt|食塩
砂糖|さとう|Sugar|上白糖
酢|す|Vinegar|穀物酢,米酢
みりん|みりん|Mirin|本みりん
料理酒|りょうりしゅ|Cooking sake
サラダ油|さらだあぶら|Vegetable oil|キャノーラ油
ごま油|ごまあぶら|Sesame oil
オリーブオイル|おりーぶおいる|Olive oil
マヨネーズ|まよねーず|Mayonnaise
ケチャップ|けちゃっぷ|Ketchup|トマトケチャップ
ソース|そーす|Sauce|中濃ソース,ウスターソース
ポン酢|ぽんず|Ponzu
めんつゆ|めんつゆ|Noodle soup base
だしの素|だしのもと|Dashi stock|ほんだし,顆粒だし
コンソメ|こんそめ|Consommé
鶏がらスープの素|とりがらすーぷのもと|Chicken stock|鶏ガラスープ
カレールー|かれーるー|Curry roux|カレールウ
こしょう|こしょう|Pepper|胡椒
片栗粉|かたくりこ|Potato starch
ドレッシング|どれっしんぐ|Dressing
焼肉のたれ|やきにくのたれ|Yakiniku sauce|焼肉のタレ
わさび|わさび|Wasabi
からし|からし|Mustard|辛子
ジャム|じゃむ|Jam
はちみつ|はちみつ|Honey|蜂蜜`,
  household: `
トイレットペーパー|といれっとぺーぱー|Toilet paper
ティッシュ|てぃっしゅ|Tissues|ティッシュペーパー
キッチンペーパー|きっちんぺーぱー|Paper towels
ラップ|らっぷ|Plastic wrap|食品用ラップ
アルミホイル|あるみほいる|Aluminum foil
ゴミ袋|ごみぶくろ|Garbage bags|ごみ袋
食器用洗剤|しょっきようせんざい|Dish soap
洗濯洗剤|せんたくせんざい|Laundry detergent
柔軟剤|じゅうなんざい|Fabric softener
スポンジ|すぽんじ|Sponge
漂白剤|ひょうはくざい|Bleach
電池|でんち|Batteries|乾電池`,
  personal_care: `
シャンプー|しゃんぷー|Shampoo
コンディショナー|こんでぃしょなー|Conditioner|リンス
ボディソープ|ぼでぃそーぷ|Body wash
歯磨き粉|はみがきこ|Toothpaste
歯ブラシ|はぶらし|Toothbrush
ハンドソープ|はんどそーぷ|Hand soap
洗顔料|せんがんりょう|Face wash|洗顔フォーム
生理用品|せいりようひん|Sanitary pads
おむつ|おむつ|Diapers|紙おむつ
マスク|ますく|Face masks`,
  medicine: `
風邪薬|かぜぐすり|Cold medicine
鎮痛剤|ちんつうざい|Painkiller|頭痛薬
胃腸薬|いちょうやく|Stomach medicine
目薬|めぐすり|Eye drops
絆創膏|ばんそうこう|Bandages`,
  clothing: '',
  baby: '',
  pet: '',
  stationery: '',
  electronics: '',
  other: '',
}

export interface CatalogEntry {
  name: string
  reading: string
  en: string
  kind: ItemKind
  aliases: string[]
}

export const GROCERY_CATALOG: CatalogEntry[] = Object.entries(DATA).flatMap(([kind, block]) =>
  block
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, reading, en, aliases = ''] = line.split('|')
      return { name, reading, en, kind: kind as ItemKind, aliases: aliases.split(',').filter(Boolean) }
    }),
)
