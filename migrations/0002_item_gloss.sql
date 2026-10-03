-- Furigana reading and English translation of receipt item names.
-- A shared cache: the same product name never goes to Workers AI twice.
CREATE TABLE item_gloss (
  name TEXT PRIMARY KEY,
  reading TEXT NOT NULL DEFAULT '',
  en TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
