-- Reference schema for the reflection app database.
--
-- The source of truth is the SCHEMA constant in vite-plugin-sqlite.ts, which
-- creates these tables on first run. This file is committed for reference only
-- (the .db itself is gitignored — it holds personal data). Regenerate this file
-- after changing SCHEMA there.

CREATE TABLE IF NOT EXISTS mapping_type (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS list_values (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL,
  type_id TEXT NOT NULL,
  abbreviation TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(value, type_id),
  UNIQUE(abbreviation, type_id)
);
CREATE TABLE IF NOT EXISTS mapping_instance (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  expansion TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  grp TEXT NOT NULL DEFAULT 'main'
);
CREATE TABLE IF NOT EXISTS token_usage (
  id       INTEGER PRIMARY KEY,
  raw_input    TEXT NOT NULL,
  mapping_name TEXT,
  expansion    TEXT NOT NULL,
  used_at      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS form_history (
  date              TEXT PRIMARY KEY,
  output            TEXT,
  saved_at          TEXT,
  responses         TEXT,
  schema_version_id INTEGER
);
CREATE TABLE IF NOT EXISTS form_schema_version (
  id             INTEGER PRIMARY KEY,
  effective_from TEXT NOT NULL UNIQUE,
  note           TEXT
);
CREATE TABLE IF NOT EXISTS form_schema_field (
  id         INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES form_schema_version(id),
  field_key  TEXT NOT NULL,
  label      TEXT NOT NULL,
  field_type TEXT NOT NULL,
  config     TEXT,
  row_group  INTEGER,
  sort_order INTEGER NOT NULL
);

-- Seeded mapping types
INSERT OR IGNORE INTO mapping_type (id, name) VALUES
  ('exercise', 'Exercise'),
  ('game', 'Game'),
  ('music', 'Music'),
  ('phase', 'Phase');

-- Default app settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('frecency_halflife_days',    '7'),
  ('suggestion_threshold',      '3'),
  ('suggestion_min_length',     '4'),
  ('token_usage_max_rows',      '10000'),
  ('autocomplete_max_results',  '5');
