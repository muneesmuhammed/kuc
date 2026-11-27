CREATE TABLE editor_auth (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE editor_sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
