# Diagnostic Export Design

Date: 2026-06-21

## Context

MikaVN Library is now a real daily-use Windows app installed at `E:\MikaVN Library`, with app data under `E:\MikaVN Library\app-data`.

The current real data set is large enough that future support work needs fast, repeatable evidence instead of manual screenshots and path-by-path descriptions:

- 4456 games;
- 17738 media asset records;
- 23445 image cache files;
- SQLite `quick_check` has been verified as `ok`.

The app already has useful diagnostic pieces:

- `get_app_data_diagnostics` reports app-data, database, image, log, backup, metadata, image-reference, and path health;
- diagnostic logs are stored locally and previewed through Settings with redaction;
- Maintenance shows data paths, cache cleanup preview, image-reference audit, image-health report, and backup cleanup;
- ZIP support already exists for library archive export/import.

The missing piece is a single safe export action. When startup, update, image loading, or metadata maintenance fails, the user should be able to press one button and get a small diagnostic package that can be shared for investigation.

## Goals

1. Add a local diagnostic package export that creates a ZIP file from existing health and log data.
2. Keep the export read-only with respect to the real library: no database changes, no game-folder access, no image-cache moves, no save-backup access beyond directory counts.
3. Exclude full private data by default:
   - no full `mikavn.db`;
   - no image files;
   - no game install folders;
   - no save-backup contents;
   - no library archive contents.
4. Redact sensitive path/user/token material before writing diagnostic text into the package.
5. Add an obvious Maintenance action: `导出诊断包`.
6. Make the exported path easy to reveal or copy after completion.
7. Cover the behavior with backend and source-level frontend tests before implementation.

## Non-Goals

- No automatic upload.
- No cloud sharing or GitHub issue creation.
- No full database export.
- No screenshot capture.
- No background scheduled diagnostics.
- No destructive cleanup.
- No repair action in the diagnostic-export increment.

## Recommended Approach

Add a narrow diagnostic export service that composes existing diagnostics and log-preview behavior, writes a temporary staging directory under app-data, zips only generated diagnostic text files, and deletes the staging directory after export.

Default export target:

- `app-data/diagnostic-exports/mikavn-diagnostics-YYYYMMDD-HHMMSS.zip`

The command should return a small report:

- `path`;
- `fileName`;
- `sizeBytes`;
- `createdAt`;
- `includedFiles`;
- `warnings`.

The Maintenance page should call the command and show a success message with copy/open actions through existing `revealPath` and clipboard helpers.

This is safer than asking the user to pick paths and safer than collecting raw files. The package is deterministic, small, and generated from already-redacted summaries.

## Alternatives Considered

1. Add a button that opens the logs folder only.
   - Benefit: very small change.
   - Cost: still requires manual selection and does not include database/image health summaries.
   - Decision: reject as insufficient.

2. Export the full database plus logs.
   - Benefit: easiest for deep debugging.
   - Cost: leaks private library data and creates large packages.
   - Decision: reject. Full database sharing must remain an explicit separate user action, not a support default.

3. Let the user choose every included section.
   - Benefit: flexible.
   - Cost: more UI and more ways to accidentally omit useful evidence.
   - Decision: defer. Start with a fixed safe package.

## Backend Design

### Command

Add a Tauri command:

- `export_diagnostic_package() -> DiagnosticExportReport`

Rust shape:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportReport {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub included_files: Vec<String>,
    pub warnings: Vec<String>,
}
```

The command should resolve `AppPaths` from the app handle and call a testable helper:

- `export_diagnostic_package_with_paths(paths: &AppPaths, data_dir_source: String)`.

### Package Contents

The ZIP should contain only generated files:

- `manifest.json`
  - package version;
  - created time;
  - app-data source;
  - included file names;
  - explicit exclusions.
- `diagnostics.json`
  - serialized `AppDataDiagnostics`, with redacted path-like strings.
- `summary.md`
  - human-readable summary for quick inspection.
- `logs-preview.json`
  - recent `LogRecord` entries, using existing redacted previews.
- `environment.json`
  - application version from Tauri package metadata if available;
  - platform label such as `windows`;
  - export schema version.

The ZIP must not contain:

- `mikavn.db`;
- `*.db`, `*.sqlite`, `*.sqlite3`;
- files from `app-data/images`;
- files from `app-data/save-backups`;
- files from game install folders;
- raw unredacted log files.

### Redaction

Every string written into package files should pass through a shared redaction helper before serialization or markdown output.

The helper should reuse `logger::redact_sensitive_text` for:

- Windows user profile names;
- API-like keys and tokens;
- password/token-looking values.

For structured diagnostics, the implementation should recursively redact JSON string values before writing `diagnostics.json`.

### File Handling

1. Create `app-data/diagnostic-exports` if missing.
2. Create a unique staging directory under `app-data/cache/diagnostic-export-staging/<uuid>`.
3. Write generated JSON/Markdown files into staging.
4. Create the ZIP under `app-data/diagnostic-exports`.
5. Add only the generated staging files to ZIP.
6. Remove staging on success.
7. On failure, best-effort remove staging and return a normal app error.

The command writes only to the export and staging directories. It reads only existing diagnostics/log previews and directory metadata.

## Frontend Design

Extend the Maintenance data panel because it already owns local data location, diagnostics, backup cleanup, and cache cleanup.

### API and Types

Add `DiagnosticExportReport` to `src/types/archive.ts` and an API method:

- `api.exportDiagnosticPackage()`.

Browser/mock mode should return a representative fake report so source tests and preview mode continue to work.

### UI Placement

Add an action in `MaintenanceDataLocationPanel` near the data-location header:

- `导出诊断包`

Button behavior:

1. Disable while exporting.
2. Call `api.exportDiagnosticPackage`.
3. Show success message:
   - exported file name;
   - size;
   - short reminder that no database/images/save files were included.
4. Offer existing copy/reveal path behavior through the message flow or nearby action.

The UI copy should avoid panic language. It should frame the package as support evidence:

- `诊断包已导出：...`
- `包含自检摘要和脱敏日志预览，不包含完整数据库、图片缓存或存档文件。`

### Error Handling

If export fails:

- show the normalized app error;
- keep existing diagnostics visible;
- do not clear path information;
- do not retry automatically.

## Testing Plan

### Rust Unit Tests

Add tests around the testable helper:

1. `diagnostic_export_includes_generated_files_only`
   - create a temporary app-data root;
   - create a small SQLite database;
   - create sample image/save/log files;
   - export package;
   - inspect ZIP entries;
   - assert expected generated entries exist;
   - assert no database, image, or save file entries exist.

2. `diagnostic_export_redacts_log_preview`
   - write a diagnostic log containing token/password/user-profile material;
   - export package;
   - read `logs-preview.json` from ZIP;
   - assert secrets and raw user profile names are absent;
   - assert `[redacted]` appears.

3. `diagnostic_export_summary_reports_core_counts`
   - create a temporary database with at least one game row if needed by existing migration helpers;
   - export package;
   - read `summary.md`;
   - assert it mentions database `quick_check`, game count, image file count, and warning count.

### Frontend Source Tests

Add or extend a Node source test:

1. API exposes `exportDiagnosticPackage`.
2. Maintenance data panel wires an `onExportDiagnosticPackage` prop to a visible `导出诊断包` button.
3. The data-action hook sets loading state and emits a success message mentioning that the package excludes full database/images/save files.

### Verification Commands

Run after implementation:

```powershell
$env:CARGO_BUILD_JOBS='1'; $env:CARGO_INCREMENTAL='0'; cargo test -q diagnostic --manifest-path src-tauri\Cargo.toml
npm run typecheck
npm run build
```

If resources allow:

```powershell
npm run smoke:large
```

### Real Data Safety Check

After implementation, re-check the installed app data read-only:

```powershell
sqlite3 "E:\MikaVN Library\app-data\mikavn.db" "PRAGMA quick_check; SELECT COUNT(*) FROM games; SELECT COUNT(*) FROM game_assets;"
```

The expected safety invariant is:

- quick check remains `ok`;
- game and asset counts are unchanged;
- export creates files only under `E:\MikaVN Library\app-data\diagnostic-exports` and temporary staging under app-data cache.

## Acceptance Criteria

1. Maintenance has a visible `导出诊断包` action.
2. The action creates a ZIP under app-data diagnostic exports.
3. The ZIP contains `manifest.json`, `diagnostics.json`, `summary.md`, `logs-preview.json`, and `environment.json`.
4. The ZIP does not contain full database, image cache files, save backups, game folders, or raw logs.
5. Sensitive strings in generated files are redacted.
6. The UI reports the exported path and makes it easy to reveal or copy.
7. Rust diagnostic export tests pass.
8. Frontend source/type/build checks pass.
9. Real installed data remains unchanged except for the new diagnostic export artifact.

## Spec Self-Review

- No placeholders remain.
- Scope is limited to export and UI entry; repair and upload are explicitly out of scope.
- Data safety boundaries are explicit.
- The implementation is testable without touching the real installed data.
- The design reuses existing diagnostics, logs, path, and ZIP patterns instead of adding a parallel support subsystem.
