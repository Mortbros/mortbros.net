# Reflection App

A personal daily reflection tracker built with Vue 3 + Vuetify. Fill in your day using typed shorthand codes that automatically expand to full text, then copy the formatted output to the clipboard.

---

## Features

### Daily Form
Fields covered: date, bathe, wake/sleep time, nap, hours worked, stress, tiredness, games, music, gratitude, learning, exercise, memory, day rating, feeling (1–10), why, phase, what happened, day name.

Keyboard-first navigation — Tab/Enter moves forward, Shift+Tab moves back, no mouse required.

### Shorthand Expansion
Type abbreviated shortcodes in the **Happened** field and press Space to expand them inline:

```
idmt     → Izzy drove me to
adwmj    → Ate dinner with Mum, Jen
```

Expansion is powered by a pattern-matching engine that supports:

| Syntax | Meaning |
|--------|---------|
| `literal` | Exact string match (e.g. `woke`) |
| `<typeId>` | Matches one list value of that type |
| `<typeId,>` | Matches one or more list values (comma-separated) |
| `/regex/flags` | ECMAScript regex match |

Multiple type slots of the same type in one mapping are resolved positionally, so `<person>d<person>h` unambiguously maps the first abbreviation to the first `<person>` slot.

### Autocomplete Dropdown
While typing in the Happened field a cursor-anchored dropdown surfaces suggestions ranked by:

1. **Exact pattern match** — the full typed token resolves a pattern (e.g. `idmt`)
2. **Literal name prefix** — a non-pattern mapping whose name starts with what you typed
3. **Pattern prefix candidate** — a pattern mapping where the first slot's abbreviation matches your prefix; further slots are resolved greedily as you type more letters
4. **Frecency fallback** — historical entries whose raw shortcode started with the same prefix, scored by half-life decay so recent use ranks higher

Partial pattern suggestions (where not all slots can yet be resolved) are shown as dimmed _hints_ with a "keep typing" badge — they inform without inserting bad text.

Accepting a suggestion with Tab or Enter records it in the frecency history so it ranks higher next time.

### Settings
Accessible via the ⚙ icon on the form. Tabs:

| Tab | Purpose |
|-----|---------|
| **Mappings** | CRUD for shorthand rules; toggle enabled/disabled |
| **List Values** | CRUD for type entries (persons, places, transports, …); sub-tabs per type |
| **Types** | Create and rename mapping types; rename propagates to all mappings |
| **History** | View and delete past form submissions |
| **Conflicts** | Scan for ambiguous inputs — any concrete token matched by more than one mapping, including pattern-vs-pattern conflicts |
| **Test** | Type any string and see exactly which mappings match and what they expand to |
| **Suggestions** | Analyse form history for frequently-typed tokens that have no mapping yet |
| **Frecency** | Tune autocomplete: half-life, max results, suggestion thresholds |

All settings writes are debounced to disk (500 ms) so rapid edits don't each trigger a full database serialisation.

---

## Architecture

```
src/
  pages/
    index.vue          # Daily form page (route /)
    settings.vue       # Settings page (route /settings)
    help.vue           # Rendered Markdown docs (route /help)
  components/
    DailyTrackingForm.vue    # Renders the active schema's fields
    ShortcodeCheatSheet.vue  # Ctrl+/ shortcode reference overlay
    fields/
      PatternTextField.vue   # shortcode_text — autocomplete + pattern expansion
      CommaListField.vue     # autocomplete_list — chips with suggestions
      PlainListField.vue     # list — comma-separated text
      NumberField.vue        # float and int
      StringField.vue / YesNoField.vue
      DateField.vue / TimeField.vue / TimeDisplay.vue
  lib/
    db.ts              # All database access (fetch → Vite middleware)
    patternMatcher.ts  # Token parsing and expansion engine
    formSchema.ts      # YAML ⇄ form_schema_field rows
    frecency.ts        # Half-life scoring for token_usage rows
    fieldUtils.ts      # Focus, date and field-navigation helpers
  router/
    index.ts

vite-plugin-sqlite.ts  # Vite dev server middleware — hosts SQLite via sql.js
schema.sql             # Reference schema (no personal data)
mappings.db            # Runtime database (gitignored — kept in OneDrive)
```

### Database
The app uses [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) running **server-side inside the Vite dev plugin**. The browser never touches the `.db` file directly — all queries go through a small HTTP API:

| Endpoint | Purpose |
|---|---|
| `POST /api/db/query` | Read |
| `POST /api/db/exec` | Single write |
| `POST /api/db/batch` | Many statements in one transaction and round-trip — use for bulk writes |
| `GET /api/db/dump` | Full schema + data as executable SQL |

Database location defaults to `C:\Users\sandr\OneDrive\Personal\Reflection\reflection-app-data\mappings.db` (OneDrive, so it syncs across machines). Override with the `DB_PATH` environment variable — needed on Linux/Termux:

```bash
DB_PATH=$HOME/mappings.db npm run dev
```

Writes are debounced: the HTTP response returns immediately after the in-memory `db.run()`; the disk write fires 500 ms later, asynchronously so it never blocks the event loop, writing to a temp file and renaming so a crash mid-write can't corrupt the database. Process exit / SIGINT flush synchronously.

**Backups:** before the first write each day the current file is copied to `backups/mappings-YYYY-MM-DD.db` beside the database, keeping the last 30. Each snapshot is the state *before* that day's edits.

#### Schema

Full DDL in [`schema.sql`](schema.sql); per-column reference in [`docs/database.md`](docs/database.md).

```sql
mapping_type        (id PK, name)
list_values         (id PK, value, type_id, abbreviation UNIQUE per type, enabled)
mapping_instance    (id PK, name UNIQUE, expansion, enabled, grp)
token_usage         (id PK, raw_input, mapping_name, expansion, used_at)
app_settings        (key PK, value)
form_history        (date PK, output, saved_at, responses JSON, schema_version_id)
form_schema_version (id PK, effective_from UNIQUE, note)
form_schema_field   (id PK, version_id, field_key, label, field_type, config JSON, row_group, sort_order)
```

`form_history.responses` is a JSON object keyed by `field_key` — the legacy fixed
columns were migrated into it and dropped.

---

## Getting Started

### Prerequisites
- Node.js ≥ 20.19 or ≥ 22.12

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

The database is created automatically on first run at the path configured in `vite.config.ts`. To change the location edit the `dbPath` argument passed to `sqlitePlugin(dbPath)`.

### Import existing data
Use the CSV import buttons in **Settings → Mappings**, **Settings → List Values**, and **Settings → Types** to bulk-load data without writing SQL. Each import is idempotent (duplicate values are silently skipped).

---

## Shorthand Reference

### Mapping name syntax

```
idmt              literal — matches exactly "idmt"
<person>dmt       person slot + literal suffix
<person><transport><place>   three slots in sequence
<person,>         one or more persons (comma-separated in expansion)
/^\d{4}$/         regex match
```

### Expansion syntax

```
<person>          replaced with the matched list value
<person,>         replaced with matched values joined by ", "
```

Type slot references in the expansion are consumed positionally — the first `<person>` in the expansion gets the first matched person, the second gets the second, etc.

### Example mappings

| Name | Expansion | Example input → output |
|------|-----------|------------------------|
| `<person>dmt<place>` | `<person> drove me to <place>` | `idmth` → `Izzy drove me to home` |
| `adw<person,>` | `Ate dinner with <person,>` | `adwmj` → `Ate dinner with Mum, Jen` |
| `woke` | `Woke up` | `woke` → `Woke up` |

---

## Development

```bash
npm run type-check    # TypeScript check (vue-tsc)
npm run build         # Production build
```

The database is never committed — `mappings.db` and `/public/mappings.db` are gitignored. A reference [`schema.sql`](schema.sql) (structure only, no personal data) is committed for documentation; regenerate it from the `SCHEMA` constant in `vite-plugin-sqlite.ts` if you change the tables.
