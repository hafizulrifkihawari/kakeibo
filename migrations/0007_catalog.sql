-- A shared catalog of common products. Each user's products link to it, so that different spellings
-- ("人参", "にんじん", "国産 ニンジン 3本") become one product without asking the AI.
CREATE TABLE catalog (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  reading TEXT NOT NULL DEFAULT '',
  en TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other'
);

-- productKey() of every spelling of a catalog entry.
CREATE TABLE catalog_aliases (
  key TEXT PRIMARY KEY,
  catalog_id INTEGER NOT NULL REFERENCES catalog(id) ON DELETE CASCADE
);

ALTER TABLE products ADD COLUMN catalog_id INTEGER REFERENCES catalog(id);
