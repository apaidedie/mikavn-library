# Changelog

All notable changes to MikaVN Library are documented here. This project follows a practical `0.x` cadence while the local-first desktop workflow stabilizes.

## 0.1.1 - Mature Local V1 Hardening

Updated release candidate with the mature local V1 hardening pass.

### Added

- Strict one-command release validation scripts for metadata, frontend, Rust, browser smoke, large-library smoke, Tauri build, and desktop smoke.
- Large-library browser smoke covering 1500 preview records and advanced-search timing budgets.
- Clean-install smoke covering NSIS silent install, isolated first launch, and silent uninstall.
- Windows signing check/sign helper scripts and 0.1.1 release notes.
- Isolated desktop smoke validation using `MIKAVN_APP_DATA_DIR` so smoke runs never touch the real user profile.
- Settings page module split for appearance, metadata/AI configuration, and shared setting indicators.
- Full library archive restore scheduling with archive database validation, next-start database replacement, retryable task logs, and optional app-data image/save-backup cache mirroring.
- Maintenance image-cache cleanup preview with removable file counts and byte totals.
- Maintenance image-reference audit details for locating missing files, C-drive leftovers, and Playnite leftovers by game, source field, raw value, and resolved path.
- Library and Advanced Search filters for missing description, cover, banner, background, incomplete artwork, missing description images, and missing external IDs.
- Batch media artwork repair now includes missing banner images alongside cover and background images.
- Maintenance media artwork diagnosis for checking repairable artwork candidates, missing external IDs, no-image metadata results, and provider errors before starting a repair task.
- Maintenance media artwork result summaries for recent repair tasks, including updated, skipped, and failed entries with reasons.
- Save restore previews for merge and mirror restore, including new, overwritten, kept, and mirror-removed file counts before task creation.
- Scanner import audit panel with filterable per-candidate results, conflict reasons, target titles, record IDs, and install paths.
- Task center overview with queue progress, active/attention/completed counts, text search, status filters, and task-type filters.
- Library bulk edit bar for selecting the current filtered games and applying play status, favorite, hidden flags, tags, or collection add/remove actions together.
- Batch metadata matching queue search/provider-gap filters, result overview with success/review/no-result/error counts, status/write-state filters, and filtered bulk writeback.
- Duplicate game safe merge now supports duplicate-group search/provider filters, highlights a recommended keep target, provides per-row keep-target switching, and previews all related-record move counts before merge.

### Changed

- Hardened Tauri security with explicit CSP, prototype freezing, and scoped asset protocol rules.
- Built release executables as Windows GUI applications to avoid opening an extra console window.
- Browser smoke scripts now start or reuse Vite automatically instead of requiring a manually started dev server.
- Strengthened scanner, archive, save restore, database restore, task-log, and diagnostic-log audit behavior.
- Hardened image-cache cleanup so it preserves game image fields, normalized asset records, and local images embedded in descriptions.
- Added explicit record-only confirmations for saved searches, save paths, and save-backup records.
- Expanded CI and release workflows with strict release metadata, Rust formatting, Clippy, browser smoke, large-library smoke, desktop smoke, and artifact uploads.

### Safety Notes

- Save path and backup record deletion remove only MikaVN database records; real save directories and backup folders are not deleted.
- Save restore preview is read-only and scans the selected backup plus registered save directory before any restore task is created.
- Scanner import audit is read-only after import and reports database actions without touching real game folders.
- Full archive restore creates protection backups and mirrors only MikaVN app-data cache folders; it never touches real game installation directories.
- Image-cache cleanup is limited to MikaVN `app-data/images` and previews unreferenced files before deletion from Maintenance.
- Image-reference audit is read-only and does not move, rewrite, download, or delete any files.
- Desktop smoke verifies the release executable creates `mikavn.db` only under an isolated `output/desktop-smoke/run-*/isolated-app-data` root.

## 0.1.0 - Mature Local V1

Initial public-ready release candidate.

### Added

- Local-first Tauri desktop app for Windows with SQLite persistence.
- Library, detail, dashboard, reports, collections, saves, tasks, scanner, settings, metadata, and advanced search pages.
- VNDB, DLsite, and FANZA metadata search/matching surfaces with provider settings, field locks, external IDs, and local metadata cache.
- Advanced search with plain terms, field clauses, negation, comparisons, validation chips, and saved searches.
- Scanner conflict review with skip, merge, replace database record, and duplicate import actions.
- Save path management, manual backups, restore protection backups, mirror restore, and optional launch-adjacent auto backups.
- Launch profiles for direct executable, `.lnk`, Locale Emulator-style wrapper, custom command, hooks, environment variables, and Windows elevated launch tracking.
- Asset gallery for local import, remote download, primary image selection, removal, and unreferenced cache cleanup.
- Directory and ZIP library archives with safe preview/import and current-database protection backup.
- Diagnostic log preview/pruning with API-like token and Windows user profile redaction.
- Release checklist, smoke scripts, and GitHub-ready repository metadata.

### Safety Notes

- Deleting a game removes only the database record and never deletes real installation files.
- Archive import/export and scanner flows do not move, rewrite, or delete real game directories.
- Database restore and save mirror restore create protection backups before replacing data.

### Known Boundaries

- Windows is the only supported target.
- Cloud sync, WebDAV, plugin ecosystem, CLI/local API, and community features are out of scope for this release.
- Rich indexed log search remains future work.
