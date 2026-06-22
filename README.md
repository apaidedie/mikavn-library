# MikaVN Library

MikaVN Library is a Windows-first, local-first Galgame / Visual Novel library manager built from the mature V1 brief.

[![CI](https://github.com/apaidedie/mikavn-library/actions/workflows/ci.yml/badge.svg)](https://github.com/apaidedie/mikavn-library/actions/workflows/ci.yml)

GitHub Actions are configured in `.github/workflows/ci.yml` and `.github/workflows/release.yml` for CI and tagged Windows releases.

The current implementation focuses on a complete local desktop workflow:

- Local game records with SQLite persistence
- Manual add, edit, delete-record-only CRUD
- Library list and detail view
- Library bulk selection with select-current, invert-current, and clear controls for applying play status, favorite, hidden flags, tags, and collection add/remove actions to the current filtered set
- Per-game local notes for攻略进度, patch notes, and completion thoughts
- Per-game play-session records showing start/end time, duration, profile, and exit status
- Dashboard and basic report metrics
- Metadata search and matching surfaces for VNDB, DLsite, and FANZA
- Metadata field locks so user-edited fields are not overwritten by default
- Batch metadata matching with resettable queue search/provider-gap filters, missing-source count shortcuts including a missing-all-external-IDs preset, field write presets, candidate review, result text/status/write filters, filtered bulk writeback, stored job/result status, and user-confirmed writeback
- AI image-recognition command using OpenAI-compatible chat completions
- Scanner preview and candidate import flow with duplicate/conflict review actions
- Library root management in Settings, with user-confirmed scan tasks and candidate review before import
- Editable local provider / AI settings stored in `app_settings`
- Native directory, image, and save-file dialogs through Tauri dialog plugin
- Open/reveal local game, executable, save, and backup paths from detail and save-management pages
- Path health badges in library views plus repair guidance and install-directory relocation from detail pages
- Portable-first app data resolution for installed user-writable builds, keeping SQLite, images, logs, save backups, and cache under the app-adjacent `app-data/` directory when available
- Normalized asset/tag tables with compatibility sync from existing game fields
- Game detail media health summary for cover, banner, background, inline description image references, per-game image-reference audit details for missing/C-drive/Playnite leftovers, and a shortcut into the searchable/filterable Maintenance image audit
- Asset gallery on game detail pages for cover, banner, background, screenshots, local import, remote download, primary selection, removal, and cache cleanup
- Batch media artwork repair from metadata providers for missing cover, banner, and background images
- Maintenance media artwork diagnosis for searchable/filterable missing external IDs, remote no-image results, provider errors, and repairable artwork candidates with game-detail and batch-metadata shortcuts
- Maintenance media artwork result summaries for recent repair tasks, including searchable/filterable updated, skipped, and failed entries with reasons and game-detail shortcuts
- Maintenance health summary shortcuts that open the Library with matching metadata or path filters for missing artwork, missing description images, missing external IDs, and broken or unchecked paths
- Maintenance recent-task overview for batch matching, description image repair, artwork repair, and duplicate ID audit jobs with status counts, all/active/attention/completed quick filters, progress, timing, log shortcuts, missing-ID matching shortcuts, retry, and cancellation
- Asset commands for importing local image files into app data, downloading remote image assets, previewing image cache cleanup, and cleaning files not referenced by game image fields, gallery records, or local description images
- Save-path management, manual backups, restore-before-protection backups, and backup history
- Optional automatic save backups before launch and after game exit, visible in the task timeline
- Manual SQLite database backup from Settings using a task record
- Privacy settings for hidden entries, blurred covers, and report filtering
- Report statistics with Markdown export through the task queue
- Dashboard task summary with attention/running shortcuts, Maintenance task overview, and task center with queue progress overview, elapsed/remaining time estimates, status/type count shortcuts, text search, status/type filters, searchable expandable logs, retry, and cancellation for supported operations
- Task diagnostics can copy Markdown summaries with status, errors, recent logs, and suggested next actions for recovery/conflict workflows
- Library archive export/import with directory and ZIP formats, manifest, database backup, optional cache copies, safe preview, and non-destructive conflict skipping
- Custom collections plus advanced library filters for tag, developer/brand, favorite, hidden state, metadata and media gaps, path health, and collection membership
- Advanced local search with field clauses, negation, comparisons, validation chips, and saved searches
- Tag rename, merge, and delete UI in Settings for normalized tag maintenance
- Duplicate game merge assistance in Maintenance with resettable searchable/provider-filtered duplicate groups, recommended keep-target hints, and full related-record move counts before safe merge preview
- Normalized metadata source and external ID registry while preserving legacy `games.*_id` fields for compatibility
- Local app-data diagnostics, searchable/filterable image-reference audit details with game-detail shortcuts, diagnostic log preview/pruning, old database-backup cleanup, and safe database restore scheduling with next-start protection backup
- Tauri commands for games, dashboard, scanning roots, importing scan candidates, and launching executables with play-session timing

## Tech Stack

- Tauri 2
- React 19 + TypeScript
- Tailwind CSS 4
- Rust + rusqlite
- SQLite in the application data directory

## Project Layout

```text
src/
  app/
  components/ui/
  pages/
  services/
  types/
  utils/
src-tauri/
  src/commands/
  src/db/
  src/services/
scripts/
  playwright/
  desktop-smoke/
  README.md
docs/
  README.md
.github/
```

For documentation navigation, see `docs/README.md`. For script ownership, generated-artifact rules, and maintenance utility defaults, see `scripts/README.md`.

## Run Frontend Preview

The browser preview uses a localStorage mock store so the UI can be developed without Rust installed.

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:1420`.

## Run Tauri App

Install the Rust toolchain first: https://www.rust-lang.org/tools/install

Then run:

```bash
npm install
npm run tauri:dev
```

## Build

Frontend build:

```bash
npm run build
```

Desktop build after Rust is installed. Use the local build for unsigned smoke installers without updater signing secrets:

```bash
npm run tauri:build:local
```

Use the updater-signed build for public GitHub releases:

```bash
npm run tauri:build
```

## Release Readiness

This repository includes GitHub-ready project metadata and automation:

- `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `DESIGN.md`, `SECURITY.md`, and `SUPPORT.md`.
- Issue templates, pull request template, Dependabot configuration, CI, and release workflow under `.github/`.
- Repeatable browser and desktop smoke scripts under `scripts/`; see `scripts/README.md` for script categories and app-data defaults used by maintenance utilities.
- Generated smoke screenshots, logs, installers, and local Tauri packaging tools belong under `output/` and are ignored by Git except for `output/README.md`.

Use `RELEASE_CHECKLIST.md` before tagging or publishing a GitHub release.

In-app Windows updates use the Tauri v2 updater plugin and public GitHub Releases. Tagged releases must publish the NSIS installer, its `.sig` updater signature, and `latest.json` at the release asset URL. The desktop app checks `https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json` and never embeds a GitHub token.

## Verification Snapshot

Latest mature V1 acceptance pass. For the repeatable release checklist, see `RELEASE_CHECKLIST.md`.

- `npm run release:check` verifies version alignment, release metadata, Tauri security hardening, browser/large smoke gates, and release desktop-smoke gating; `npm run release:check:strict` also verifies public GitHub release links. `npm run release:validate:strict` runs the local release validation chain end to end, including the real installed library readonly smoke on the release machine, and `npm run release:validate:core` reruns the strict non-smoke core checks.
- `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test` under `src-tauri` pass with the current repository test count (161 Rust tests in the latest local run).
- `npm run test:release-scripts`, `npm run test:playwright-scripts`, `npm run test:updater-release`, `npm run test:diagnostic-export`, and `npm run test:library-performance` cover release handoff, source-size, build-chunk, Playwright module-resolution helpers, updater config, updater UI wiring, diagnostic export wiring, browser-preview fallback, lazy image rendering, debounced library filters, and bounded large-list data loading.
- `npm run build` passes TypeScript and Vite production build checks.
- `npm run smoke:browser` starts or reuses a local Vite server, then runs page-level Playwright QA plus core workflow smoke.
- `npm run smoke:large` starts or reuses a local Vite server, seeds 4500 browser-preview records by default, and verifies library rendering/filtering plus advanced search timings.
- `npm run tauri:build:local` produces an unsigned Windows release executable and NSIS installer for local smoke validation without updater signing secrets; `npm run tauri:build` remains the updater-signed public release build and requires `TAURI_SIGNING_PRIVATE_KEY`.
- `npm run smoke:install` silently installs the NSIS package into `output/clean-install-smoke/run-*/install`, launches the installed app with isolated app data, verifies first-run database/window creation, and silently uninstalls it.
- `npm run smoke:portable-data` silently installs the NSIS package without `MIKAVN_APP_DATA_DIR`, verifies first-run `mikavn.db` plus `.mikavn-portable` are created under executable-adjacent `app-data/`, and fails if a fallback `%APPDATA%` database appears.
- `npm run smoke:real-data:readonly` checks the real `E:\MikaVN Library` install without mutation: SQLite `quick_check`, backup samples, local image references, and sampled image-cache headers.
- `npm run smoke:real-install:update` is the explicit real installed-app overwrite check for `E:\MikaVN Library`: it refuses to run while MikaVN is active, creates a verified database backup under `app-data/database-backups/manual-install-smoke`, runs the NSIS installer against the real install directory, launches the app, and verifies game, asset, and image counts are preserved.
- `npm run smoke:desktop` verifies the release executable starts, exposes a main window handle, and creates `mikavn.db` only under the isolated `output/desktop-smoke/run-*/isolated-app-data` root; latest local desktop smoke passed against the rebuilt release executable.
- `npm run release:handoff:check` verifies the copied release handoff directory contains the rebuilt executable, NSIS installer, matching SHA256 sums, validation report, signing-status documentation, and manual risk-pass checklist. Before a public download release, run `npm run release:handoff:require-public` so unsigned artifacts or pending manual risk items fail the handoff instead of only being reported.
- `npm run release:signing:check` reports Windows Authenticode status; public installers should be signed with a trusted certificate as described in `docs/CODE_SIGNING.md`.

## Implemented Commands

- `add_game(input)`
- `update_game(id, input)`
- `delete_game_record(id)`
- `list_games(filter)`
- `get_game(id)`
- `check_game_paths(id)`
- `check_game_paths_task(id)`
- `relocate_game_paths(id, install_path)`
- `reveal_path(path)`
- `list_game_assets(game_id)`
- `upsert_game_asset(game_id, input)`
- `remove_game_asset(id)`
- `set_primary_asset(id)`
- `import_game_asset_from_path(game_id, input)`
- `download_game_asset(game_id, input)`
- `cleanup_asset_cache()`
- `preview_asset_cache_cleanup()`
- `list_tags(kind)`
- `rename_tag(id, name)`
- `merge_tags(source_ids, target_id)`
- `delete_tag(id)`
- `list_collections()`
- `create_collection(input)`
- `update_collection(id, input)`
- `delete_collection(id)`
- `list_collection_games(collection_id)`
- `add_game_to_collection(collection_id, game_id)`
- `remove_game_from_collection(collection_id, game_id)`
- `get_dashboard()`
- `backup_database(path)`
- `restore_database_backup(path)`
- `get_app_data_diagnostics()`
- `audit_image_references(options)`
- `cleanup_old_database_backups(policy)`
- `export_library_archive(options)`
- `export_library_archive_zip(options)`
- `preview_library_archive(path)`
- `import_library_archive(options)`
- `restore_library_archive(options)`
- `add_library_root(path)`
- `list_library_roots()`
- `update_library_root(id, recursive, enabled)`
- `remove_library_root(id)`
- `scan_library_root(id)`
- `start_scan_task(path, recursive)`
- `get_scan_task_status(task_id)`
- `import_scan_candidates(candidates)`
- `scan_path_preview(path, recursive)`
- `search_games_advanced(input)`
- `validate_search_query(query)`
- `list_saved_searches()`
- `create_saved_search(input)`
- `update_saved_search(id, input)`
- `delete_saved_search(id)`
- `launch_game(id)`
- `launch_game_with_profile(id, profile_id)`
- `list_play_sessions(game_id, limit)`
- `list_launch_profiles(game_id)`
- `create_launch_profile(input)`
- `update_launch_profile(id, input)`
- `delete_launch_profile(id)`
- `set_default_launch_profile(id)`
- `search_metadata(query, providers)`
- `get_metadata_detail(provider, id)`
- `match_metadata_for_game(game_id)`
- `apply_metadata_to_game(game_id, metadata, fields)`
- `list_metadata_sources()`
- `list_external_ids(game_id)`
- `list_field_locks(game_id)`
- `set_field_lock(game_id, field_name, locked_by_user)`
- `set_field_locks(game_id, field_names, locked_by_user)`
- `batch_match_metadata(game_ids)`
- `get_batch_match_status(job_id)`
- `cancel_batch_match(job_id)`
- `recognize_game_from_image(image_path)`
- `list_save_paths(game_id)`
- `add_save_path(game_id, label, path)`
- `remove_save_path(id)`
- `suggest_save_paths(game_id)`
- `create_save_backup(save_path_id, label)`
- `create_save_backup_task(save_path_id, label)`
- `list_save_backups(game_id)`
- `restore_save_backup(backup_id)`
- `restore_save_backup_task(backup_id, options)`
- `preview_save_restore(backup_id, options)`
- `delete_save_backup_record(id)`
- `export_report_markdown(path, content)`
- `export_report_markdown_task(path, content)`
- `get_app_settings()`
- `set_app_setting(key, value)`
- `set_app_settings(settings)`
- `create_task(task_type, message)`
- `list_tasks(limit)`
- `get_task(id)`
- `get_task_detail(id)`
- `list_task_logs(task_id)`
- `update_task(id, status, progress, message, error)`
- `cancel_task(id)`
- `retry_task(id)`
- `list_diagnostic_logs(limit)`
- `get_log_retention()`
- `prune_diagnostic_logs(policy)`

Deleting a game only removes the database row. It never deletes files from the real game directory.

## Metadata Providers

The metadata layer ports the useful ButterFetch ideas into native Rust/Tauri modules:

- VNDB uses `https://api.vndb.org/kana/vn` and prefers Japanese titles when available.
- DLsite supports `RJ/VJ` ID lookup and public search in `maniax` / `pro` modes.
- FANZA supports public search and detail lookup.
- VNDB pages are inspected for DLsite / FANZA IDs and those matches receive a small relevance bonus.
- Title cleaning removes common release noise such as brackets, version numbers, platform labels, archive formats, and Chinese/Japanese edition markers.
- Provider enable/disable settings are respected by manual search, auto-match, batch match, and VNDB sniffed external IDs.
- Search responses are cached for 24 hours, and detail responses are cached for 7 days in `metadata_cache`.
- When applying metadata, remote cover URLs are downloaded to `images/` when possible. Downloads are capped at 10MB and limited to public image MIME types; failures keep the original URL and do not block metadata writeback.
- User-edited fields can be locked. Metadata apply skips locked fields by default and only overwrites them when the user explicitly enables override.
- `metadata_sources` registers source providers and `external_ids` stores normalized per-game IDs. The legacy columns on `games` are still kept as the current compatibility surface for existing UI and imports.
- Bangumi and YMGal external IDs are registered and normalized for local records, filters, diagnostics, and duplicate audits. Full Bangumi / YMGal public search and detail providers remain future work.

DLsite and FANZA access is intentionally limited to public pages. The app does not log in, bypass restrictions, or fetch paid content.

## AI Recognition

AI image recognition reads configuration in this order:

```powershell
$env:MIKAVN_AI_API_KEY = "your local key"
$env:MIKAVN_AI_BASE_URL = "https://api.example.com/v1"
$env:MIKAVN_AI_MODEL = "gpt-4o-mini"
```

If environment variables are not present, the Tauri command can read local `app_settings`. Images are resized to a 1024px longest side and encoded as JPEG quality 85 before being sent. Do not commit real API keys.

## Scanner Flow

The scanner page can open a native directory picker, start a background scan task, list candidate game folders, and import selected candidates. Candidates that match an existing install path, executable path, or title are marked as conflicts and skipped by default. Each conflict can be left skipped, merged into the existing MikaVN record, replaced at the database-record level, or explicitly imported as a duplicate record. Merge updates database fields such as install path, executable path, working directory, and aliases. Replace overwrites the existing record's title/path/executable/aliases. Neither mode moves, renames, overwrites, or deletes real game files. After import, a searchable/filterable audit panel summarizes requested, written, added, merged, replaced, duplicated, and skipped records with per-candidate messages, conflict reasons, target titles, record IDs, and install paths. You can immediately run metadata matching for the imported rows or use the Batch Match page later.

In browser preview mode, native dialogs fall back to prompt-based path input.

## Library Roots, Collections, And Filters

Settings can register one or more local library root directories. Each root can be enabled/disabled and configured for recursive or one-level scanning. Starting a scan from a library root creates a normal scan task; results still flow through the scan candidate review UI before anything is imported. Removing a library root only deletes that root record and never deletes real files or imported games.

The Collections page creates local custom collections and lets users add or remove games without touching real files. Game detail pages can also add the current game to a collection. The Library page includes advanced filters for tag, developer/brand/publisher, collection, favorite-only, hidden state, path health, and metadata/media gaps (`complete`, `needs_metadata`, missing description, missing cover/banner/background, missing artwork, missing description images, or missing external ID).

The Advanced Search page starts with a simple search box and shortcut searches such as high-rated games, recent releases, incomplete artwork, missing description images, broken paths, and long-played titles. Query chips show how the input was parsed, validation errors stay inline, and searches can be saved locally for repeat use. The full syntax is tucked behind the page's advanced grammar disclosure: plain terms search title, aliases, developer/brand, description, notes, tags, genres, and paths. Field clauses include `tag:`, `genre:`, `dev:`, `publisher:`, `brand:`, `status:`, `path:`, `meta:`, `collection:`, and `age:`; `meta:` accepts values such as `missing_artwork` and `missing_description_image`. Comparisons include `rating>=80`, `released>=2020-01-01`, `played>=2026-01-01`, and `playtime>=10h`.

## Assets And Tags

`game_assets`, `tags`, and `game_tags` now provide normalized records while `games.cover_image`, `games.banner_image`, `games.background_image`, `games.tags`, and `games.genres` remain the compatibility fields for current UI and imports. Game detail pages include a media health summary, per-game image-reference audit action, Maintenance image-audit shortcut, and asset gallery for cover, banner, background, and screenshot records. The gallery can import user image files, download remote image assets into the local cache, set the primary image for compatibility fields, remove asset records without deleting real game files, and run unreferenced image cache cleanup. The cleanup scanner keeps files referenced by game image fields, `game_assets`, and local Markdown/HTML/BBCode image references in descriptions; Maintenance can preview removable file count and size before deleting from `app-data/images`, and its image-reference audit can search by game/source/path/problem text, filter to missing files, C-drive leftovers, and Playnite leftovers, then jump to the affected game detail. Settings includes tag maintenance for renaming, merging, and deleting normalized tag or genre records.

## Save Backups

The Saves page lets you attach one or more save directories to each game. Manual backups are copied into `save-backups/{game_id}/` under the application data directory. Backup and restore can create task records so progress and failures are visible in the Tasks page. Restore preview scans the selected backup and current save directory before execution, reporting new, overwritten, kept, and mirror-removed files with small path samples. Normal restore first creates a protection backup of the current save directory, then copies the selected backup over matching files. Explicit mirror restore is available as a high-risk option: it also creates a protection backup first, then clears the registered save directory before copying the backup contents.

Settings can enable automatic save backups before launch and after game exit. Auto backups reuse the same copy-only backup path, create `save.auto_backup` task records, and log per-path failures without deleting or moving real game files.

Scanner conflict review supports skip, merge, replace database record, and duplicate import. Replace is explicit and only overwrites the existing database record fields for title/path/executable/aliases; it never deletes, moves, or rewrites the real game installation directory.

## Launch Profiles And Path Health

Each game can have multiple launch profiles. Existing game-level executable fields are still used as a legacy default when no profile exists. Profiles support direct executable launch, `.lnk` shortcut launch, Locale Emulator-style wrapper launch, custom shell command launch, per-profile environment variables, launch arguments, startup hooks, and post-exit hooks. On Windows, `runAsAdmin` requests UAC elevation with `ShellExecuteExW` and `SEE_MASK_NOCLOSEPROCESS`, retains the elevated process handle, and records the real play-session duration when the elevated process exits. If the user cancels UAC, the command returns `LAUNCH_CANCELLED` before creating a play session. The detail page can check install, executable, and working-directory paths, and can relocate the install directory. Relocation rewrites same-prefix database paths only; it does not move or delete real files.

## Privacy And Reports

Privacy settings are local `app_settings` values:

- `privacy_hide_hidden` hides entries marked as hidden in the library view.
- `privacy_blur_covers` blurs covers in list, grid, and detail views.
- `privacy_filter_reports` excludes hidden and R18 entries from reports by default.

The Reports page computes status distribution, tag/developer rankings, playtime rankings, metadata completeness, and exports Markdown. In Tauri, export writes to the selected local path through a task record; in browser preview, it downloads a Markdown file.

## Tasks And Backups

The Dashboard shows a recent-task summary so failed, running, or pending work is visible immediately, with shortcuts into the Tasks page filtered to attention or running work. Maintenance also has a recent-maintenance-task overview focused on batch matching, description image repair, artwork repair, and duplicate ID audit jobs; it shows status counts, all/active/attention/completed quick filters, progress, timing, log shortcuts, retry for failed/cancelled maintenance tasks, and cancellation for active maintenance tasks without mixing in unrelated scan or backup work. Each recent task has a log shortcut that opens the Tasks page, expands the matching task, and scrolls it into view. Settings, Saves, Reports, and game detail task notices also show a non-disruptive `查看日志` action for newly created tasks. The Tasks page listens for `task://updated` events in Tauri and keeps the older polling fallback for browser preview or missed events. Long-running or recoverable operations such as scanner runs, path checks, batch metadata matching, database backup, report export, save backup, save restore, and library archive flows write progress and logs; task rows show elapsed time, finished-task duration, and progress-based remaining-time estimates when enough progress exists. Failed or cancelled directory scans, database backups, path checks, save backups, save restores, and library archive operations can be retried from the Tasks page. Report export keeps logs but is not retryable so exported Markdown content is not retained in retry payloads. Settings includes an app-data self-check for the active data directory, database health, image-reference totals, app-data file counts, safe database-backup cleanup, and a Maintenance image-reference audit that lists the affected game, source field, raw value, resolved path, and missing/C-drive/Playnite issues. It also includes a manual SQLite database backup action using SQLite `VACUUM INTO` for a consistent backup file, a safe restore scheduler that applies on next startup after a protection backup, and a diagnostic log preview/prune surface.

## Library Archives

Settings can export either a directory-style library archive or a `.zip` library archive. Each archive contains `manifest.json`, a SQLite consistency backup as `mikavn.db`, and optional copies of local image cache and save-backup folders. Archives never include real game installation directories.

Archive preview reads manifest and file counts from either a directory or a `.zip` file. Safe import first creates a protection backup of the current database, then reads the archive database and imports only non-conflicting game records. Entries with the same ID, normalized title, or normalized install path are skipped and logged in the task timeline. Optional image and save-backup cache copies can be merged into the app data directory. Safe import does not replace the live database file.

Full archive restore is a separate high-risk action in Settings. It validates the archive `mikavn.db`, copies it into the pending restore slot, and applies the database replacement only on the next app startup through the existing restore protection path. If selected, archive image and save-backup cache folders are mirrored into the active app-data cache after protecting the current cache under `archive-restore-protection/`. Cache restore is limited to MikaVN app data folders and never touches real game installation directories.

## Current Boundaries

Not included yet:

- Cloud sync
- Plugin system
- Complex privacy mode beyond local hide/blur/report filters
- Full Bangumi / YMGal metadata search/detail providers beyond the current external-ID registry
- Rich per-file save diff viewers beyond the current restore preview summary
- Normalized log indexing beyond file preview/pruning
- A dedicated `domain/` crate/module split
- Complete removal of the stable `Database` compatibility facade after callers no longer need the compatibility surface

Those are intentionally left for later milestones so the completed local library core can stay stable while deeper platform and ecosystem features are designed separately.
