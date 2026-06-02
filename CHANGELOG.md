# Changelog

All notable changes to MikaVN Library are documented here. This project follows a practical `0.x` cadence while the local-first desktop workflow stabilizes.

## 0.1.1 - Mature Local V1 Hardening

Updated release candidate with the mature local V1 hardening pass.

### Added

- Strict one-command release validation scripts for metadata, frontend, Rust, browser smoke, large-library smoke, Tauri build, and desktop smoke.
- Large-library browser smoke covering 1500 preview records and advanced-search timing budgets.
- Isolated desktop smoke validation using `MIKAVN_APP_DATA_DIR` so smoke runs never touch the real user profile.
- Settings page module split for appearance, metadata/AI configuration, and shared setting indicators.

### Changed

- Hardened Tauri security with explicit CSP, prototype freezing, and scoped asset protocol rules.
- Strengthened scanner, archive, save restore, database restore, task-log, and diagnostic-log audit behavior.
- Added explicit record-only confirmations for saved searches, save paths, and save-backup records.
- Expanded CI and release workflows with strict release metadata, Rust formatting, Clippy, browser smoke, large-library smoke, desktop smoke, and artifact uploads.

### Safety Notes

- Save path and backup record deletion remove only MikaVN database records; real save directories and backup folders are not deleted.
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
- Rich indexed log search and full archive database replacement remain future work.
