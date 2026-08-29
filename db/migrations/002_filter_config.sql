CREATE TABLE IF NOT EXISTS filter_config (
  track TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
