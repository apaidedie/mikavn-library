# MikaVN Library Architecture

This project follows the mature route in `galgame-library-codex-brief.md`: Windows-first, local-first, Tauri + React + TypeScript + Rust + SQLite.

## Layering Target

```text
UI Layer
  React pages, components, design tokens, app shell

Application Layer
  Rust commands and services for library, import, launch, metadata, saves, tasks, settings

Domain Layer
  Stable DTOs and domain concepts: Game, Metadata, LaunchProfile, SaveBackup, Task, Settings

Infrastructure Layer
  SQLite, filesystem, process launcher, logger, app paths, external APIs
```

## Current Frontend Structure

```text
src/
  app/App.tsx
  pages/
  components/ui/
  services/api.ts
  services/mockStore.ts
  types/
  utils/
  style.css
```

Good current decisions:

- Tauri calls are centralized in `src/services/api.ts`.
- DTOs are centralized in `src/types`.
- Browser preview has a mock store, so UI can be tested without Tauri.
- Page primitives exist in `src/components/ui/page.tsx`.

Future target structure:

```text
src/
  app/
  pages/
  components/
  stores/
  api/
  types/
  design/
```

Migration rule: do not rename folders for style only. Move code when a feature needs the boundary.

## Current Rust Structure

```text
src-tauri/src/
  commands/
  db/
  infrastructure/
  repositories/
  services/
  lib.rs
  main.rs
```

Good current decisions:

- Commands are grouped by feature.
- Metadata and image logic already live under `services`.
- `infrastructure::paths::AppPaths` now centralizes the app data root and common subdirectories for database, cache, images, logs, save backups, and import-protection backups.
- `infrastructure::logger` provides local daily diagnostic logs plus privacy-safety primitives for redacting API-like tokens and Windows user profile names in selected task messages and log lines.
- SQLite is used from the start.
- Versioned migrations use `PRAGMA user_version`.

Current architecture state:

- `db::schema` owns baseline schema/bootstrap repair and `db::migrations` owns the ordered migration registry. `repositories/` now contains the persistence slices for tasks/logs, core game row access/writes plus list filtering/sorting, normalized assets/tags, collections, library roots, launch profiles/play sessions, metadata IDs/cache/match jobs/sources, saved searches, scanner results, save paths/backups, and app settings.
- Tauri commands are now thin entry points for the mature V1 feature set. Feature orchestration is handled by services: `services::launcher`, `services::backups`, `services::logs`, `services::reports`, `services::metadata`, `services::games`, `services::collections`, `services::search`, `services::settings`, `services::filesystem`, `services::saves`, `services::assets`, `services::scanner`, `services::archives`, `services::dashboard`, and `services::library_paths`.
- `Database` remains as a stable compatibility facade for command and service callers, but the old monolithic implementation has been split into feature extension modules such as games, assets, collections, dashboard, launch, library roots, metadata, saves, scanner, search, settings, tag maintenance, and tasks. These modules delegate persistence to the repositories listed above while preserving public command names and frontend API contracts. The remaining architecture work is mostly shrinking or retiring this facade once callers can depend directly on service/repository/domain boundaries, not filling missing mature V1 behavior.
- A general `tasks` table and thin task commands now exist, with task/log persistence owned by `repositories::tasks` behind stable `Database` compatibility methods. Metadata batch matching, directory scanning, database backup, report export, save backup, save restore, path checks, and library archive flows write task progress and logs. `services::tasks` emits `task://updated` after task creation/update, owns task cancellation and retry dispatch, and lets the frontend refresh immediately while retaining polling as a fallback. Directory scan, metadata batch match, database backup, save backup, save restore, path check, and directory/ZIP library archive tasks store retry payloads for failed/cancelled retries.
- Dashboard data is assembled in `services::dashboard`, which keeps report/dashboard commands thin while continuing to use stable `Database` compatibility methods for game lists and playtime totals.
- Launch profiles and play sessions are modeled in SQLite, with persistence and install-path relocation sync delegated through `repositories::launch`. Thin launcher commands are backed by `services::launcher`, which owns direct launch, `.lnk` launch, Locale Emulator-style wrapper launch, custom shell command launch, environment variables, pre/post hooks, and Windows `runAsAdmin` UAC requests. Elevated launches use `ShellExecuteExW` with `SEE_MASK_NOCLOSEPROCESS` so the app can wait on the elevated process handle and record real play-session duration after exit; UAC cancellation maps to `LAUNCH_CANCELLED` before a play session is created.
- Launch can optionally trigger copy-only save backups before process spawn and after process exit. These are controlled by local settings and recorded as `save.auto_backup` tasks. The launcher service orchestrates when backups happen, `services::saves` owns save-path lookup/suggestion generation, add-path directory validation, immediate and task-based backup creation, immediate safe restore, restore merge/mirror policy, and backup/restore task execution, and `repositories::saves` owns save path plus backup record persistence.
- Path health checks, retryable path-check tasks, and install-directory relocation now go through thin game commands backed by `services::library_paths`. The service owns per-path validation, task logging, path health status updates, and the current database-only relocation flow.
- Field locks are modeled in SQLite, enforced in metadata apply, and persisted through `repositories::metadata_ids`. Manual edit lock detection currently lives in the library page and should eventually move into an application service.
- Metadata providers are registered and listed through `repositories::metadata_sources`, per-game provider IDs are mirrored into normalized `external_ids` through `repositories::metadata_ids`, provider response caching persists through `repositories::metadata_cache`, and batch match job/result state persists through `repositories::metadata_matches`. The legacy `games.*_id` columns remain the compatibility surface for current UI, imports, and metadata writeback.
- Collections are modeled with `collections` and `collection_games`; Library filtering can query by collection membership, tag, developer/brand/publisher, favorite, hidden state, and metadata completeness. Collection persistence and membership updates now live in `repositories::collections`; `Database` resolves collection membership IDs and delegates the actual game filtering and sorting to `repositories::games` behind stable compatibility methods.
- Assets and tags are modeled in `game_assets`, `tags`, and `game_tags`, with gallery operations, tag maintenance, primary image sync, and tag backfill now delegated through `repositories::asset_tags`. Asset command orchestration now passes through `services::assets`, including gallery CRUD, tag maintenance, local image import, remote image download, and image cache cleanup. Compatibility fields on `games` still feed cover/banner/background/tag display while normalized records remain the editing surface during the transition.
- Library roots are modeled in `library_roots`; Settings and scanner commands keep their stable `Database` compatibility methods while persistence is delegated through `repositories::library_roots`.
- App settings are modeled in `app_settings` and now persist through `repositories::settings`; settings commands and services keep calling stable `Database` compatibility methods.
- Scanner duplicate detection currently compares install path, executable path, and normalized title inside `services::scanner`, while scan task result rows persist through `repositories::scanner_results`. Conflict actions support skip, merge into an existing database record, replace the existing database record, and explicit duplicate import. Replace only updates database fields and does not delete, move, or rewrite real game folders; richer reconciliation reports can grow in the scanner/import service without fattening the Tauri command layer.
- Library archive export/import now lives behind thin archive commands backed by `services::archives`. The service produces either a directory archive or ZIP archive with manifest, SQLite backup, and optional cache copies. Preview and safe import accept both formats, ZIP extraction rejects unsafe paths, and safe import creates a current-database protection backup before merging only non-conflicting game records. Destructive full restore should become a separate application service with a stronger confirmation and rollback story.
- Baseline schema creation and compatibility column repair now live in `db::schema`; versioned migrations live in `db::migrations` as an ordered registry with a guard test for contiguous version order and current schema version alignment. Migration-only metadata source seeding plus external-ID and asset/tag backfills also live in `db::migrations`, using repositories directly instead of temporary `Database` helper methods.

## Target Rust Structure

```text
src-tauri/src/
  commands/
  services/
  domain/
  infrastructure/
  repositories/
  error.rs
```

Migration order:

1. Keep the unified error contract stable while adding more specific repair details where UI recovery needs them.
2. Continue broadening local logger coverage without sending logs off-device; file preview/pruning is implemented, while indexed log search remains optional future work.
3. Continue shrinking or retiring the stable `Database` compatibility facade now that feature extension modules and repositories are in place, without changing public Tauri command names.
4. Introduce a dedicated `domain/` boundary when DTO/domain conversion pressure justifies it.
5. Add richer path repair reports if relocation grows beyond the current database-only flow.

## Command Rules

- Commands parse input and call services.
- Commands return stable DTOs or `AppError`.
- Commands should not directly concatenate filesystem paths.
- Commands should not hide long-running operations.

## Frontend API Rules

- Components must call `api.*`, not `invoke()` directly.
- `api.*` normalizes backend errors into `MikaAppError`.
- UI should display `error.message` today and can branch on `error.code` later.

## Verification Rules

- Frontend: `npm run typecheck`, `npm run build`.
- Rust: `cargo check`, `cargo test` under `src-tauri`.
- Desktop bundle: `npm run tauri:build`.
- UI changes should be checked in the browser or screenshots when possible. The mature V1 page-level QA runner is `output/playwright/page-qa-runner.cjs`, and the core workflow smoke runner is `output/playwright/core-workflow-smoke.cjs`.
