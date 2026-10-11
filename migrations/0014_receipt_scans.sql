-- Scan collection for a local receipt model (see README "Collect scans for a local model").
-- Off by default. Only `npm run admin -- collect <email> on` turns it on for a user.
ALTER TABLE users ADD COLUMN collect_scans INTEGER NOT NULL DEFAULT 0;

-- A scanned photo and the app's first reading of it. The row waits here until the
-- companion tool downloads it, then that tool deletes it. The final expense is read from
-- expenses, expense_items, and expense_charges at download time, so later edits count.
-- image: the JPEG as base64 (the same image Google Vision read). draft: JSON of the first reading.
CREATE TABLE receipt_scans (
  expense_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  draft TEXT NOT NULL,
  engine TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
