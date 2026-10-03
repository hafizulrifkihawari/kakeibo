-- A normalized list of products for each user, so that prices can be compared over time.
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- productKey(name): the same product always gets the same key.
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  en TEXT NOT NULL DEFAULT '',
  reading TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other',
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, key)
);

ALTER TABLE expense_items ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX expense_items_product ON expense_items(product_id);

-- The AI also gives the corrected product name and its kind for each scanned name.
-- Rows without a product were made before this column existed; the app asks the AI again for them.
ALTER TABLE item_gloss ADD COLUMN product TEXT;
ALTER TABLE item_gloss ADD COLUMN kind TEXT;
