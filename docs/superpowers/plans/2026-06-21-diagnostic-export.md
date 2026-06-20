# Diagnostic Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Maintenance action that exports a small redacted diagnostic ZIP without including the real database, images, save backups, or game folders.

**Architecture:** Add a focused Rust `diagnostic_export` service that composes existing app-data diagnostics and redacted diagnostic log previews, stages generated JSON/Markdown files, and zips only those generated files. Expose it through the existing diagnostics command module and wire the Maintenance data panel through the existing API/mock/action-hook patterns.

**Tech Stack:** Tauri v2, Rust, `zip`, `serde_json`, React, TypeScript, Node source tests.

---

## File Structure

- Create `src-tauri/src/services/diagnostic_export.rs`
  - Owns `DiagnosticExportReport`, export helpers, JSON redaction, ZIP writing, and summary generation.
- Modify `src-tauri/src/services/mod.rs`
  - Registers the new service module.
- Modify `src-tauri/src/services/diagnostics.rs`
  - Makes `get_app_data_diagnostics_with_paths` visible to sibling services as `pub(crate)`.
- Modify `src-tauri/src/services/logs.rs`
  - Makes `list_diagnostic_logs_from_paths` visible to sibling services as `pub(crate)`.
- Modify `src-tauri/src/services/diagnostics/tests.rs`
  - Adds Rust tests for generated ZIP contents, redaction, and summary output.
- Modify `src-tauri/src/commands/diagnostics.rs`
  - Adds the Tauri command wrapper.
- Modify `src-tauri/src/lib.rs`
  - Registers `commands::diagnostics::export_diagnostic_package`.
- Modify `src/types/archive.ts`
  - Adds `DiagnosticExportReport`.
- Modify `src/services/api.ts`
  - Adds `api.exportDiagnosticPackage`.
- Modify `src/services/mockStoreDiagnostics.ts`
  - Adds browser/mock response.
- Modify `src/pages/Maintenance/useMaintenanceDataActions.ts`
  - Adds loading state and action handler.
- Modify `src/pages/Maintenance/MaintenanceDataLocationPanel.tsx`
  - Adds the button and disabled/loading behavior.
- Modify `src/pages/Maintenance/MaintenancePageContent.tsx`
  - Wires the new action into the panel.
- Create `scripts/diagnostic-export.test.cjs`
  - Adds frontend source tests for command/API/UI wiring.
- Modify `package.json`
  - Adds `test:diagnostic-export`.

---

### Task 1: Backend Diagnostic Export Tests

**Files:**
- Modify: `src-tauri/src/services/diagnostics/tests.rs`

- [ ] **Step 1: Write failing Rust tests**

Append these tests to `src-tauri/src/services/diagnostics/tests.rs`. They intentionally reference the not-yet-created service:

```rust
use std::io::Read;
use zip::ZipArchive;

use crate::services::diagnostic_export::export_diagnostic_package_with_paths;

fn zip_entry_names(path: &std::path::Path) -> Vec<String> {
    let file = std::fs::File::open(path).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let mut names = Vec::new();
    for index in 0..archive.len() {
        names.push(archive.by_index(index).unwrap().name().to_string());
    }
    names.sort();
    names
}

fn read_zip_entry(path: &std::path::Path, name: &str) -> String {
    let file = std::fs::File::open(path).unwrap();
    let mut archive = ZipArchive::new(file).unwrap();
    let mut entry = archive.by_name(name).unwrap();
    let mut content = String::new();
    entry.read_to_string(&mut content).unwrap();
    content
}

#[test]
fn diagnostic_export_includes_generated_files_only() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-export-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    std::fs::create_dir_all(paths.images()).unwrap();
    std::fs::create_dir_all(paths.save_backups().join("game-1")).unwrap();
    std::fs::write(paths.images().join("cover.jpg"), b"image").unwrap();
    std::fs::write(paths.save_backups().join("game-1").join("slot.dat"), b"save").unwrap();
    std::fs::write(paths.logs().join("mikavn.log"), "startup ok").unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch(
        r#"
        PRAGMA user_version = 13;
        CREATE TABLE games (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          original_title TEXT,
          developer TEXT,
          publisher TEXT,
          release_date TEXT,
          description TEXT,
          tags TEXT,
          cover_image TEXT,
          banner_image TEXT,
          background_image TEXT,
          install_path TEXT,
          executable_path TEXT,
          play_status TEXT NOT NULL DEFAULT 'unplayed',
          rating INTEGER,
          notes TEXT,
          source TEXT,
          source_id TEXT,
          vndb_id TEXT,
          dlsite_id TEXT,
          fanza_id TEXT,
          favorite INTEGER NOT NULL DEFAULT 0,
          hidden INTEGER NOT NULL DEFAULT 0,
          path_status TEXT NOT NULL DEFAULT 'unknown',
          last_path_check_at TEXT,
          play_time_minutes INTEGER NOT NULL DEFAULT 0,
          last_played_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE game_assets (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, title TEXT, source_url TEXT, is_primary INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE metadata_sources (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, url TEXT, fetched_at TEXT NOT NULL, raw_json TEXT NOT NULL);
        CREATE TABLE external_ids (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        INSERT INTO games (id, title, cover_image, play_status, created_at, updated_at) VALUES ('game-1', 'Diagnostic VN', 'images/cover.jpg', 'unplayed', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z');
        "#,
    ).unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let names = zip_entry_names(std::path::Path::new(&report.path));

    assert_eq!(names, vec![
        "diagnostics.json".to_string(),
        "environment.json".to_string(),
        "logs-preview.json".to_string(),
        "manifest.json".to_string(),
        "summary.md".to_string(),
    ]);
    assert!(!names.iter().any(|name| name.ends_with(".db")));
    assert!(!names.iter().any(|name| name.contains("cover.jpg")));
    assert!(!names.iter().any(|name| name.contains("slot.dat")));
    assert!(report.size_bytes > 0);
    assert!(report.path.contains("diagnostic-exports"));
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn diagnostic_export_redacts_log_preview() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-redact-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch("PRAGMA user_version = 13; CREATE TABLE games (id TEXT PRIMARY KEY, title TEXT NOT NULL, play_status TEXT NOT NULL DEFAULT 'unplayed', favorite INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, path_status TEXT NOT NULL DEFAULT 'unknown', play_time_minutes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE game_assets (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE metadata_sources (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, fetched_at TEXT NOT NULL, raw_json TEXT NOT NULL); CREATE TABLE external_ids (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);").unwrap();
    std::fs::write(
        paths.logs().join("mikavn.log"),
        r"API_KEY=secret password=hunter2 token:abc C:\Users\alice\AppData\Roaming\MikaVN\mikavn.db",
    ).unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let logs = read_zip_entry(std::path::Path::new(&report.path), "logs-preview.json");
    let diagnostics = read_zip_entry(std::path::Path::new(&report.path), "diagnostics.json");

    assert!(logs.contains("[redacted]"));
    assert!(!logs.contains("secret"));
    assert!(!logs.contains("hunter2"));
    assert!(!logs.contains("token:abc"));
    assert!(!logs.contains("alice"));
    assert!(!diagnostics.contains("alice"));
    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn diagnostic_export_summary_reports_core_counts() {
    let root = std::env::temp_dir().join(format!("mikavn-diagnostic-summary-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.join("app-data")).unwrap();
    let conn = Connection::open(paths.database()).unwrap();
    conn.execute_batch("PRAGMA user_version = 13; CREATE TABLE games (id TEXT PRIMARY KEY, title TEXT NOT NULL, play_status TEXT NOT NULL DEFAULT 'unplayed', favorite INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, path_status TEXT NOT NULL DEFAULT 'unknown', play_time_minutes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE game_assets (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE metadata_sources (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, fetched_at TEXT NOT NULL, raw_json TEXT NOT NULL); CREATE TABLE external_ids (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); INSERT INTO games (id, title, created_at, updated_at) VALUES ('game-1', 'Diagnostic VN', '2026-06-21T00:00:00Z', '2026-06-21T00:00:00Z');").unwrap();

    let report = export_diagnostic_package_with_paths(&paths, "test".to_string()).unwrap();
    let summary = read_zip_entry(std::path::Path::new(&report.path), "summary.md");

    assert!(summary.contains("quick_check"));
    assert!(summary.contains("ok"));
    assert!(summary.contains("游戏数量：1"));
    assert!(summary.contains("图片文件"));
    assert!(summary.contains("警告数量"));
    let _ = std::fs::remove_dir_all(root);
}
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
$env:CARGO_BUILD_JOBS='1'; $env:CARGO_INCREMENTAL='0'; cargo test -q diagnostic_export --manifest-path src-tauri\Cargo.toml
```

Expected: fail with an unresolved import or missing module for `crate::services::diagnostic_export`.

---

### Task 2: Backend Diagnostic Export Implementation

**Files:**
- Create: `src-tauri/src/services/diagnostic_export.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/services/diagnostics.rs`
- Modify: `src-tauri/src/services/logs.rs`
- Modify: `src-tauri/src/commands/diagnostics.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Expose existing testable helpers**

In `src-tauri/src/services/diagnostics.rs`, change:

```rust
fn get_app_data_diagnostics_with_paths(
```

to:

```rust
pub(crate) fn get_app_data_diagnostics_with_paths(
```

In `src-tauri/src/services/logs.rs`, change:

```rust
fn list_diagnostic_logs_from_paths(
```

to:

```rust
pub(crate) fn list_diagnostic_logs_from_paths(
```

- [ ] **Step 2: Add the service module registration**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod diagnostic_export;
```

near the existing `diagnostics` module.

- [ ] **Step 3: Implement the export service**

Create `src-tauri/src/services/diagnostic_export.rs`:

```rust
use std::fs;
use std::io::{Seek, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::db::DbResult;
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::{diagnostics, logs};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticManifest {
    app: &'static str,
    export_schema_version: i64,
    created_at: String,
    data_dir_source: String,
    included_files: Vec<String>,
    exclusions: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticEnvironment {
    app_version: String,
    platform: &'static str,
    export_schema_version: i64,
}

pub fn export_diagnostic_package(app: &AppHandle) -> DbResult<DiagnosticExportReport> {
    let resolution = AppPaths::resolve_from_app(app)?;
    let paths = AppPaths::from_root(resolution.root)?;
    export_diagnostic_package_with_version(
        &paths,
        resolution.source.as_str().to_string(),
        app.package_info().version.to_string(),
    )
}

pub(crate) fn export_diagnostic_package_with_paths(
    paths: &AppPaths,
    data_dir_source: String,
) -> DbResult<DiagnosticExportReport> {
    export_diagnostic_package_with_version(paths, data_dir_source, "test".to_string())
}

fn export_diagnostic_package_with_version(
    paths: &AppPaths,
    data_dir_source: String,
    app_version: String,
) -> DbResult<DiagnosticExportReport> {
    let created_at = Utc::now().to_rfc3339();
    let stamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let export_dir = paths.root().join("diagnostic-exports");
    let staging_dir = paths
        .cache()
        .join("diagnostic-export-staging")
        .join(Uuid::new_v4().to_string());
    fs::create_dir_all(&export_dir)?;
    fs::create_dir_all(&staging_dir)?;

    let result = write_diagnostic_package(
        paths,
        &data_dir_source,
        &app_version,
        &created_at,
        &export_dir.join(format!("mikavn-diagnostics-{stamp}.zip")),
        &staging_dir,
    );
    let _ = fs::remove_dir_all(&staging_dir);
    result
}

fn write_diagnostic_package(
    paths: &AppPaths,
    data_dir_source: &str,
    app_version: &str,
    created_at: &str,
    target: &Path,
    staging_dir: &Path,
) -> DbResult<DiagnosticExportReport> {
    let diagnostics = diagnostics::get_app_data_diagnostics_with_paths(paths, data_dir_source.to_string())?;
    let logs = logs::list_diagnostic_logs_from_paths(paths, Some(8))?;
    let included_files = vec![
        "manifest.json".to_string(),
        "diagnostics.json".to_string(),
        "summary.md".to_string(),
        "logs-preview.json".to_string(),
        "environment.json".to_string(),
    ];
    let manifest = DiagnosticManifest {
        app: "MikaVN Library",
        export_schema_version: 1,
        created_at: created_at.to_string(),
        data_dir_source: data_dir_source.to_string(),
        included_files: included_files.clone(),
        exclusions: vec![
            "full database",
            "image cache files",
            "save backup contents",
            "game installation folders",
            "raw log files",
        ],
    };
    let environment = DiagnosticEnvironment {
        app_version: app_version.to_string(),
        platform: "windows",
        export_schema_version: 1,
    };

    write_redacted_json(staging_dir.join("manifest.json"), &manifest)?;
    write_redacted_json(staging_dir.join("diagnostics.json"), &diagnostics)?;
    write_redacted_text(staging_dir.join("summary.md"), &diagnostic_summary(&diagnostics))?;
    write_redacted_json(staging_dir.join("logs-preview.json"), &logs)?;
    write_redacted_json(staging_dir.join("environment.json"), &environment)?;
    zip_generated_files(staging_dir, target, &included_files)?;

    let metadata = fs::metadata(target)?;
    Ok(DiagnosticExportReport {
        path: logger::display_path(target),
        file_name: target
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("mikavn-diagnostics.zip")
            .to_string(),
        size_bytes: metadata.len(),
        created_at: created_at.to_string(),
        included_files,
        warnings: diagnostics.warnings,
    })
}

fn write_redacted_json(path: PathBuf, value: &impl Serialize) -> DbResult<()> {
    let mut json = serde_json::to_value(value)?;
    redact_json_value(&mut json);
    fs::write(path, serde_json::to_string_pretty(&json)?)?;
    Ok(())
}

fn write_redacted_text(path: PathBuf, value: &str) -> DbResult<()> {
    fs::write(path, logger::redact_sensitive_text(value))?;
    Ok(())
}

fn redact_json_value(value: &mut Value) {
    match value {
        Value::String(text) => *text = logger::redact_sensitive_text(text),
        Value::Array(items) => {
            for item in items {
                redact_json_value(item);
            }
        }
        Value::Object(map) => {
            for item in map.values_mut() {
                redact_json_value(item);
            }
        }
        _ => {}
    }
}

fn diagnostic_summary(diagnostics: &diagnostics::AppDataDiagnostics) -> String {
    format!(
        "# MikaVN Diagnostic Summary\n\n- 数据目录来源：{}\n- 数据库 quick_check：{}\n- 游戏数量：{}\n- 媒体资产：{}\n- 图片文件：{}\n- 日志文件：{}\n- 数据库备份：{}\n- 警告数量：{}\n",
        diagnostics.data_dir_source,
        diagnostics.database.quick_check.as_deref().unwrap_or("unknown"),
        diagnostics.database.game_count,
        diagnostics.database.asset_count,
        diagnostics.images.file_count,
        diagnostics.logs.file_count,
        diagnostics.database_backups.file_count,
        diagnostics.warnings.len()
    )
}

fn zip_generated_files(staging_dir: &Path, target: &Path, included_files: &[String]) -> DbResult<()> {
    let file = fs::File::create(target)?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for name in included_files {
        let path = staging_dir.join(name);
        writer.start_file(name, options)?;
        let bytes = fs::read(path)?;
        writer.write_all(&bytes)?;
    }
    finish_zip(&mut writer)?;
    Ok(())
}

fn finish_zip<W: Write + Seek>(writer: &mut ZipWriter<W>) -> DbResult<()> {
    writer.finish()?;
    Ok(())
}
```

- [ ] **Step 4: Add the Tauri command wrapper**

In `src-tauri/src/commands/diagnostics.rs`, extend the imports:

```rust
use crate::services::diagnostic_export::{self, DiagnosticExportReport};
```

Add the command:

```rust
#[tauri::command]
pub fn export_diagnostic_package(app: AppHandle) -> DbResult<DiagnosticExportReport> {
    diagnostic_export::export_diagnostic_package(&app)
}
```

- [ ] **Step 5: Register the command**

In `src-tauri/src/lib.rs`, add this inside `tauri::generate_handler![...]` near the other diagnostics commands:

```rust
commands::diagnostics::export_diagnostic_package,
```

- [ ] **Step 6: Run backend tests and verify GREEN**

Run:

```powershell
$env:CARGO_BUILD_JOBS='1'; $env:CARGO_INCREMENTAL='0'; cargo test -q diagnostic_export --manifest-path src-tauri\Cargo.toml
```

Expected: tests pass.

- [ ] **Step 7: Commit backend slice**

Run:

```powershell
git add src-tauri/src/services/diagnostic_export.rs src-tauri/src/services/mod.rs src-tauri/src/services/diagnostics.rs src-tauri/src/services/logs.rs src-tauri/src/services/diagnostics/tests.rs src-tauri/src/commands/diagnostics.rs src-tauri/src/lib.rs
git commit -m "feat: export redacted diagnostic package"
```

---

### Task 3: Frontend Source Test For API And Maintenance Wiring

**Files:**
- Create: `scripts/diagnostic-export.test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing source test**

Create `scripts/diagnostic-export.test.cjs`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('diagnostic export command is registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');
  const mock = fs.readFileSync('src/services/mockStoreDiagnostics.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::export_diagnostic_package/);
  assert.match(commands, /pub fn export_diagnostic_package/);
  assert.match(api, /exportDiagnosticPackage\(\)/);
  assert.match(api, /command<DiagnosticExportReport>\('export_diagnostic_package'/);
  assert.match(types, /export type DiagnosticExportReport/);
  assert.match(mock, /exportDiagnosticPackage\(\): Promise<DiagnosticExportReport>/);
});

test('maintenance data panel exposes safe diagnostic export action', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceDataLocationPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceDataActions.ts', 'utf8');
  const content = fs.readFileSync('src/pages/Maintenance/MaintenancePageContent.tsx', 'utf8');

  assert.match(panel, /导出诊断包/);
  assert.match(panel, /onExportDiagnosticPackage/);
  assert.match(panel, /diagnosticExportLoading/);
  assert.match(actions, /exportDiagnosticPackage/);
  assert.match(actions, /不包含完整数据库、图片缓存或存档文件/);
  assert.match(content, /onExportDiagnosticPackage=\{dataActions\.exportDiagnosticPackage\}/);
});
```

Add this script to `package.json`:

```json
"test:diagnostic-export": "node --test scripts/diagnostic-export.test.cjs",
```

- [ ] **Step 2: Run source test and verify RED**

Run:

```powershell
npm run test:diagnostic-export
```

Expected: fail because frontend types/API/UI wiring are missing.

---

### Task 4: Frontend API, Mock, Hook, And UI Implementation

**Files:**
- Modify: `src/types/archive.ts`
- Modify: `src/services/api.ts`
- Modify: `src/services/mockStoreDiagnostics.ts`
- Modify: `src/pages/Maintenance/useMaintenanceDataActions.ts`
- Modify: `src/pages/Maintenance/MaintenanceDataLocationPanel.tsx`
- Modify: `src/pages/Maintenance/MaintenancePageContent.tsx`

- [ ] **Step 1: Add TypeScript type**

In `src/types/archive.ts`, after `DatabaseUpdateProtectionBackupReport`, add:

```typescript
export type DiagnosticExportReport = {
  path: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  includedFiles: string[];
  warnings: string[];
};
```

- [ ] **Step 2: Add API method**

In `src/services/api.ts`, add `DiagnosticExportReport` to the archive type import and add this method near `getAppDataDiagnostics`:

```typescript
exportDiagnosticPackage() {
  return command<DiagnosticExportReport>('export_diagnostic_package', undefined, () => mockStore.exportDiagnosticPackage());
},
```

- [ ] **Step 3: Add mock store method**

In `src/services/mockStoreDiagnostics.ts`, add `DiagnosticExportReport` to the type import and add this method before `listDiagnosticLogs`:

```typescript
exportDiagnosticPackage(): Promise<DiagnosticExportReport> {
  return Promise.resolve({
    path: mockAppDataPath('diagnostic-exports', 'mikavn-diagnostics-mock.zip'),
    fileName: 'mikavn-diagnostics-mock.zip',
    sizeBytes: 32 * 1024,
    createdAt: new Date().toISOString(),
    includedFiles: ['manifest.json', 'diagnostics.json', 'summary.md', 'logs-preview.json', 'environment.json'],
    warnings: [],
  });
},
```

- [ ] **Step 4: Add hook state and action**

In `src/pages/Maintenance/useMaintenanceDataActions.ts`, add state:

```typescript
const [diagnosticExportLoading, setDiagnosticExportLoading] = useState(false);
```

Add this callback before `revealPath`:

```typescript
const exportDiagnosticPackage = useCallback(async () => {
  setDiagnosticExportLoading(true);
  setError(null);
  setMessage(null);
  try {
    const report = await api.exportDiagnosticPackage();
    setMessage({
      text: `诊断包已导出：${report.fileName}（${formatBytes(report.sizeBytes)}）。包含自检摘要和脱敏日志预览，不包含完整数据库、图片缓存或存档文件。`,
    });
  } catch (reason) {
    setError(errorMessage(reason));
  } finally {
    setDiagnosticExportLoading(false);
  }
}, [setError, setMessage]);
```

Return both values:

```typescript
diagnosticExportLoading,
exportDiagnosticPackage,
```

- [ ] **Step 5: Add panel props and button**

In `src/pages/Maintenance/MaintenanceDataLocationPanel.tsx`, import an icon:

```typescript
import { FileArchive, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
```

Add props:

```typescript
diagnosticExportLoading: boolean;
onExportDiagnosticPackage: () => void;
```

Add them to destructuring:

```typescript
diagnosticExportLoading,
onExportDiagnosticPackage,
```

Replace the `actions={...}` in `PanelHeader` with:

```tsx
actions={(
  <div className="flex flex-wrap justify-end gap-2">
    <Button disabled={diagnosticExportLoading || !diagnostics} size="sm" variant="outline" onClick={onExportDiagnosticPackage}>
      <FileArchive className="h-4 w-4" />{diagnosticExportLoading ? '导出中' : '导出诊断包'}
    </Button>
    <Button disabled={cleanupLoading || !diagnostics?.databaseBackups.fileCount} size="sm" variant="ghost" onClick={onCleanupDatabaseBackups}>
      <Trash2 className="h-4 w-4" />{cleanupLoading ? '清理中' : '清理旧备份'}
    </Button>
  </div>
)}
```

- [ ] **Step 6: Wire page content**

In `src/pages/Maintenance/MaintenancePageContent.tsx`, pass the new props:

```tsx
diagnosticExportLoading={dataActions.diagnosticExportLoading}
onExportDiagnosticPackage={dataActions.exportDiagnosticPackage}
```

- [ ] **Step 7: Run frontend source test and verify GREEN**

Run:

```powershell
npm run test:diagnostic-export
```

Expected: pass.

- [ ] **Step 8: Commit frontend slice**

Run:

```powershell
git add package.json scripts/diagnostic-export.test.cjs src/types/archive.ts src/services/api.ts src/services/mockStoreDiagnostics.ts src/pages/Maintenance/useMaintenanceDataActions.ts src/pages/Maintenance/MaintenanceDataLocationPanel.tsx src/pages/Maintenance/MaintenancePageContent.tsx
git commit -m "feat: add maintenance diagnostic export action"
```

---

### Task 5: Verification And Real Data Safety

**Files:**
- No source changes expected unless verification reveals a bug.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
$env:CARGO_BUILD_JOBS='1'; $env:CARGO_INCREMENTAL='0'; cargo test -q diagnostic --manifest-path src-tauri\Cargo.toml
npm run test:diagnostic-export
```

Expected: all pass.

- [ ] **Step 2: Run project checks**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 3: Optional large smoke if resources allow**

Run:

```powershell
npm run smoke:large
```

Expected: large library smoke passes. If skipped due local resource pressure, record that explicitly.

- [ ] **Step 4: Verify real database remains unchanged**

Run read-only checks:

```powershell
$db = 'E:\MikaVN Library\app-data\mikavn.db'
sqlite3 $db "PRAGMA quick_check; SELECT COUNT(*) FROM games; SELECT COUNT(*) FROM game_assets;"
```

Expected:

```text
ok
4456
17738
```

If the counts differ because the user changed the real library during work, verify `PRAGMA quick_check` is still `ok` and report the observed counts without modifying the database.

- [ ] **Step 5: Inspect changed files**

Run:

```powershell
git status --short
git log --oneline -3
```

Expected: clean worktree after commits, with the diagnostic export commits visible.

