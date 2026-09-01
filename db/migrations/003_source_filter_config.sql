CREATE TABLE IF NOT EXISTS source_filter_config (
  source TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
