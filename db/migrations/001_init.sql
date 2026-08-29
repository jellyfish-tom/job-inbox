CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  track TEXT NOT NULL,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  salary_raw TEXT,
  hard_required TEXT NOT NULL DEFAULT '[]',
  hard_nice TEXT NOT NULL DEFAULT '[]',
  soft_required TEXT NOT NULL DEFAULT '[]',
  soft_nice TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL,
  posted_at TEXT,
  status TEXT NOT NULL,
  applied_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

CREATE TABLE refresh_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  fetched INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  watermark TEXT
);
