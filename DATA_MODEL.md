# MikaVN Library Data Model

SQLite is the source of truth for core data. Browser mock mode may use localStorage, but production data must live in SQLite.

## App Data Directory

Current app data layout:

```text
%APPDATA%/MikaVN Library/
  mikavn.db
  images/
  cache/
  save-backups/
  archive-import-protection/
  pending-restore/
  database-restore-protection/
```

Target layout from the brief:

```text
%APPDATA%/<app-name>/
  database.sqlite
  config.json
  covers/
  backgrounds/
  thumbnails/
  metadata-cache/
  saves/backups/
  exports/
  logs/
  plugins/
  themes/
```

Migration note: keep compatibility with existing `mikavn.db`. Do not rename the database without a migration and backup story.

## Current Tables

Implemented today:

- `games`
- `play_sessions`
- `library_roots`
- `app_settings`
- `metadata_cache`
- `metadata_match_jobs`
- `metadata_match_results`
- `tasks`
- `task_logs`
- `scan_task_results`
- `launch_profiles`
- `field_locks`
- `metadata_sources`
- `external_ids`
- `collections`
- `collection_games`
- `game_assets`
- `tags`
- `game_tags`
- `saved_searches`
- `save_paths`
- `save_backups`

Current migrations:

- Base schema uses `CREATE TABLE IF NOT EXISTS`.
- Versioned migrations use `PRAGMA user_version`.
- Version 1 adds save tables.
- Version 2 adds the general `tasks` table.
- Version 3 adds scanner task result storage.
- Version 4 adds launch profiles and play session launch fields.
- Version 5 adds path health fields on `games`.
- Version 6 adds metadata field locks.
- Version 7 adds task retry metadata and task logs.
- Version 8 adds metadata source registration and normalized external IDs.
- Version 9 adds custom collections and collection membership.
- Version 10 adds normalized assets and tags with compatibility sync.
- Version 11 adds per-game local notes on `games`.
- Version 13 adds saved advanced searches.

## Current Simplifications

- `games` stores aliases, tags, genres, paths, assets, personal notes, and compatibility external ID columns directly.
- `external_ids` mirrors and normalizes known external IDs, but the current UI still treats `games.*_id` as the compatibility surface.
- `play_sessions` stores launch profile and exit status, but does not store detailed failure reason yet.
- `metadata_match_jobs` is feature-specific, not a general task table, though batch matching also mirrors progress into `tasks`.
- Task records store summary progress/message/error, optional retry payloads, and normalized task logs.
- Asset and tag records are normalized, but compatibility fields on `games` still drive most existing UI and imports.

## Target MVP Tables From Brief

- `games`
- `game_titles`
- `game_paths`
- `game_assets`
- `tags`
- `game_tags`
- `launch_profiles`
- `play_sessions`
- `settings`
- `tasks`

## Target V1 Tables From Brief

- `metadata_sources`
- `external_ids`
- `field_locks`
- `collections`
- `collection_games`
- `save_locations`
- `save_backups`
- `app_logs`

## Migration Roadmap

### Version 2: Tasks

Status: implemented.

Add a general `tasks` table:

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  message TEXT,
  error TEXT,
  retry_payload TEXT,
  retryable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Version 3: Scanner Task Results

Status: implemented.

Stores reviewable scan candidates for background directory scan tasks:

```sql
CREATE TABLE scan_task_results (
  task_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  recursive INTEGER NOT NULL,
  candidates TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

### Version 4: Launch Profiles

Status: implemented.

Adds `launch_profiles` and extends `play_sessions` with `launch_profile_id` and `exit_status`. Existing game-level `executable_path`, `working_directory`, and `launch_args` remain as compatibility fallback.

### Version 5: Path Health

Status: implemented.

Adds path health columns to `games` through compatibility column checks:

```sql
ALTER TABLE games ADD COLUMN path_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE games ADD COLUMN last_path_checked_at TEXT;
```

Path checks currently validate install directory, executable path, and working directory. Relocation rewrites same-prefix game paths and launch profile paths in SQLite only.

### Version 6: Field Locks

Status: implemented.

Protects user-edited metadata fields from automatic metadata writeback:

```sql
CREATE TABLE field_locks (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  locked_by_user INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(game_id, field_name),
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

Manual edits lock changed metadata fields. Metadata apply skips locked fields unless the user explicitly enables override.

### Version 7: Task Logs And Retry Metadata

Status: implemented.

Adds retry metadata to `tasks` and a normalized task timeline table:

```sql
ALTER TABLE tasks ADD COLUMN retry_payload TEXT;
ALTER TABLE tasks ADD COLUMN retryable INTEGER NOT NULL DEFAULT 0;

CREATE TABLE task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

Retry is enabled for directory scans, database backups, save backups, and save restores. Report export keeps logs but is not retryable because retaining full Markdown content in task payloads would store private report data longer than necessary.

### Version 8: Metadata Sources And External IDs

Status: implemented.

Adds provider registration and normalized external IDs while keeping legacy game columns during transition:

```sql
CREATE TABLE metadata_sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE external_ids (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source TEXT,
  confidence REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(game_id, provider),
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

Default registered providers are VNDB, DLsite, FANZA, Bangumi, and YMGal. Existing `games.vndb_id`, `games.dlsite_id`, `games.fanza_id`, `games.bangumi_id`, and `games.ymgal_id` are backfilled into `external_ids`.

### Version 9: Collections

Status: implemented.

Adds custom user collections and many-to-many membership:

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE collection_games (
  collection_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY(collection_id, game_id),
  FOREIGN KEY(collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

Library filtering can now use tag, developer/brand/publisher, favorite, hidden, metadata completeness, and collection membership.

### Launch Profile Enhancements

Locale Emulator-style wrappers, custom runner commands, pre/post launch hooks, environment variables, shortcut launch, and elevated launch tracking are implemented in the compatibility schema and launch service. Profile-specific error history remains future work.

### Version 10: Normalized Assets And Tags

Status: implemented.

Adds normalized asset and tag tables while keeping old `games` columns during transition:

```sql
CREATE TABLE game_assets (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  uri TEXT NOT NULL,
  source TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(game_id, asset_type, uri),
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'tag',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name, kind)
);

CREATE TABLE game_tags (
  game_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(game_id, tag_id),
  FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

Game add/update and metadata apply sync compatibility fields into normalized assets and tags. Manual asset commands can set primary cover, banner, and background fields back onto `games` for existing UI compatibility.

### Version 11: Local Notes

Status: implemented.

Adds a private per-game note field for攻略进度, patch notes, completion thoughts, and other local user records:

```sql
ALTER TABLE games ADD COLUMN notes TEXT;
```

Notes are treated as user-authored local data. Metadata writeback does not populate this field, and editing notes should be explicit from the game detail or edit form.

### Version 13: Saved Searches

Status: implemented.

Stores named advanced local search expressions:

```sql
CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  query TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

The query string is parsed and validated in Rust search services. SQLite stores the user-authored expression without trying to interpret it through triggers.

### Asset Gallery And Tag Editing

Game detail pages now use normalized asset records for cover, banner, background, and screenshots while syncing primary image changes back to compatibility fields. Settings exposes tag rename, merge, and delete workflows on normalized tag records. Future work can migrate filters fully onto normalized tag tables once the compatibility period ends.

### Future: App Logs

Diagnostic log files are now written under the app data `logs/` directory with redaction and a Settings preview/prune UI. A normalized `app_logs` table is still a future option if log search needs richer indexing.

## Data Safety Rules

- Backup database before risky migrations.
- Never silently delete user game files.
- Restore save backup only after creating a protection backup.
- Automatic save backups are copy-only and recorded in `tasks` as `save.auto_backup`.
- Keep downloaded cover URLs and local cached paths distinguishable in asset records and compatibility fields.
- Use stable text enum values for status fields.
- Use ISO8601 timestamps consistently.
