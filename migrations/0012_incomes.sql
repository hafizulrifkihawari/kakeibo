-- Money in: salary, part-time pay, gifts. id is a client-generated UUID, like expenses.
CREATE TABLE incomes (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'other',
  note TEXT,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX incomes_user_date ON incomes(user_id, date);
