-- Monthly spending limits. scope is 'total' or a category id. amount 0 means no limit.
-- The same limits apply to every month.
CREATE TABLE budgets (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  amount INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, scope)
);
