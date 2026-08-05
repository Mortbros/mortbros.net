import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import { copyFile, mkdir, readdir, rename, unlink, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin } from 'vite'

const SCHEMA = `
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
`

const DEFAULT_SETTINGS = `
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('frecency_halflife_days',    '7'),
  ('suggestion_threshold',      '3'),
  ('suggestion_min_length',     '4'),
  ('token_usage_max_rows',      '10000'),
  ('autocomplete_max_results',  '5');
`

const SUGGESTION_TYPES = `
INSERT OR IGNORE INTO mapping_type (id, name) VALUES
  ('exercise', 'Exercise'),
  ('game', 'Game'),
  ('music', 'Music'),
  ('phase', 'Phase');
`

/** SQL literal for a sql.js value: NULL, number, blob → x'..', else quoted text. */
function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (v instanceof Uint8Array) return `x'${Buffer.from(v).toString('hex')}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

/** Full schema + data as executable SQL — restorable via `sqlite3 new.db < dump.sql`. */
function dumpSql(db: import('sql.js').Database): string {
  const out: string[] = [
    '-- Reflection app SQLite dump',
    `-- Generated ${new Date().toISOString()}`,
    'PRAGMA foreign_keys=OFF;',
    'BEGIN TRANSACTION;',
  ]
  const objects = db.exec(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END"
  )
  const rows = (objects[0]?.values ?? []) as [string, string, string][]

  for (const [type, name, sql] of rows) {
    if (type !== 'table') continue
    out.push('', `DROP TABLE IF EXISTS "${name}";`, `${sql};`)
    const data = db.exec(`SELECT * FROM "${name}"`)
    if (!data[0]) continue
    const cols = data[0].columns.map(c => `"${c}"`).join(', ')
    for (const row of data[0].values) {
      out.push(`INSERT INTO "${name}" (${cols}) VALUES (${row.map(sqlLiteral).join(', ')});`)
    }
  }
  // Indexes/triggers/views after the data
  for (const [type, , sql] of rows) {
    if (type !== 'table') out.push('', `${sql};`)
  }
  out.push('', 'COMMIT;', '')
  return out.join('\n')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => resolve(raw))
  })
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function sqlitePlugin(dbPath: string): Plugin {
  let db: import('sql.js').Database | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  let writing = false
  let writeAgain = false

  // ── Daily backups ───────────────────────────────────────────────────────────
  // Snapshots the on-disk file BEFORE the first write of each day, so each
  // snapshot is the last known state prior to that day's edits — the useful
  // restore point after a bad import. Copying the existing file is both
  // cheaper than db.export() and semantically what we want.

  const BACKUP_KEEP = 30
  const BACKUP_RE = /-\d{4}-\d{2}-\d{2}\.db$/
  let lastBackupDate: string | null = null

  async function maybeBackup(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    if (lastBackupDate === today) return
    lastBackupDate = today // set first: a failure shouldn't retry on every write
    if (!existsSync(dbPath)) return // nothing on disk yet (first run)

    const dir = join(dirname(dbPath), 'backups')
    const stem = basename(dbPath).replace(/\.db$/, '')
    const dest = join(dir, `${stem}-${today}.db`)
    try {
      await mkdir(dir, { recursive: true })
      if (existsSync(dest)) return // already snapshotted today
      await copyFile(dbPath, dest)

      // Prune oldest — ISO dates sort lexically, so filename order is date order
      const files = (await readdir(dir)).filter(f => f.startsWith(stem) && BACKUP_RE.test(f)).sort()
      for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
        await unlink(join(dir, f))
      }
      console.log(`[sqlite] backup ${dest}`)
    } catch (e) {
      console.error('[sqlite] backup failed:', e)
    }
  }

  /** Synchronous full write — only for process-exit handlers, where async can't finish. */
  function writeDbSync() {
    if (!db) return
    writeFileSync(dbPath, Buffer.from(db.export()))
  }

  /**
   * Async full write. db.export() is unavoidable (sql.js has no incremental
   * persistence), but writing off the event loop keeps API requests responsive
   * — important on slow/synced storage like OneDrive.
   *
   * Writes to a temp file then renames, so a crash mid-write can't corrupt the
   * DB. Overlapping calls coalesce into one trailing write.
   */
  async function writeDbAsync(): Promise<void> {
    if (!db) return
    if (writing) { writeAgain = true; return }
    writing = true
    try {
      await maybeBackup() // snapshots pre-write state on the day's first flush
      const buf = Buffer.from(db.export())
      const tmp = `${dbPath}.tmp`
      await writeFile(tmp, buf)
      await rename(tmp, dbPath)
    } catch (e) {
      console.error('[sqlite] write failed:', e)
    } finally {
      writing = false
      if (writeAgain) { writeAgain = false; void writeDbAsync() }
    }
  }

  // Batches rapid writes into a single disk write after a short idle period.
  function scheduleFlush() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => { flushTimer = null; void writeDbAsync() }, 500)
  }

  function flushImmediate() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    writeDbSync()
  }

  async function init() {
    // sql.js CJS module — handle default export interop
    const mod = await import('sql.js')
    const initSqlJs: typeof import('sql.js').default = (mod as any).default ?? mod

    const SQL = await initSqlJs()

    if (existsSync(dbPath)) {
      if (statSync(dbPath).isDirectory()) {
        throw new Error(
          `[sqlite] DB path points to a directory, not a file: ${dbPath}\n` +
          `Set the DB_PATH env var to a .db file path (it will be created if missing).`
        )
      }
      db = new SQL.Database(readFileSync(dbPath))
    } else {
      db = new SQL.Database()
    }

    db.run(SCHEMA)
    db.run(SUGGESTION_TYPES)
    db.run(DEFAULT_SETTINGS)
    // Migrations for existing DBs
    try { db.run('ALTER TABLE mapping_instance ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1') } catch {}
    try { db.run('ALTER TABLE list_values ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1') } catch {}
    try { db.run("ALTER TABLE mapping_instance ADD COLUMN grp TEXT NOT NULL DEFAULT 'main'") } catch {}
    try { db.run('ALTER TABLE form_history ADD COLUMN responses TEXT') } catch {}
    try { db.run('ALTER TABLE form_history ADD COLUMN schema_version_id INTEGER') } catch {}
    try { db.run('ALTER TABLE form_history ADD COLUMN output TEXT') } catch {}
    try { db.run('ALTER TABLE form_history ADD COLUMN saved_at TEXT') } catch {}
    // Migrate defaultN:true → emptyValue:"N" in form_schema_field config
    try {
      const rows = db.exec("SELECT id, config FROM form_schema_field WHERE config LIKE '%defaultN%'")
      if (rows[0]) {
        for (const [id, cfg] of rows[0].values as [number, string][]) {
          const parsed = JSON.parse(cfg)
          if (parsed.defaultN) {
            delete parsed.defaultN
            parsed.emptyValue = 'N'
            db.run('UPDATE form_schema_field SET config = ? WHERE id = ?', [JSON.stringify(parsed), id])
          }
        }
      }
    } catch {}
    // Migrate: ensure bathe/wake/sleep are all in row_group 1
    try {
      db.run(`UPDATE form_schema_field SET row_group = 1 WHERE field_key IN ('bathe','wake','sleep') AND row_group IS NULL`)
    } catch {}
    // Seed 2025 schema if no schema versions exist
    const existing = db.exec('SELECT COUNT(*) as n FROM form_schema_version')
    if ((existing[0]?.values[0]?.[0] as number) === 0) {
      db.run(`INSERT INTO form_schema_version (effective_from, note) VALUES ('2025-01-01', '2025 reflection')`)
      const vid = (db.exec('SELECT last_insert_rowid()')[0].values[0][0]) as number
      const fields: [string, string, string, string | null, number | null, number][] = [
        ['date',      'Date',           'date',             null,                                          null, 10],
        ['bathe',     'Bathe',          'yes_no',           null,                                          1,    20],
        ['wake',      'Wake',           'time',             null,                                          1,    30],
        ['sleep',     'Sleep',          'time',             '{"defaultToFuture":true,"futureMinutes":25}', 1,    40],
        ['nap',       'Nap',            'float',            '{"max":10}',                                  2,    50],
        ['worked',    'Worked',         'float',            '{"max":24}',                                  2,    60],
        ['stress',    'Stress',         'float',            '{"max":10,"required":true}',                  3,    70],
        ['tired',     'Tired',          'float',            '{"max":10,"required":true}',                  3,    80],
        ['game',      'Game',           'autocomplete_list','{"listTypeId":"game","emptyValue":"N"}',       null, 90],
        ['music',     'Music',          'autocomplete_list','{"listTypeId":"music","emptyValue":"N","required":true}', null, 100],
        ['grateful',  'Grateful',       'list',             '{"required":true}',                           null, 110],
        ['learn',     'Learn (Ctrl+Y)', 'list',             '{"required":true}',                           null, 120],
        ['exercise',  'Exercise',       'autocomplete_list','{"listTypeId":"exercise","emptyValue":"N","required":true}', null, 130],
        ['remember',  'Remember',       'float',            '{"max":10,"required":true}',                  null, 140],
        ['dayRating', 'Day rating',     'float',            '{"max":10,"required":true}',                  null, 150],
        ['feeling',   'Feeling',        'int',              '{"max":100,"required":true}',                 null, 160],
        ['why',       'Why',            'string',           '{"required":true}',                           null, 170],
        ['phase',     'Phase',          'autocomplete_list','{"listTypeId":"phase","required":true,"autoSelect":false}', null, 180],
        ['happened',  'Happened',       'shortcode_text',   '{"group":"main","required":true}',            null, 190],
        ['time',      'Time',           'time_display',     null,                                          null, 200],
        ['dayName',   'Day name',       'string',           null,                                          null, 210],
      ]
      for (const [key, label, type, config, rowGroup, sortOrder] of fields) {
        db.run(
          'INSERT INTO form_schema_field (version_id, field_key, label, field_type, config, row_group, sort_order) VALUES (?,?,?,?,?,?,?)',
          [vid, key, label, type, config, rowGroup, sortOrder]
        )
      }
    }
    // Migrate form_history legacy fixed columns → responses JSON, then drop them
    try {
      db.exec('SELECT bathe FROM form_history LIMIT 0') // throws if already dropped
      db.run(`
        UPDATE form_history SET
          responses = json_object(
            'date',      date,
            'bathe',     bathe,
            'wake',      wake,
            'sleep',     sleep,
            'nap',       nap,
            'worked',    worked,
            'stress',    stress,
            'tired',     tired,
            'game',      game,
            'music',     music,
            'grateful',  grateful,
            'learn',     learn,
            'exercise',  exercise,
            'remember',  remember,
            'dayRating', day_rating,
            'feeling',   feeling,
            'why',       why,
            'phase',     phase,
            'happened',  happened,
            'time',      time,
            'dayName',   day_name
          ),
          schema_version_id = (SELECT id FROM form_schema_version WHERE effective_from = '2025-01-01')
        WHERE responses IS NULL`)
      for (const col of [
        'bathe','wake','sleep','nap','worked','stress','tired',
        'game','music','grateful','learn','exercise','remember',
        'day_rating','feeling','why','phase','time','happened','day_name',
      ]) {
        db.run(`ALTER TABLE form_history DROP COLUMN ${col}`)
      }
      console.log('[sqlite] migrated form_history legacy columns to responses JSON')
    } catch {
      // columns already dropped — nothing to do
    }

    writeDbSync()
    console.log(`[sqlite] using ${dbPath}`)
  }

  // Ensure in-flight debounced writes land before the process exits
  process.on('exit', flushImmediate)
  process.on('SIGINT', () => { flushImmediate(); process.exit(0) })
  process.on('SIGTERM', () => { flushImmediate(); process.exit(0) })

  return {
    name: 'vite-plugin-sqlite',

    async configureServer(server) {
      await init()

      server.middlewares.use('/api/db', async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!db) { json(res, { error: 'DB not ready' }, 503); return }

        // GET /api/db/dump — full SQL dump for download
        if (req.method === 'GET' && (req.url ?? '').replace(/\/$/, '') === '/dump') {
          try {
            res.writeHead(200, { 'Content-Type': 'application/sql; charset=utf-8' })
            res.end(dumpSql(db))
          } catch (e: any) {
            json(res, { error: e.message }, 500)
          }
          return
        }

        if (req.method !== 'POST') { next(); return }

        let body: { sql: string; params?: unknown[] }
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          json(res, { error: 'Invalid JSON' }, 400)
          return
        }

        const route = (req.url ?? '').replace(/\/$/, '')

        try {
          if (route === '/query') {
            json(res, db.exec(body.sql, body.params as any))
          } else if (route === '/exec') {
            db.run(body.sql, body.params as any)
            // Return immediately; flush to disk after a short debounce.
            // Rapid writes (e.g. token_usage inserts) share one disk write.
            scheduleFlush()
            json(res, { ok: true })
          } else if (route === '/batch') {
            // Many statements in ONE round-trip and ONE transaction — bulk
            // imports were previously one HTTP request per row.
            const stmts = (body as unknown as { statements?: { sql: string; params?: unknown[] }[] }).statements ?? []
            let applied = 0
            const failed: { index: number; error: string }[] = []
            db.run('BEGIN')
            try {
              for (let i = 0; i < stmts.length; i++) {
                try {
                  db.run(stmts[i].sql, stmts[i].params as any)
                  applied++
                } catch (e: any) {
                  // Skip bad rows (e.g. duplicates) without losing the batch
                  failed.push({ index: i, error: e.message })
                }
              }
              db.run('COMMIT')
            } catch (e) {
              db.run('ROLLBACK')
              throw e
            }
            scheduleFlush()
            json(res, { ok: true, applied, failed })
          } else {
            next()
          }
        } catch (e: any) {
          json(res, { error: e.message }, 400)
        }
      })
    },
  }
}
