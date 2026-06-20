# Image Health Maintenance Design

Date: 2026-06-20

## Context

MikaVN Library is now installed for daily use at `E:\MikaVN Library` with a real local data set:

- 4456 games;
- 17738 media asset records;
- 23445 image cache files;
- a 47 MB SQLite database under `app-data/mikavn.db`.

The existing maintenance surface can already:

- audit image references for missing files, C drive paths, and Playnite-import paths;
- preview and clean unreferenced image cache files;
- repair missing artwork through metadata providers;
- report database, image, log, backup, save-backup, and metadata health.

A read-only check of the current real library showed no missing local image files and no estimated orphan image files. The largest real issue is legacy `playnite-import` path noise: many image references point into the current MikaVN image cache under `app-data/images/playnite-import/...`, so they work, but diagnostics still treat them as Playnite residue.

The next useful increment should make image maintenance safer and clearer before adding any destructive cleanup behavior.

## Goals

1. Provide one image-health report that covers:
   - missing covers and artwork metadata gaps;
   - missing local image references;
   - C drive image references;
   - Playnite legacy references;
   - orphan cache files;
   - duplicate file names;
   - oversized image files.
2. Keep first-run behavior conservative: health checks and cleanup previews must not modify files or database rows.
3. Add a safe repair path for orphan cache files by moving them to an app-managed quarantine directory instead of deleting them.
4. Make any database-changing image repair require a verified database backup first.
5. Reuse the existing Maintenance page, diagnostics service, asset cache reference scanner, and task patterns instead of creating a new subsystem.
6. Keep the implementation suitable for a large local library with tens of thousands of files.

## Non-Goals

- No permanent deletion of image cache files in the first image-health increment.
- No automatic image compression or re-encoding.
- No rewrite of all `playnite-import` paths unless the target replacement path is proven to point at the same existing file.
- No remote cloud sync or online image backup.
- No changes to real game installation folders.
- No background repair without explicit user action.

## Current Capabilities

### Backend

- `diagnostics::audit_image_references` returns counts and sample rows for missing, C drive, and Playnite references.
- `assets::preview_asset_cache_cleanup` computes unreferenced files in `app-data/images`.
- `assets::cleanup_asset_cache` removes unreferenced files directly.
- `backups::create_update_protection_backup` can create a verified SQLite backup before risky update work.
- Metadata artwork repair can fill missing cover, banner, and background fields.

### Frontend

- Maintenance page has image reference audit details.
- Maintenance data location panel can preview and run asset cache cleanup.
- Maintenance overview shows missing cover and description-image metrics.
- Task history and task diagnostics already exist for long-running maintenance actions.

## Recommended Approach

Create a first-class "image health" report by composing the existing scanners and adding file-level cache analysis.

The report should be read-only and fast enough for the current 23000+ image cache. It should be shown in Maintenance as the primary media-health summary, with drill-down actions into existing detailed panels.

For repair, first add only safe operations:

1. Refresh health report.
2. Preview orphan cache quarantine.
3. Move orphan files into `app-data/image-quarantine/YYYYMMDD-HHMMSS`.
4. Keep a manifest in the quarantine directory so files can be restored manually if needed.

Path normalization should be designed but implemented cautiously:

- A `playnite-import` path that is already under `app-data/images` is not broken. It should be reported as "legacy import path" instead of "danger".
- A Playnite or C drive path outside `app-data/images` remains a warning because it depends on an external location.
- A future repair can rewrite absolute `app-data/images/...` references to portable `images/...` references, but only after a database backup and only when the old and new paths resolve to the same file.

## Alternatives Considered

1. Extend the existing image audit only.
   - Benefit: smaller UI change.
   - Cost: file-level cache health such as orphan, duplicate name, and oversized file counts remains separate or missing.
   - Decision: reject as the main approach, but reuse the audit as an input.

2. Add a fully automatic one-click cleanup.
   - Benefit: simple user flow.
   - Cost: too risky for real data; accidental deletion or over-aggressive path rewrite would be hard to recover from.
   - Decision: reject. First increment must be preview-first and quarantine-first.

3. Build a new image maintenance page.
   - Benefit: clean separation.
   - Cost: duplicates the current Maintenance area and adds navigation complexity.
   - Decision: reject. Extend Maintenance instead.

## Backend Design

### Report Types

Add an image health report type, exposed through a new command:

- `get_image_health_report(options?) -> ImageHealthReport`

The report should include:

- `generatedAt`;
- `summary`;
- `references`;
- `cache`;
- `recommendations`.

Suggested summary fields:

- `totalImageRefs`;
- `issueImageRefs`;
- `missingLocalRefs`;
- `cDriveRefs`;
- `playniteRefs`;
- `legacyAppDataImportRefs`;
- `externalLegacyRefs`;
- `imageFiles`;
- `orphanFiles`;
- `duplicateFileNameGroups`;
- `oversizedFiles`;
- `missingCoverGames`;
- `missingArtworkGames`.

Suggested cache fields:

- `rootPath`;
- `fileCount`;
- `totalBytes`;
- `referencedFileCount`;
- `orphanFileCount`;
- `orphanBytes`;
- `duplicateFileNameGroups`;
- `oversizedFileCount`;
- `oversizedBytes`;
- limited sample arrays for orphans, duplicate names, and oversized files.

Use conservative defaults:

- oversized threshold: 5 MB;
- max sample rows: 100;
- scan only `app-data/images`;
- never follow files outside the image cache for cleanup candidates.

### Orphan Quarantine

Add a backend command:

- `quarantine_orphan_images(options?) -> ImageQuarantineReport`

Behavior:

1. Recompute orphan candidates using the same report scanner.
2. Create `app-data/image-quarantine/YYYYMMDD-HHMMSS`.
3. Move orphan files from `app-data/images` into the quarantine directory, preserving relative paths.
4. Write `manifest.json` with source path, quarantine path, size, moved time, and reason.
5. Do not delete empty directories in the first increment unless they are under the quarantine target.
6. Return moved file count, moved bytes, manifest path, and skipped items.

If a candidate disappears between preview and repair, skip it and report it.

### Database-Changing Repairs

Database-changing image repairs are not part of the first implementation, but the design requires this invariant:

- before any command updates image references in `games`, `game_assets`, or description HTML, create a verified database backup;
- if backup fails, cancel repair;
- changed rows must be counted and logged.

This invariant will apply to a future portable path normalization command.

## Frontend Design

Extend the Maintenance page without adding a new top-level route.

### Health Summary

Add a compact image-health summary near the existing maintenance media panels:

- total cached images;
- orphan files;
- missing references;
- legacy import paths;
- duplicate file-name groups;
- oversized files.

Each metric should link to the relevant existing detail:

- missing/C drive/Playnite refs -> image audit detail;
- missing cover/artwork -> metadata/artwork repair panels;
- orphan/oversized/duplicates -> cache health detail.

### Actions

Primary actions:

- `检查图片健康`;
- `预览孤儿图片隔离`;
- `移动孤儿图片到隔离区`.

Copy should make the safety boundary explicit:

- preview does not change files;
- quarantine moves files under app-data and does not permanently delete;
- database references are not rewritten in this first increment.

### Empty And Healthy State

If no orphan, missing, oversized, or external legacy issues are found, show a calm healthy state. Current `playnite-import` paths under `app-data/images` should not make the page look broken; they should be described as legacy naming that can be normalized later.

## Data Safety

- The report command is read-only.
- Quarantine only moves files already proven unreferenced by database image fields, descriptions, and media assets.
- Quarantine target stays under the same `app-data` root.
- No real game installation folders are scanned or modified.
- No permanent deletion in the first increment.
- No database rows are changed by the first increment.
- Future database-changing repair commands must create a verified database backup first.

## Performance

The current real data set has 23445 image files and 41754 image references. The scanner should avoid per-game `list_game_assets` loops where practical.

Implementation guidance:

- collect references through SQL queries and one pass over `app-data/images`;
- normalize path keys once;
- store referenced paths in a `HashSet`;
- limit detailed samples;
- return aggregate counts even when samples are truncated.

## Testing Plan

Rust tests:

- image health report counts missing refs, C drive refs, Playnite refs, orphan files, duplicate file-name groups, and oversized files;
- `playnite-import` files under `app-data/images` are classified as legacy app-data import refs rather than missing files;
- orphan quarantine moves only unreferenced files and preserves referenced files;
- quarantine writes a manifest;
- missing or empty images directory returns a valid zero report;
- cleanup/quarantine never targets files outside `app-data/images`.

Node/source tests:

- Maintenance UI exposes image-health summary labels and safety copy;
- quarantine action uses preview/confirm wording and does not present permanent delete text;
- existing image audit filters still show missing, C drive, and Playnite categories.

Validation commands:

- `cargo test -q image_health --manifest-path src-tauri/Cargo.toml`;
- `cargo test -q asset --manifest-path src-tauri/Cargo.toml`;
- `npm run typecheck`;
- a focused Node test group for Maintenance image health.

Manual smoke:

- open Maintenance in the installed app;
- run image health check;
- verify current real library reports zero missing local files and zero orphans if the current data state remains unchanged;
- verify legacy `playnite-import` paths are not presented as data loss;
- do not run quarantine on real data unless preview shows candidates and a manual backup exists.

## Acceptance Criteria

1. Maintenance exposes a single image-health summary covering reference issues and cache file health.
2. Health report includes missing references, legacy paths, orphan files, duplicate file names, oversized files, and missing artwork counts.
3. Report generation is read-only.
4. Orphan cleanup is quarantine-based, not permanent deletion.
5. Quarantine produces a manifest and preserves relative paths.
6. Existing image audit and artwork repair entry points remain usable.
7. Tests cover report classification and quarantine safety.
8. The real installed library can be checked without modifying `app-data`.

## Spec Self-Review

- No placeholders remain.
- The first implementation is intentionally limited to read-only health reporting and quarantine-based orphan handling.
- Risky database path rewriting is designed as a future increment and guarded by a database-backup invariant.
- The design matches the current real data observation: images are present, while legacy import path noise remains.
