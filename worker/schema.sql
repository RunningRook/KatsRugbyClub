-- Kats Rugby Club check-in app — D1 schema
-- Apply with: wrangler d1 execute kats-checkin --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS roster (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id         TEXT PRIMARY KEY,
  opponent   TEXT NOT NULL,
  date       TEXT NOT NULL,   -- YYYY-MM-DD
  time       TEXT,            -- HH:MM (24h), optional
  location   TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS availability (
  id           TEXT PRIMARY KEY,  -- "<gameId>__<playerId>"
  game_id      TEXT NOT NULL,
  player_id    TEXT NOT NULL,
  player_name  TEXT NOT NULL,
  status       TEXT NOT NULL,     -- 'in' | 'maybe' | 'out'
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Admin PIN sessions: a successful PIN check mints a bearer token here.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_availability_game ON availability(game_id);
