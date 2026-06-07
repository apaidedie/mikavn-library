# MikaVN Library Roadmap

This roadmap maps the current implementation to the phases in `galgame-library-codex-brief.md`.

## Current Status

The app has moved beyond the original MVP into the mature local V1 shape. It has the local library loop, metadata search and batch matching, save backup/restore workflows, privacy settings, reports, themes, collections, advanced filters, advanced saved search, normalized assets/tags with maintenance UI, safe image-cache cleanup preview, image-reference audit details, task events, ZIP archive export/import/restore, database restore scheduling, diagnostic logs, richer launch profiles, a feature-sliced `Database` compatibility facade, and Windows NSIS bundling.

The main remaining work is no longer feature coverage for mature V1. It is hardening: a dedicated domain boundary when conversion pressure justifies it, richer recovery/audit reports, deeper integration tests, and optional post-V1 capabilities such as WebDAV/cloud sync or plugins.

## Phase 0: Foundation

Status: complete for mature local V1, with cleanup debt.

Done:

- Tauri + React + TypeScript + Rust project.
- SQLite initialization.
- Basic migration runner with `PRAGMA user_version`.
- App shell skeleton.
- Central frontend command wrapper.
- Base UI tokens in CSS.
- Unified Rust/TypeScript error contract.
- General `tasks` table, task commands, and task list UI.
- Task logs and retry metadata for supported recoverable tasks.
- Basic `infrastructure::paths::AppPaths` centralizes app data/database/cache/images/save-backup directories for new and high-frequency filesystem flows.
- Basic `infrastructure::logger` writes local daily diagnostic logs and redacts API-like tokens plus Windows user profile names before task/log storage on the shared logger path.
- Directory-style and ZIP library archive export, safe preview, non-destructive import with current database protection backup, and full archive restore scheduling with app-data cache protection.
- Safe database restore scheduling with pending restore file and next-start protection backup.
- Diagnostic log preview and retention pruning commands/UI in Settings.
- Metadata source registry and normalized external ID table with legacy column compatibility.
- Feature-sliced `db` compatibility extension modules backed by repositories and services while command names remain stable.
- Windows NSIS build verified.

Remaining:

- Introduce a dedicated `domain/` boundary when DTO/domain conversion pressure justifies it.
- Continue shrinking or removing the stable `Database` compatibility facade once command/service callers no longer need it.

## Phase 1: MVP Local Library

Status: complete for mature local V1.

Done:

- Add/edit/delete game records.
- Game edit form uses native directory, executable, and image pickers for path-heavy fields.
- Basic scan/import.
- Library root management in Settings, including enable/disable, recursive scan toggle, remove-record-only behavior, and scan task creation.
- Game list and detail page.
- Library bulk selection with select-current, invert-current, and clear controls for updating play status, favorite, hidden flags, tags, and collection membership add/remove actions across the current filtered set.
- Per-game local notes tab and edit-form field for personal攻略进度, patch notes, and completion thoughts.
- Per-game play-session records tab showing start/end time, duration, launch profile, and exit status.
- Launch executable and record play time.
- Multiple launch profiles with legacy game-field fallback.
- Search/filter by title and status.
- Advanced filters by tag, developer/brand/publisher, favorite, hidden state, metadata/media gaps, path health, and collection membership.
- Advanced local search page with field clauses, metadata/media gap filters, negation, comparisons, validation chips, and saved searches.
- Custom collections with add/remove membership from both collection and game detail views.
- Normalized asset/tag tables with compatibility sync from existing game fields.
- Tag rename, merge, and delete commands plus Settings maintenance UI for normalized tag cleanup.
- Game detail media health summary for cover, banner, background, inline description image references, per-game image-reference audit details, and Maintenance image-audit shortcut, plus asset gallery for cover, banner, background, screenshots, primary selection, user image import, remote asset download, removal, and unreferenced image cache cleanup with Maintenance preview and protection for game fields, asset records, and local description images.
- Maintenance media artwork repair fills missing cover, banner, and background images from available metadata providers.
- Maintenance media artwork diagnosis shows searchable/filterable reasons why missing artwork can or cannot be repaired before launching a batch task, with game-detail shortcuts and direct missing-external-ID handoff into batch metadata matching.
- Maintenance media artwork result summaries show searchable/filterable recent repair outcomes, skipped reasons, failed entries, and game-detail shortcuts from task logs.
- Maintenance health summary stats can open the Library with preset metadata or path filters for missing artwork, missing description images, missing external IDs, and broken or unchecked paths.
- Maintenance recent-task overview shows batch matching, description image repair, artwork repair, and duplicate ID audit status counts, all/active/attention/completed quick filters, progress, timing, log shortcuts, missing-ID matching shortcuts, retry, and cancellation.
- Maintenance image-reference audit with searchable/filterable per-game/source details, game-detail shortcuts, missing local files, C-drive leftovers, Playnite leftovers, raw values, and resolved local paths.
- Maintenance duplicate game merge supports resettable searchable/provider-filtered duplicate groups, suggests a keep target, and previews full related-record move counts before safe migration.
- Basic settings.
- Broken path check and install directory relocation.
- Library list/grid mark broken or incomplete path status, and detail pages show repair guidance.
- Path check can also run as a retryable task from the game detail page.
- Detail and save-management pages can open/reveal local game, executable, save, and backup paths.
- Manual database backup UI and command.

Remaining:

- Add more manual smoke coverage for unusual shortcut/runner combinations.

## Phase 2: Daily-Use Quality

Status: complete for mature local V1.

Done:

- Batch import review UI.
- Scanner duplicate/conflict warnings for existing install paths, executables, and titles.
- Scanner conflict actions for skip, merge into existing database record, replace the existing database record, or explicit duplicate import.
- Scanner import audit panel searches and filters requested, written, added, merged, replaced, duplicated, and skipped candidates with conflict reasons and target records.
- Directory scan runs through the general task system with progress, status polling, and cancellation.
- Global keyboard shortcuts for quick navigation, library search focus, add-game, and refresh.
- Database backup, report export, save backup, and save restore create task records.
- Task center shows queue progress, active/attention/completed counts, status/type shortcut filters, elapsed/remaining time estimates, text search, searchable expandable per-task logs, and retry for failed/cancelled scan, path check, metadata batch match, database backup, save backup, save restore, and library archive tasks.
- Dashboard shows a recent-task summary with attention/running shortcuts into filtered task views and log shortcuts into the expanded task row; Settings/Saves/Reports/detail/Scanner/Batch Metadata task notices expose non-disruptive log shortcuts.
- Metadata provider search and provider errors.
- Metadata field locks protect user-edited fields from automatic writeback.
- Path validation and basic repair from the game detail page.
- Empty/loading/error states on main pages.
- Theme modes and privacy display settings.

Remaining:

- Deeper scanner reconciliation reports beyond the current import audit, such as multi-record explanations for unusual conflict chains.

## Phase 3: Galgame Differentiation

Status: complete for mature local V1.

Done:

- Save path management.
- Common save-path candidate detection for game folder and Windows user locations, with user-confirmed add only.
- Manual save backup, merge restore, and explicit mirror restore.
- Restore protection backup.
- Save backup and restore task records.
- Save restore preview summarizes merge and mirror differences before execution, including copied, overwritten, kept, and mirror-removed file counts.
- Optional auto backup before launch and after exit through local settings and `save.auto_backup` task logs.
- Batch metadata updates with resettable queue search/provider-gap filters, missing-source count shortcuts including missing-all-external-ID presets, field write presets, result text/status/write-state filters, and filtered bulk writeback for reviewing large match result sets.
- Metadata field locks with explicit override.
- Launch profile data model, direct launch, shortcut launch, Locale Emulator-style wrapper launch, custom shell command launch, environment variables, pre/post hooks, and Windows `runAsAdmin` launch with UAC process-handle duration tracking.

Remaining:

- Rich per-file save diff viewers beyond the current restore preview summary.

## Phase 4: Advanced Optional

Status: selected Phase 4 scope implemented with advanced search.

Done:

- Advanced local search grammar for field clauses and comparisons.
- Saved searches persisted in SQLite and available from the Search page.

Out of scope candidates:

- Plugin/adapter system.
- WebDAV/cloud sync.
- CLI/local API.
- Community metadata workflows.

## Next Smallest Steps

1. Add focused integration tests around asset gallery/tag maintenance UI flows.
2. Add focused integration tests around scanner record replacement and save mirror restore protection backups.
3. Add richer scanner/archive/save recovery reports for unusual conflict and restore cases.
4. Run another desktop packaging/manual smoke pass after the next hardening batch.
