# MikaVN Library

MikaVN Library is a Windows-first, local-first Galgame / Visual Novel library manager built with Tauri, React, Rust, and SQLite.

[![CI](https://github.com/apaidedie/mikavn-library/actions/workflows/ci.yml/badge.svg)](https://github.com/apaidedie/mikavn-library/actions/workflows/ci.yml)

The project is designed as a personal daily-use desktop app: install it once, keep the library data on the local machine, manage game records and media safely, and update without moving or deleting real game folders.

## Current Status

- Version: `0.1.7`
- Primary platform: Windows x64
- Main install target used by local smoke tests: `E:\MikaVN Library`
- Local data model: SQLite database plus app-managed images, logs, backups, task records, and cache under app data
- Latest local installer artifact:
  `output/release/0.1.7-windows-x64/MikaVN.Library_0.1.7_x64-setup.exe`

The app has been tuned for large local libraries. The latest large-library smoke run covered 4,500 preview records and verified list load, detail switching, quick search, and advanced search timings within the current performance budgets.

## What It Does

### Library Management

- Maintains local game records with title, aliases, developer / brand, publisher, release date, notes, rating, play status, age rating, tags, genres, paths, and external IDs.
- Supports manual add, edit, and delete-record-only operations.
- Provides library list, grid, detail, collection, saved search, and advanced search surfaces.
- Includes filters for status, tags, developer / brand / publisher, collections, favorites, hidden entries, metadata gaps, media gaps, path health, and external IDs.
- Supports bulk actions for the current filtered set, including play status, favorite / hidden flags, tags, and collection membership.

### Daily Play Workflow

- Supports multiple launch profiles per game.
- Can launch direct executables, shortcuts, Locale Emulator-style wrappers, custom commands, and elevated processes.
- Records play sessions with start time, end time, duration, profile, and exit status.
- Tracks total play time, recent play time, status, notes, and reports.
- Provides per-game local notes for progress, patch notes, walkthrough state, and personal comments.

### Metadata And Matching

- Searches and applies metadata from VNDB, DLsite, and FANZA.
- Stores normalized metadata sources and external IDs while preserving compatibility fields on the `games` table.
- Supports metadata field locks so user-edited fields are not overwritten by default.
- Provides batch metadata matching with queue filters, missing-provider shortcuts, candidate review, result filters, and confirmed writeback.
- Registers Bangumi and YMGal external IDs for local records, filters, diagnostics, and duplicate audits. Full Bangumi / YMGal search providers remain future work.

### Images And Media

- Manages cover, banner, background, screenshot, and description images.
- Imports local images and downloads remote image assets into app-managed cache.
- Lets users select primary artwork without deleting real game files.
- Audits image references for missing files, C-drive leftovers, Playnite-style legacy paths, content-type mismatches, oversized cache files, duplicates, and orphaned app-cache files.
- Keeps cleanup quarantine-first where appropriate.
- Limits initial rendering of large image groups and description images to keep detail pages responsive.

### Saves And Backups

- Registers one or more save paths per game.
- Creates manual save backups under app data.
- Supports optional automatic save backups before launch and after game exit.
- Provides restore preview, normal restore with protection backup, and explicit mirror restore for high-risk replacement workflows.
- Includes manual SQLite database backup, startup database backup, update-protection backup, restore scheduling, and old-backup cleanup.

### Tasks, Reports, And Maintenance

- Runs long operations through task records with progress, logs, retry, cancellation, elapsed time, and estimated remaining time where available.
- Shows task attention states on Dashboard, Maintenance, Settings, Saves, Reports, and game detail notices.
- Exports play reports as Markdown.
- Exports diagnostic packages with redacted summaries and health reports.
- Includes duplicate game merge assistance, tag maintenance, image health maintenance, data diagnostics, and archive workflows.

### Archives And Updates

- Exports library archives as directories or ZIP files with manifest, database backup, optional images, and optional save backups.
- Previews archives before import or restore.
- Imports archives safely by skipping conflicts rather than replacing the live database.
- Performs full archive restore only through a protected next-start restore path.
- Uses Tauri updater configuration for public GitHub Releases. Public updater artifacts require the Tauri updater private key.

## Safety Model

MikaVN Library is intentionally conservative around user data.

- Deleting a game removes only the MikaVN database record. It does not delete the real game directory.
- Removing a collection removes only collection records and links.
- Removing a game from a collection removes only the collection link.
- Removing an asset removes the asset record and compatibility reference. It does not delete the real game install folder.
- Scanner merge and replace actions update MikaVN database records only. They do not move, rename, overwrite, or delete real game files.
- Save restore creates protection backups before writing to registered save directories.
- Database restore and archive restore are staged and applied on the next startup after protection backup.
- Diagnostic exports do not include full raw databases, image caches, save-backup contents, raw logs, API keys, or real game folders.
- Error and diagnostic messages redact common secrets and Windows user-profile paths.

## Data Locations

Installed builds prefer app-adjacent portable data when writable:

```text
E:\MikaVN Library\
  mikavn-library.exe
  app-data\
    mikavn.db
    images\
    cache\
    logs\
    save-backups\
    database-backups\
    diagnostic-exports\
```

This keeps the application, database, image cache, backups, logs, and diagnostics together for personal use and easier migration. If the app-adjacent directory is not writable, the app can fall back to the platform app-data location.

Do not place real game installations inside `app-data/`. Register real game folders through library roots, manual records, or scanner import.

## Install For Personal Use

1. Close MikaVN Library if it is already running.
2. Run the latest local installer:

   ```text
   output/release/0.1.7-windows-x64/MikaVN.Library_0.1.7_x64-setup.exe
   ```

3. Install to:

   ```text
   E:\MikaVN Library
   ```

4. Start the app.
5. In Settings, confirm the local data directory and backup section.
6. Add library roots or manually add games.
7. Use Scanner preview before importing candidates.

The local installer is unsigned unless it has been explicitly signed with a trusted Windows code-signing certificate. Windows SmartScreen warnings are expected for unsigned personal builds.

## In-App Updates

The app is configured for public GitHub Release metadata:

```text
https://github.com/apaidedie/mikavn-library/releases/latest/download/latest.json
```

Public updater releases must include:

- NSIS installer
- installer `.sig`
- `latest.json`
- matching version and digest metadata

Local personal builds can be created without updater signing secrets by using `npm run tauri:build:local`. These local builds are installable, but they are not complete updater release artifacts.

## Development Setup

Requirements:

- Node.js compatible with the checked-in lockfile
- npm
- Rust toolchain
- Windows SDK tools for release signing checks
- Tauri prerequisites for Windows desktop builds

Install dependencies:

```bash
npm install
```

Run the browser preview:

```bash
npm run dev
```

The browser preview uses a localStorage mock store, so most UI work can be done without running the Rust desktop backend.

Run the Tauri app in development:

```bash
npm run tauri:dev
```

## Build Commands

Frontend production build:

```bash
npm run build
```

Unsigned local Windows installer, suitable for personal testing:

```bash
npm run tauri:build:local
```

Updater-signed public release build:

```bash
npm run tauri:build
```

`npm run tauri:build` requires `TAURI_SIGNING_PRIVATE_KEY` when updater artifacts are enabled. Use the local build command when the updater private key is not available.

## Verification Commands

Useful focused checks:

```bash
npm run typecheck
npm run test:data-safety
npm run test:library-performance
npm run test:game-detail-actions
npm run test:diagnostic-export
npm run test:maintenance-image-health
npm run smoke:large
```

Release-oriented checks:

```bash
npm run release:check
npm run release:validate:core
npm run smoke:browser
npm run smoke:install
npm run smoke:portable-data
npm run smoke:real-data:readonly
npm run smoke:real-install:update
npm run smoke:desktop
```

Rust checks:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Signing checks:

```bash
npm run release:signing:certificate:check
npm run release:signing:check
```

Public Windows releases should be signed with a trusted OV / EV code-signing certificate or trusted signing service. See `docs/CODE_SIGNING.md`.

## Verification Snapshot

Latest mature V1 verification policy is tracked here so release checks have one stable documentation anchor.

- The current repository test count and Rust tests are part of the release acceptance record.
- Rust quality gates include `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test`.
- Backend diagnostics coverage includes `get_app_data_diagnostics` and `cleanup_old_database_backups`.
- Large-library checks seed 4500 browser-preview records and cover list rendering, topbar quick search, detail switching, and advanced search.
- Required core release commands include `npm run release:check:strict`, `npm run release:validate:strict`, `npm run release:validate:core`, `npm run test:release-scripts`, `npm run test:playwright-scripts`, `npm run test:diagnostic-export`, `npm run test:data-safety`, `npm run test:maintenance-image-health`, `npm run test:library-performance`, `npm run smoke:large`, `npm run smoke:install`, `npm run smoke:portable-data`, `npm run smoke:real-data:readonly`, `npm run tauri:build`, `npm run smoke:desktop`, and `npm run release:handoff:check`.
- Desktop smoke artifacts use isolated data roots such as `output/desktop-smoke/run-*/isolated-app-data`.
- `npm run smoke:real-install:update` is the explicit overwrite check for the real `E:\MikaVN Library` install. It refuses to run while the app is active, creates a verified database backup under `manual-install-smoke`, runs the installer against the real install directory, relaunches the app, and verifies data survived.
- Public release handoff should record a `Lower-version updater rehearsal` with `previous version`, `current version`, `Evidence: lower-version-updater-rehearsal.json`, and `databaseQuickCheck`.
- Public release drift checks compare each GitHub Release asset, SHA256 digests, `latest.json`, and `MANUAL_RISK_PASS_CHECKLIST.md` against the local handoff.

## Project Layout

```text
src/
  app/                 React app shell, routing, navigation, app-wide state
  components/ui/       Shared UI primitives
  pages/               Feature pages: Library, Dashboard, Settings, Tasks, etc.
  services/            Frontend API wrappers, updater, dialogs, browser mocks
  types/               Shared TypeScript types
  utils/               Formatting, error handling, image URI helpers

src-tauri/
  src/commands/        Tauri command boundary
  src/db/              Database setup, models, migrations, compatibility facade
  src/repositories/    SQL-oriented persistence modules
  src/services/        Domain workflows and filesystem/task orchestration
  capabilities/        Tauri permission capabilities
  tauri.conf.json      Desktop app, bundle, updater, and security config

scripts/
  desktop-smoke/       Windows install, portable data, real install, desktop smoke
  playwright/          Browser and large-library smoke infrastructure
  release/             Release metadata, build, handoff, signing, validation checks
  *.test.cjs           Source-level behavior, safety, and performance tests

docs/
  CODE_SIGNING.md
  RELEASE_NOTES_0.1.7.md
  superpowers/         Design specs and implementation plans

output/
  README.md
  release/             Local release handoff artifacts, ignored by Git
```

Generated directories such as `dist/`, `src-tauri/target/`, Playwright reports, desktop-smoke outputs, and temporary release artifacts are ignored and can be regenerated.

## Architecture Notes

The app keeps a clear split between:

- React UI and deterministic page models in `src/`
- Tauri command wrappers in `src-tauri/src/commands/`
- Rust service workflows in `src-tauri/src/services/`
- SQL persistence in `src-tauri/src/repositories/`
- SQLite and app-data handling in `src-tauri/src/db/`

The frontend talks to backend commands through `src/services/api.ts`. Browser preview falls back to mock stores so UI, page models, and many safety checks remain testable without the desktop runtime.

The Rust side keeps compatibility fields for stable UI behavior while normalized tables support assets, tags, collections, metadata sources, external IDs, launch profiles, play sessions, save paths, tasks, logs, and backups.

## Performance Principles

Large-library responsiveness is treated as a core requirement.

- Common library filters are pushed into SQLite before row mapping.
- Text filters are debounced.
- Large lists use bounded render windows and load-more behavior.
- Current selection stays pinned even when outside the initial render window.
- Cover images default to lazy loading and async decoding.
- Navigation thumbnails use low fetch priority.
- Detail background art is lower priority than the primary cover.
- Description images and asset groups render in bounded batches with opt-in expansion.
- Detail panels avoid stale async updates after switching games.
- Collection membership on game detail uses direct membership queries rather than per-collection scans.
- Play-session history loads only when the records tab is active.

## Metadata Providers

VNDB, DLsite, and FANZA are used through public endpoints or public pages only.

- VNDB uses `https://api.vndb.org/kana/vn` and prefers Japanese titles when available.
- DLsite supports RJ / VJ lookup and public search modes.
- FANZA supports public search and detail lookup.
- VNDB pages are inspected for DLsite / FANZA IDs when useful.
- Search responses are cached for 24 hours.
- Detail responses are cached for 7 days.
- Remote cover downloads are capped and MIME-checked.
- Metadata apply skips locked user-edited fields unless explicit override is enabled.

The app does not log in to provider accounts, bypass restrictions, or fetch paid content.

## AI Recognition

AI image recognition uses OpenAI-compatible chat completions. Configuration can come from environment variables or local app settings.

```powershell
$env:MIKAVN_AI_API_KEY = "your local key"
$env:MIKAVN_AI_BASE_URL = "https://api.example.com/v1"
$env:MIKAVN_AI_MODEL = "gpt-4o-mini"
```

Images are resized before upload. Do not commit real API keys, model secrets, proxy secrets, or diagnostic logs containing credentials.

## Release Artifacts

Local release files are copied under:

```text
output/release/<version>-windows-x64/
```

For the current local build, the useful files are:

```text
MikaVN.Library_0.1.7_x64-setup.exe
mikavn-library.exe
SHA256SUMS.txt
LOCAL_BUILD_NOTE.txt
```

Public release handoff can additionally include updater signatures, `latest.json`, validation reports, and manual risk checklists after running the public release pipeline.

## Documentation Index

- `docs/README.md`: documentation navigation
- `docs/CODE_SIGNING.md`: Windows Authenticode and updater signing guidance
- `docs/RELEASE_NOTES_0.1.7.md`: current release notes
- `RELEASE_CHECKLIST.md`: release preparation checklist
- `scripts/README.md`: script ownership and generated-artifact conventions
- `ARCHITECTURE.md`: architecture overview
- `DATA_MODEL.md`: data model notes
- `SECURITY.md`: security policy
- `PRIVACY.md`: privacy notes

## Current Boundaries

Not included yet:

- Cloud sync
- WebDAV sync
- Plugin system
- Full Bangumi / YMGal search and detail providers
- Rich per-file save diff viewers beyond current restore preview summaries
- Normalized log indexing beyond current task log preview and pruning
- Full public Windows release trust without a trusted code-signing certificate

These are left out intentionally so the local Windows library core remains stable, predictable, and safe for daily personal use.
