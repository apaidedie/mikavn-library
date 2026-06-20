# Image Health Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe image-health report and quarantine-based orphan image maintenance flow for the local MikaVN image cache.

**Architecture:** Add a focused Rust service `image_health` that composes database image references with a single filesystem scan of `app-data/images`. Expose two Tauri commands: one read-only health report and one quarantine action that moves only proven orphan files into `app-data/image-quarantine`. Extend Maintenance UI with a compact report and safe action copy, leaving existing image audit and artwork repair flows intact.

**Tech Stack:** Tauri v2, Rust, rusqlite, serde, React, TypeScript, Node `node:test`, existing Maintenance page patterns.

---

## File Structure

- Create `src-tauri/src/services/image_health.rs`: report structs, reference collection, cache scan, orphan quarantine, Rust tests.
- Modify `src-tauri/src/services/mod.rs`: export `image_health`.
- Modify `src-tauri/src/commands/diagnostics.rs`: expose `get_image_health_report` and `quarantine_orphan_images`.
- Modify `src-tauri/src/lib.rs`: register the new commands.
- Modify `src/types/archive.ts`: add `ImageHealthReport`, `ImageQuarantineReport`, and related types.
- Modify `src/services/api.ts`: add `getImageHealthReport()` and `quarantineOrphanImages()`.
- Modify `src/services/mockStoreDiagnostics.ts`: provide browser-preview image-health data.
- Modify `src/pages/Maintenance/useMaintenanceInspectionActions.ts`: load image health report.
- Modify `src/pages/Maintenance/MaintenanceImageAuditPanel.tsx`: render health summary and quarantine actions near the current image audit.
- Create `scripts/maintenance-image-health.test.cjs`: source tests for UI labels and safe action wording.
- Modify `package.json`: add the new Node test to an existing maintenance or updater-adjacent test command, or create `test:maintenance-image-health`.

## Task 1: Backend Image Health Report

**Files:**
- Create: `src-tauri/src/services/image_health.rs`
- Modify: `src-tauri/src/services/mod.rs`

- [ ] **Step 1: Write failing Rust tests for report classification**

Create `src-tauri/src/services/image_health.rs` with the test module first. The file will not compile until the production types and functions are added.

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::paths::AppPaths;
    use rusqlite::Connection;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn image_health_report_counts_reference_and_cache_issues() {
        let root = std::env::temp_dir().join(format!("mikavn-image-health-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::create_dir_all(paths.images().join("playnite-import/game")).unwrap();
        fs::create_dir_all(paths.images().join("dupes/a")).unwrap();
        fs::create_dir_all(paths.images().join("dupes/b")).unwrap();

        let cover = paths.images().join("cover.jpg");
        let legacy = paths.images().join("playnite-import/game/cover.jpg");
        let orphan = paths.images().join("orphan.webp");
        let duplicate_a = paths.images().join("dupes/a/same.png");
        let duplicate_b = paths.images().join("dupes/b/same.png");
        let oversized = paths.images().join("large.jpg");
        fs::write(&cover, b"cover").unwrap();
        fs::write(&legacy, b"legacy").unwrap();
        fs::write(&orphan, b"orphan").unwrap();
        fs::write(&duplicate_a, b"a").unwrap();
        fs::write(&duplicate_b, b"b").unwrap();
        fs::write(&oversized, vec![1u8; 6 * 1024 * 1024]).unwrap();

        create_health_db(
            &paths.database(),
            &cover.to_string_lossy(),
            &legacy.to_string_lossy(),
            "C:\\old\\missing.jpg",
        );

        let report = get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

        assert_eq!(report.summary.total_image_refs, 3);
        assert_eq!(report.summary.missing_local_refs, 1);
        assert_eq!(report.summary.c_drive_refs, 1);
        assert_eq!(report.summary.playnite_refs, 1);
        assert_eq!(report.summary.legacy_app_data_import_refs, 1);
        assert_eq!(report.cache.file_count, 6);
        assert_eq!(report.cache.orphan_file_count, 4);
        assert_eq!(report.cache.duplicate_file_name_groups, 1);
        assert_eq!(report.cache.oversized_file_count, 1);
        assert!(report.cache.orphan_samples.iter().any(|item| item.path.ends_with("orphan.webp")));

        let _ = fs::remove_dir_all(root);
    }

    fn create_health_db(path: &std::path::Path, cover: &str, legacy: &str, missing: &str) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              description TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              asset_type TEXT NOT NULL,
              uri TEXT NOT NULL,
              source TEXT,
              is_primary INTEGER NOT NULL DEFAULT 0
            );
            "#,
        ).unwrap();
        conn.execute(
            "INSERT INTO games (id, title, cover_image, banner_image, background_image, description) VALUES ('g1', 'VN', ?1, ?2, ?3, '')",
            (cover, legacy, missing),
        ).unwrap();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
$env:POWERSHELL_TELEMETRY_OPTOUT='1'
cargo test -q image_health_report_counts_reference_and_cache_issues --manifest-path src-tauri\Cargo.toml
```

Expected: compile failure because `ImageHealthReportOptions` and `get_image_health_report_with_paths` are not implemented.

- [ ] **Step 3: Add report structs and read-only scanner**

Add the production code above the tests in `src-tauri/src/services/image_health.rs`.

Use these public structs:

```rust
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db::models::GameFilter;
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::paths::AppPaths;
use crate::services::images;

const DEFAULT_OVERSIZED_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const DEFAULT_SAMPLE_LIMIT: usize = 100;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReportOptions {
    pub oversized_bytes: Option<u64>,
    pub sample_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReport {
    pub generated_at: String,
    pub summary: ImageHealthSummary,
    pub cache: ImageCacheHealth,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthSummary {
    pub total_image_refs: i64,
    pub issue_image_refs: i64,
    pub missing_local_refs: i64,
    pub c_drive_refs: i64,
    pub playnite_refs: i64,
    pub legacy_app_data_import_refs: i64,
    pub external_legacy_refs: i64,
    pub image_files: i64,
    pub orphan_files: i64,
    pub duplicate_file_name_groups: i64,
    pub oversized_files: i64,
    pub missing_cover_games: i64,
    pub missing_artwork_games: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheHealth {
    pub root_path: String,
    pub file_count: i64,
    pub total_bytes: u64,
    pub referenced_file_count: i64,
    pub orphan_file_count: i64,
    pub orphan_bytes: u64,
    pub duplicate_file_name_groups: i64,
    pub oversized_file_count: i64,
    pub oversized_bytes: u64,
    pub orphan_samples: Vec<ImageCacheFileIssue>,
    pub duplicate_name_samples: Vec<ImageDuplicateNameGroup>,
    pub oversized_samples: Vec<ImageCacheFileIssue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheFileIssue {
    pub path: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDuplicateNameGroup {
    pub file_name: String,
    pub count: i64,
    pub samples: Vec<String>,
}
```

Implement public entry points:

```rust
pub fn get_image_health_report(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    let paths = AppPaths::from_app(app)?;
    get_image_health_report_with_paths(&paths, options)
}

pub(crate) fn get_image_health_report_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    let oversized_bytes = options.oversized_bytes.unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let sample_limit = options.sample_limit.unwrap_or(DEFAULT_SAMPLE_LIMIT).clamp(1, 500);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(paths, &references.referenced_paths, oversized_bytes, sample_limit)?;
    let mut summary = references.summary;
    summary.image_files = cache.file_count;
    summary.orphan_files = cache.orphan_file_count;
    summary.duplicate_file_name_groups = cache.duplicate_file_name_groups;
    summary.oversized_files = cache.oversized_file_count;
    let recommendations = image_health_recommendations(&summary);
    Ok(ImageHealthReport {
        generated_at: Utc::now().to_rfc3339(),
        summary,
        cache,
        recommendations,
    })
}
```

Implement helper behavior:

- open `paths.database()` read-only when it exists;
- query `games.cover_image`, `games.banner_image`, `games.background_image`, and `game_assets.uri`;
- count missing covers with SQL `cover_image IS NULL OR TRIM(cover_image) = ''`;
- count missing artwork when any of cover, banner, or background is empty;
- normalize absolute and relative local image paths into canonical lower-case keys;
- treat `app-data/images/playnite-import/...` as `legacy_app_data_import_refs`;
- treat Playnite/C drive paths outside `app-data/images` as external legacy refs;
- scan `paths.images()` recursively once;
- group duplicate file names by lower-case file name;
- sample at most `sample_limit` entries per sample array.

- [ ] **Step 4: Export the service module**

Modify `src-tauri/src/services/mod.rs`:

```rust
pub mod image_health;
```

- [ ] **Step 5: Run the report test to verify it passes**

Run:

```powershell
$env:POWERSHELL_TELEMETRY_OPTOUT='1'
cargo test -q image_health_report_counts_reference_and_cache_issues --manifest-path src-tauri\Cargo.toml
```

Expected: PASS.

- [ ] **Step 6: Commit backend report**

```powershell
git add src-tauri/src/services/image_health.rs src-tauri/src/services/mod.rs
git commit -m "feat: add image health report service"
```

## Task 2: Backend Orphan Quarantine

**Files:**
- Modify: `src-tauri/src/services/image_health.rs`

- [ ] **Step 1: Write failing Rust test for quarantine**

Add this test to the same test module:

```rust
#[test]
fn quarantine_orphan_images_moves_only_unreferenced_files() {
    let root = std::env::temp_dir().join(format!("mikavn-image-quarantine-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    fs::create_dir_all(paths.images()).unwrap();
    let referenced = paths.images().join("cover.jpg");
    let orphan = paths.images().join("stale/orphan.jpg");
    fs::create_dir_all(orphan.parent().unwrap()).unwrap();
    fs::write(&referenced, b"cover").unwrap();
    fs::write(&orphan, b"orphan").unwrap();
    create_health_db(&paths.database(), &referenced.to_string_lossy(), "", "");

    let report = quarantine_orphan_images_with_paths(&paths, ImageHealthReportOptions::default()).unwrap();

    assert_eq!(report.moved_files, 1);
    assert_eq!(report.skipped_files, 0);
    assert!(referenced.is_file());
    assert!(!orphan.exists());
    assert!(Path::new(&report.manifest_path).is_file());
    assert!(report.quarantine_dir.contains("image-quarantine"));
    let manifest = fs::read_to_string(&report.manifest_path).unwrap();
    assert!(manifest.contains("stale"));
    assert!(manifest.contains("orphan.jpg"));

    let _ = fs::remove_dir_all(root);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
$env:POWERSHELL_TELEMETRY_OPTOUT='1'
cargo test -q quarantine_orphan_images_moves_only_unreferenced_files --manifest-path src-tauri\Cargo.toml
```

Expected: compile failure because `quarantine_orphan_images_with_paths` does not exist.

- [ ] **Step 3: Add quarantine report types and implementation**

Add these structs:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineReport {
    pub quarantine_dir: String,
    pub manifest_path: String,
    pub moved_files: i64,
    pub moved_bytes: u64,
    pub skipped_files: i64,
    pub skipped: Vec<ImageQuarantineSkippedFile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineSkippedFile {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageQuarantineManifest {
    app: String,
    created_at: String,
    moved: Vec<ImageQuarantineManifestItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageQuarantineManifestItem {
    source_path: String,
    quarantine_path: String,
    relative_path: String,
    size_bytes: u64,
    reason: String,
}
```

Add public entry point:

```rust
pub fn quarantine_orphan_images(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_orphan_images_with_paths(&paths, options)
}
```

Implement `quarantine_orphan_images_with_paths`:

- call `get_image_health_report_with_paths`;
- use `report.cache.orphan_samples` only when the report is complete enough for selected candidates. For implementation simplicity, create an internal `orphan_candidates(paths, options)` helper that recomputes all candidates, not just samples;
- create `paths.root().join("image-quarantine").join(timestamp)`;
- for each orphan, preserve relative path under quarantine;
- create target parent directories;
- `fs::rename` the file;
- skip missing files and files that resolve outside `paths.images()`;
- write `manifest.json` using `serde_json::to_string_pretty`.

- [ ] **Step 4: Run quarantine tests**

Run:

```powershell
$env:POWERSHELL_TELEMETRY_OPTOUT='1'
cargo test -q image_quarantine --manifest-path src-tauri\Cargo.toml
cargo test -q image_health --manifest-path src-tauri\Cargo.toml
```

Expected: PASS for both targeted filters.

- [ ] **Step 5: Commit quarantine service**

```powershell
git add src-tauri/src/services/image_health.rs
git commit -m "feat: quarantine orphan image cache files"
```

## Task 3: Tauri Commands And Frontend API

**Files:**
- Modify: `src-tauri/src/commands/diagnostics.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/types/archive.ts`
- Modify: `src/services/api.ts`
- Modify: `src/services/mockStoreDiagnostics.ts`

- [ ] **Step 1: Add source test for command and API exposure**

Create `scripts/maintenance-image-health.test.cjs`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('image health commands are registered and exposed through api', () => {
  const lib = fs.readFileSync('src-tauri/src/lib.rs', 'utf8');
  const commands = fs.readFileSync('src-tauri/src/commands/diagnostics.rs', 'utf8');
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  const types = fs.readFileSync('src/types/archive.ts', 'utf8');

  assert.match(lib, /commands::diagnostics::get_image_health_report/);
  assert.match(lib, /commands::diagnostics::quarantine_orphan_images/);
  assert.match(commands, /pub fn get_image_health_report/);
  assert.match(commands, /pub fn quarantine_orphan_images/);
  assert.match(api, /getImageHealthReport/);
  assert.match(api, /quarantineOrphanImages/);
  assert.match(types, /export type ImageHealthReport/);
  assert.match(types, /export type ImageQuarantineReport/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test scripts/maintenance-image-health.test.cjs
```

Expected: FAIL because commands and API methods are missing.

- [ ] **Step 3: Add backend command wrappers**

In `src-tauri/src/commands/diagnostics.rs`, import image health types and add:

```rust
use crate::services::image_health::{
    self, ImageHealthReport, ImageHealthReportOptions, ImageQuarantineReport,
};

#[tauri::command]
pub fn get_image_health_report(
    app: AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    image_health::get_image_health_report(&app, options)
}

#[tauri::command]
pub fn quarantine_orphan_images(
    app: AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    image_health::quarantine_orphan_images(&app, options)
}
```

In `src-tauri/src/lib.rs`, register:

```rust
commands::diagnostics::get_image_health_report,
commands::diagnostics::quarantine_orphan_images,
```

- [ ] **Step 4: Add TypeScript types**

In `src/types/archive.ts`, add:

```ts
export type ImageHealthReportOptions = {
  oversizedBytes?: number | null;
  sampleLimit?: number | null;
};

export type ImageCacheFileIssue = {
  path: string;
  relativePath: string;
  sizeBytes: number;
};

export type ImageDuplicateNameGroup = {
  fileName: string;
  count: number;
  samples: string[];
};

export type ImageCacheHealth = {
  rootPath: string;
  fileCount: number;
  totalBytes: number;
  referencedFileCount: number;
  orphanFileCount: number;
  orphanBytes: number;
  duplicateFileNameGroups: number;
  oversizedFileCount: number;
  oversizedBytes: number;
  orphanSamples: ImageCacheFileIssue[];
  duplicateNameSamples: ImageDuplicateNameGroup[];
  oversizedSamples: ImageCacheFileIssue[];
};

export type ImageHealthSummary = {
  totalImageRefs: number;
  issueImageRefs: number;
  missingLocalRefs: number;
  cDriveRefs: number;
  playniteRefs: number;
  legacyAppDataImportRefs: number;
  externalLegacyRefs: number;
  imageFiles: number;
  orphanFiles: number;
  duplicateFileNameGroups: number;
  oversizedFiles: number;
  missingCoverGames: number;
  missingArtworkGames: number;
};

export type ImageHealthReport = {
  generatedAt: string;
  summary: ImageHealthSummary;
  cache: ImageCacheHealth;
  recommendations: string[];
};

export type ImageQuarantineSkippedFile = {
  path: string;
  reason: string;
};

export type ImageQuarantineReport = {
  quarantineDir: string;
  manifestPath: string;
  movedFiles: number;
  movedBytes: number;
  skippedFiles: number;
  skipped: ImageQuarantineSkippedFile[];
};
```

- [ ] **Step 5: Add API methods and mock data**

In `src/services/api.ts`, import the new types and add:

```ts
getImageHealthReport(options: ImageHealthReportOptions = {}) {
  return command<ImageHealthReport>('get_image_health_report', { options }, () => mockStore.getImageHealthReport(options));
},
quarantineOrphanImages(options: ImageHealthReportOptions = {}) {
  return command<ImageQuarantineReport>('quarantine_orphan_images', { options }, () => mockStore.quarantineOrphanImages(options));
},
```

In `src/services/mockStoreDiagnostics.ts`, add methods returning deterministic browser-preview values:

```ts
getImageHealthReport(): Promise<ImageHealthReport> {
  return Promise.resolve({
    generatedAt: new Date().toISOString(),
    summary: {
      totalImageRefs: 12,
      issueImageRefs: 2,
      missingLocalRefs: 1,
      cDriveRefs: 0,
      playniteRefs: 1,
      legacyAppDataImportRefs: 1,
      externalLegacyRefs: 0,
      imageFiles: 9,
      orphanFiles: 1,
      duplicateFileNameGroups: 1,
      oversizedFiles: 1,
      missingCoverGames: 1,
      missingArtworkGames: 2,
    },
    cache: {
      rootPath: 'E:\\MikaVN Library\\app-data\\images',
      fileCount: 9,
      totalBytes: 1024,
      referencedFileCount: 8,
      orphanFileCount: 1,
      orphanBytes: 128,
      duplicateFileNameGroups: 1,
      oversizedFileCount: 1,
      oversizedBytes: 7000000,
      orphanSamples: [{ path: 'E:\\MikaVN Library\\app-data\\images\\old.jpg', relativePath: 'old.jpg', sizeBytes: 128 }],
      duplicateNameSamples: [{ fileName: 'cover.jpg', count: 2, samples: ['a/cover.jpg', 'b/cover.jpg'] }],
      oversizedSamples: [{ path: 'E:\\MikaVN Library\\app-data\\images\\large.jpg', relativePath: 'large.jpg', sizeBytes: 7000000 }],
    },
    recommendations: ['先预览孤儿图片隔离；隔离不会永久删除文件。'],
  });
}

quarantineOrphanImages(): Promise<ImageQuarantineReport> {
  return Promise.resolve({
    quarantineDir: 'E:\\MikaVN Library\\app-data\\image-quarantine\\preview',
    manifestPath: 'E:\\MikaVN Library\\app-data\\image-quarantine\\preview\\manifest.json',
    movedFiles: 1,
    movedBytes: 128,
    skippedFiles: 0,
    skipped: [],
  });
}
```

- [ ] **Step 6: Run command/API source test**

Run:

```powershell
node --test scripts/maintenance-image-health.test.cjs
```

Expected: PASS.

- [ ] **Step 7: Commit command/API wiring**

```powershell
git add src-tauri/src/commands/diagnostics.rs src-tauri/src/lib.rs src/types/archive.ts src/services/api.ts src/services/mockStoreDiagnostics.ts scripts/maintenance-image-health.test.cjs
git commit -m "feat: expose image health maintenance api"
```

## Task 4: Maintenance UI

**Files:**
- Modify: `src/pages/Maintenance/useMaintenanceInspectionActions.ts`
- Modify: `src/pages/Maintenance/MaintenanceImageAuditPanel.tsx`
- Modify: `package.json`
- Modify: `scripts/maintenance-image-health.test.cjs`

- [ ] **Step 1: Extend source test for UI labels and safety copy**

Append to `scripts/maintenance-image-health.test.cjs`:

```javascript
test('maintenance image health ui explains safe quarantine workflow', () => {
  const panel = fs.readFileSync('src/pages/Maintenance/MaintenanceImageAuditPanel.tsx', 'utf8');
  const actions = fs.readFileSync('src/pages/Maintenance/useMaintenanceInspectionActions.ts', 'utf8');

  assert.match(actions, /imageHealth/);
  assert.match(actions, /getImageHealthReport/);
  assert.match(panel, /图片健康/);
  assert.match(panel, /孤儿图片/);
  assert.match(panel, /重复文件名/);
  assert.match(panel, /过大图片/);
  assert.match(panel, /隔离区/);
  assert.match(panel, /不会永久删除/);
  assert.doesNotMatch(panel, /永久删除孤儿图片/);
});
```

- [ ] **Step 2: Run UI source test to verify it fails**

Run:

```powershell
node --test scripts/maintenance-image-health.test.cjs
```

Expected: FAIL because the UI does not yet expose image-health state.

- [ ] **Step 3: Add image-health state and actions**

In `src/pages/Maintenance/useMaintenanceInspectionActions.ts`, add state:

```ts
const [imageHealth, setImageHealth] = useState<ImageHealthReport | null>(null);
const [imageHealthLoading, setImageHealthLoading] = useState(false);
```

Add actions:

```ts
const loadImageHealth = useCallback(async () => {
  setImageHealthLoading(true);
  setError(null);
  try {
    const report = await api.getImageHealthReport({ sampleLimit: 100 });
    setImageHealth(report);
    setMessage({ text: `图片健康检查完成：${formatCount(report.summary.imageFiles)} 个缓存文件，${formatCount(report.summary.orphanFiles)} 个孤儿图片。` });
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    setImageHealthLoading(false);
  }
}, [setError, setMessage]);

const quarantineOrphanImages = useCallback(async () => {
  setImageHealthLoading(true);
  setError(null);
  try {
    const result = await api.quarantineOrphanImages({ sampleLimit: 100 });
    const report = await api.getImageHealthReport({ sampleLimit: 100 });
    setImageHealth(report);
    setMessage({ text: `已移动 ${formatCount(result.movedFiles)} 个孤儿图片到隔离区。` });
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    setImageHealthLoading(false);
  }
}, [setError, setMessage]);
```

Return `imageHealth`, `imageHealthLoading`, `loadImageHealth`, and `quarantineOrphanImages`.

- [ ] **Step 4: Render health summary in image audit panel**

Extend `MaintenanceImageAuditPanel` props with:

```ts
imageHealth: ImageHealthReport | null;
imageHealthLoading: boolean;
onLoadImageHealth: () => void;
onQuarantineOrphans: () => void;
```

Render a compact section above existing audit details:

```tsx
<ImageHealthSummaryPanel
  report={imageHealth}
  loading={imageHealthLoading}
  onLoad={onLoadImageHealth}
  onQuarantineOrphans={onQuarantineOrphans}
/>
```

Implement `ImageHealthSummaryPanel` in the same file. Include visible labels:

- `图片健康`;
- `孤儿图片`;
- `重复文件名`;
- `过大图片`;
- `Playnite 旧导入`;
- `移动到隔离区`;
- `不会永久删除文件`.

Disable quarantine when no report exists, while loading, or `report.summary.orphanFiles === 0`.

- [ ] **Step 5: Pass props from Maintenance page content**

Modify `src/pages/Maintenance/MaintenancePageContent.tsx` where `MaintenanceImageAuditPanel` is rendered:

```tsx
imageHealth={inspectionActions.imageHealth}
imageHealthLoading={inspectionActions.imageHealthLoading}
onLoadImageHealth={inspectionActions.loadImageHealth}
onQuarantineOrphans={inspectionActions.quarantineOrphanImages}
```

- [ ] **Step 6: Add test script**

In `package.json` scripts:

```json
"test:maintenance-image-health": "node --test scripts/maintenance-image-health.test.cjs"
```

- [ ] **Step 7: Run UI tests**

Run:

```powershell
npm run test:maintenance-image-health
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 8: Commit UI**

```powershell
git add package.json src/pages/Maintenance/useMaintenanceInspectionActions.ts src/pages/Maintenance/MaintenanceImageAuditPanel.tsx src/pages/Maintenance/MaintenancePageContent.tsx scripts/maintenance-image-health.test.cjs
git commit -m "feat: add image health maintenance panel"
```

## Task 5: Verification And Real-Data Smoke

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
$env:POWERSHELL_TELEMETRY_OPTOUT='1'
cargo test -q image_health --manifest-path src-tauri\Cargo.toml
cargo test -q asset --manifest-path src-tauri\Cargo.toml
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run targeted frontend tests**

Run:

```powershell
npm run test:maintenance-image-health
npm run typecheck
```

Expected: all targeted tests pass.

- [ ] **Step 3: Run build if memory allows**

Run:

```powershell
$env:CARGO_BUILD_JOBS='1'
$env:CARGO_INCREMENTAL='0'
npm run build
```

Expected: build exits 0. If the machine hits the known page-file pressure, record the exact error and keep targeted tests as the verified gate for this increment.

- [ ] **Step 4: Real-data read-only check**

Do not run quarantine on real data unless the user explicitly asks after seeing preview.

Run a read-only app-data check:

```powershell
@'
import sqlite3, os
from pathlib import Path
root = Path(r'E:\MikaVN Library\app-data')
db = root / 'mikavn.db'
conn = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
print(conn.execute('PRAGMA quick_check').fetchone()[0])
print(conn.execute('SELECT COUNT(*) FROM games').fetchone()[0])
print(conn.execute('SELECT COUNT(*) FROM game_assets').fetchone()[0])
conn.close()
print(sum(1 for p in (root / 'images').rglob('*') if p.is_file()))
'@ | python -
```

Expected current baseline:

- `ok`;
- `4456`;
- `17738`;
- `23445`.

- [ ] **Step 5: Final git status**

Run:

```powershell
git status --short --branch
```

Expected: clean `main...origin/main` or only intentional unpushed commits.

## Self-Review

Spec coverage:

- health summary: Task 1 and Task 4;
- missing refs and legacy paths: Task 1;
- orphan files: Task 1 and Task 2;
- duplicate names and oversized files: Task 1;
- quarantine instead of deletion: Task 2 and Task 4;
- frontend Maintenance integration: Task 4;
- tests and validation: Task 1 through Task 5.

No placeholders remain. The plan keeps database-changing path normalization out of the first implementation and preserves the design invariant that future database repairs require a verified database backup.
