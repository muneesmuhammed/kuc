DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  position TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  joining_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  photo_blob_key TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE player_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL UNIQUE REFERENCES players(id),
  matches_played INTEGER NOT NULL DEFAULT 0,
  goals INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0,
  red_cards INTEGER NOT NULL DEFAULT 0,
  performance REAL NOT NULL DEFAULT 0,
  attendance REAL NOT NULL DEFAULT 0,
  custom_stats TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id),
  week_start TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'unpaid',
  paid_date TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX payments_player_week ON payments (player_id, week_start);
--> statement-breakpoint
CREATE TABLE committees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE committee_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  committee_id INTEGER NOT NULL REFERENCES committees(id),
  player_id INTEGER NOT NULL REFERENCES players(id),
  position TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  award_type TEXT NOT NULL,
  player_id INTEGER NOT NULL REFERENCES players(id),
  description TEXT NOT NULL DEFAULT '',
  detail_stats TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX awards_year_type ON awards (year, award_type);
--> statement-breakpoint
CREATE TABLE admin_auth (
  id INTEGER PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE admin_sessions (
  token TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
