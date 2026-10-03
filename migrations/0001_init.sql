-- Users and sessions. Passwords are PBKDF2-SHA256 hashes; session tokens are stored as SHA-256.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- id is a client-generated UUID, so offline saves replay without duplicates.
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  store TEXT,
  category_id TEXT NOT NULL DEFAULT 'other',
  note TEXT,
  ocr_engine TEXT NOT NULL DEFAULT 'manual',
  raw_text TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX expenses_user_date ON expenses(user_id, date);

CREATE TABLE expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX expense_items_expense ON expense_items(expense_id);

CREATE TABLE category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  category_id TEXT NOT NULL,
  UNIQUE (user_id, pattern)
);

CREATE TABLE ocr_usage (
  month TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
