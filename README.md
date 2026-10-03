# Kakeibo — Japanese receipt expense tracker

A mobile web app (PWA) that reads Japanese receipts and tracks spending by day and month.

- **Stack:** TanStack Start (React, Router, Query) on Cloudflare Workers, with D1 (SQLite).
- **OCR:** Google Cloud Vision first. The app uses PP-OCRv5 (PaddleOCR) in the browser when the monthly Vision limit is reached, when Vision fails, or when the phone is offline. You can also paste text copied from Google Lens.
- **Auth:** email + password. Passwords are PBKDF2-SHA256 hashes (100,000 iterations, random salt). Session tokens are stored as SHA-256 hashes.
- **Item names:** each item shows its furigana reading `[…]` and an English translation `(…)`. Workers AI (free plan, no key) makes them once per name. D1 keeps them in the `item_gloss` table.
- **Prices:** each item links to a product. The AI corrects OCR errors in the name, so "力ルe 堅あけポ" and "カルビー 堅あげポ" become one product. The scan form compares each price with your last purchase. The Prices tab shows the price history and the cheapest store. Tap the 🔗 link on an item to change its product. Multi-pack lines ("2個 × 単158") compare by the price of one piece. Lines sold by weight ("298g × @198/100g") and packs with a size in the name ("300g", "350ml", "500ml×24本") compare by the price per 100 g or 100 ml, so different pack sizes of one product compare too.
- **Offline:** the service worker caches the app and the OCR models. Expenses saved offline wait in a queue and sync on reconnect.

## Local development

```sh
npm install                                   # also copies the ONNX Runtime WASM into public/ort
npx wrangler d1 migrations apply jp-expense --local
cp .dev.vars.example .dev.vars                # optional: add GOOGLE_VISION_API_KEY
npm run dev                                   # http://localhost:3000
npm test                                      # receipt parser unit tests
```

With no Vision key, every scan uses the on-device reader.

The service worker runs only in production builds. To test offline use, run `npm run build && npx vite preview`.

## Deploy (free tier)

1. Create the database, then put its id in `wrangler.jsonc` (`database_id`):
   ```sh
   npx wrangler d1 create jp-expense
   npx wrangler d1 migrations apply jp-expense --remote
   ```
2. Google Cloud: enable the Cloud Vision API, create an API key, and restrict the key to that API. Then run:
   ```sh
   npx wrangler secret put GOOGLE_VISION_API_KEY
   ```
3. Deploy with `npm run deploy`. Open the `kakeibo.<subdomain>.workers.dev` URL on your phone, then use "Add to Home Screen".

`VISION_MONTHLY_LIMIT` in `wrangler.jsonc` (default 950) is the point where the app stops calling Vision for the month. The Vision free tier is 1,000 images per month.

## Layout

| Path | What it holds |
|---|---|
| `shared/receipt-parser.ts` | Japanese receipt parser: store, date (incl. 令和), total (合計 vs お預り/お釣り), items |
| `shared/grocery-catalog.ts` | Seed list of common groceries (shared catalog). Run `npm run catalog` after an edit, then apply migrations |
| `shared/products.ts` | Product kinds and the product key that merges the same product |
| `src/server/products.ts` | Product linking, price stats, price history |
| `shared/categorizer.ts` | Category from user rules, then known chains, then item keywords |
| `src/server/` | Server functions, auth, Vision call with the quota counter |
| `src/client/ocr/paddle.ts` | PP-OCRv5 detection + recognition on onnxruntime-web |
| `src/routes/_app/` | Signed-in screens: Home, Calendar (month), Day, Add, Edit, Settings |
| `public/models/` | PP-OCRv5 mobile ONNX models (Apache-2.0, from PaddlePaddle on Hugging Face) |
| `public/sw.js` | Service worker |
