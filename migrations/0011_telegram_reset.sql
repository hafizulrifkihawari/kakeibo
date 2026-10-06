-- Forgot password: a reset link goes to the user's linked Telegram chat.
-- Both tables store the SHA-256 of the token, like sessions.
ALTER TABLE users ADD COLUMN telegram_chat_id INTEGER;

CREATE TABLE telegram_links (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX password_resets_user ON password_resets(user_id, created_at);
