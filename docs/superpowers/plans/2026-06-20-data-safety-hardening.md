# Data Safety Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified database backup before app update installation, make backup/restore entry points clearer, and keep update-protection backups visible in diagnostics and cleanup.

**Architecture:** Add one blocking Rust command for update-protection database backup under `app-data/database-backups/update-protection`, expose it through `src/services/api.ts`, and call it from `src/services/updater.ts` before `downloadAndInstall()`. Keep existing restore scheduling behavior; improve Settings and Dashboard copy/actions around backup and restore without broad UI redesign.

**Tech Stack:** Tauri v2, Rust, rusqlite, React, TypeScript, Node `node:test`, existing source-level UI tests, existing release validation scripts.

---

## File Structure

- Modify `src-tauri/src/services/backups.rs`: add update-protection report type, backup creation helper, cleanup recognition, and Rust tests.
- Modify `src-tauri/src/commands/backups.rs`: add `backup_database_before_update` Tauri command.
- Modify `src-tauri/src/lib.rs`: register the new command.
- Modify `src/types/archive.ts`: add `DatabaseUpdateProtectionBackupReport`.
- Modify `src/services/api.ts`: expose `backupDatabaseBeforeUpdate()`.
- Modify `src/services/updater.ts`: call backup command before `downloadAndInstall()` and return backup details.
- Modify `src/services/updaterModel.ts`: extend `UpdaterInstallResult` with optional backup fields if needed.
- Modify `src/pages/Settings/SettingsUpdateSection.tsx`: show pre-update backup status and backup failure message.
- Modify `src/pages/Settings/SettingsLocalDataSection.tsx`: make backup/restore area clearer and add open backup directory action.
- Modify `src/pages/Settings/useSettingsLocalDataActions.ts`: add backup directory reveal helper usage if needed.
- Modify `src/pages/Dashboard/DashboardLocalPanels.tsx`: rename settings action to `备份与恢复`.
- Modify `scripts/updater-service-model.test.cjs`: add model-level install result assertions if model changes.
- Modify `scripts/settings-updater-section.test.cjs`: assert backup-before-update UI text.
- Create `scripts/updater-install-flow.test.cjs`: source test that updater installs only after backup and cancels install on backup failure.
- Create or modify `scripts/settings-local-data-section.test.cjs`: source test for clearer backup/restore entry and backup directory action.
- Modify `package.json`: add the new Node test to `test:updater-release` or keep it covered by an existing grouped script.

## Task 1: Backend Update-Protection Backup

**Files:**
- Modify: `src-tauri/src/services/backups.rs`
- Modify: `src-tauri/src/commands/backups.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing Rust tests for update-protection backup**

Add these tests inside `#[cfg(test)] mod tests` in `src-tauri/src/services/backups.rs`:

```rust
#[test]
fn update_protection_backup_creates_verified_database_copy() {
    let root = std::env::temp_dir().join(format!("mikavn-update-backup-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");

    let report = create_update_protection_backup_with_paths(&paths).unwrap();

    assert_eq!(report.quick_check, "ok");
    assert!(report.file_name.starts_with("before-update-"));
    assert!(report.file_name.ends_with(".db"));
    assert!(report.path.contains("update-protection"));
    assert!(Path::new(&report.path).is_file());
    assert!(report.size_bytes > 0);
    assert_eq!(database_marker(Path::new(&report.path)), "current");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn update_protection_backup_is_listed_and_cleanup_safe() {
    let root = std::env::temp_dir().join(format!("mikavn-update-backup-summary-test-{}", Uuid::new_v4()));
    let paths = AppPaths::from_root(root.clone()).unwrap();
    create_mikavn_db(&paths.database(), "current");
    let old_backup = paths
        .database_backups()
        .join("update-protection")
        .join("before-update-20260101-000000.db");
    let newest_backup = paths
        .database_backups()
        .join("update-protection")
        .join("before-update-20260102-000000.db");
    fs::create_dir_all(old_backup.parent().unwrap()).unwrap();
    fs::write(&old_backup, b"old").unwrap();
    std::thread::sleep(std::time::Duration::from_millis(20));
    fs::write(&newest_backup, b"new").unwrap();

    let summary = database_backup_summary(&paths).unwrap();
    assert_eq!(summary.file_count, 2);
    assert!(summary.files.iter().any(|file| file.file_name == "before-update-20260101-000000.db"));

    let report = cleanup_old_database_backups_with_paths(
        &paths,
        DatabaseBackupCleanupPolicy {
            retain_count: Some(1),
            retain_days: None,
        },
    )
    .unwrap();

    assert_eq!(report.scanned_files, 2);
    assert_eq!(report.removed_files, 1);
    assert!(!old_backup.exists());
    assert!(newest_backup.exists());
    assert!(paths.database().exists());
    let _ = fs::remove_dir_all(root);
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
cargo test -q update_protection --manifest-path src-tauri\Cargo.toml
```

Expected: FAIL because `create_update_protection_backup_with_paths` and report fields do not exist.

- [ ] **Step 3: Add report type and backup helper**

In `src-tauri/src/services/backups.rs`, add this public report near the existing backup summary structs:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseUpdateProtectionBackupReport {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub quick_check: String,
}
```

Add this public command helper near `cleanup_old_database_backups`:

```rust
pub fn create_update_protection_backup(app: &AppHandle) -> DbResult<DatabaseUpdateProtectionBackupReport> {
    let paths = AppPaths::from_app(app)?;
    create_update_protection_backup_with_paths(&paths)
}
```

Add this internal helper near `schedule_pending_restore`:

```rust
fn create_update_protection_backup_with_paths(
    paths: &AppPaths,
) -> DbResult<DatabaseUpdateProtectionBackupReport> {
    let database = paths.database();
    if !database.is_file() {
        return Err(DbError::path_not_found("current database does not exist"));
    }

    let created_at = Utc::now();
    let target_dir = paths.database_backups().join("update-protection");
    fs::create_dir_all(&target_dir)?;
    let file_name = format!("before-update-{}.db", created_at.format("%Y%m%d-%H%M%S"));
    let target = target_dir.join(&file_name);

    let db = Database::new_from_path(database)?;
    db.backup_to_path(&target)?;
    let quick_check = validate_database_backup_file(&target)?;
    let size_bytes = fs::metadata(&target)?.len();

    logger::log_warn(
        paths,
        "database.backup",
        format!(
            "update protection backup created: {} ({} bytes)",
            logger::display_path(&target),
            size_bytes
        ),
    );

    Ok(DatabaseUpdateProtectionBackupReport {
        path: target.to_string_lossy().to_string(),
        file_name,
        size_bytes,
        created_at: created_at.to_rfc3339(),
        quick_check,
    })
}
```

Add this validator near `validate_restore_database_file` and update `validate_restore_database_file` to call it:

```rust
fn validate_database_backup_file(path: &Path) -> DbResult<String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let check: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if check != "ok" {
        return Err(DbError::backup_failed(format!(
            "database backup failed quick_check: {check}"
        )));
    }

    let has_games_table: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'games')",
        [],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if !has_games_table {
        return Err(DbError::backup_failed(
            "database backup does not look like a MikaVN database",
        ));
    }
    Ok(check)
}

fn validate_restore_database_file(path: &Path) -> DbResult<()> {
    validate_database_backup_file(path).map(|_| ())
}
```

- [ ] **Step 4: Recognize update-protection backups in summary and cleanup**

Update `is_known_database_backup_name` in `src-tauri/src/services/backups.rs`:

```rust
BackupDirKind::AnyDatabaseBackup => {
    lower.starts_with("mikavn.before-")
        || lower.starts_with("before-update-")
        || lower.starts_with("before-restore-")
        || lower.starts_with("before-import-")
        || lower.starts_with("rejected-")
}
```

- [ ] **Step 5: Add and register Tauri command**

In `src-tauri/src/commands/backups.rs`, import the report and add:

```rust
use crate::services::backups::DatabaseUpdateProtectionBackupReport;

#[tauri::command]
pub fn backup_database_before_update(
    app: AppHandle,
) -> DbResult<DatabaseUpdateProtectionBackupReport> {
    backup_service::create_update_protection_backup(&app)
}
```

In `src-tauri/src/lib.rs`, add command registration next to other backup commands:

```rust
commands::backups::backup_database_before_update,
```

- [ ] **Step 6: Run backend tests and commit**

Run:

```powershell
cargo test -q update_protection --manifest-path src-tauri\Cargo.toml
cargo test -q backup --manifest-path src-tauri\Cargo.toml
```

Expected: PASS.

Commit:

```powershell
git add src-tauri/src/services/backups.rs src-tauri/src/commands/backups.rs src-tauri/src/lib.rs
git commit -m "feat: add update protection database backup"
```

## Task 2: Frontend Update Backup Gate

**Files:**
- Create: `scripts/updater-install-flow.test.cjs`
- Modify: `src/types/archive.ts`
- Modify: `src/services/api.ts`
- Modify: `src/services/updater.ts`
- Modify: `src/services/updaterModel.ts` if install result type stays centralized there
- Modify: `package.json`

- [ ] **Step 1: Write failing source test for updater gate**

Create `scripts/updater-install-flow.test.cjs`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('updater install creates database backup before download and install', () => {
  const source = read('src/services/updater.ts');
  const backupIndex = source.indexOf('backupDatabaseBeforeUpdate');
  const installIndex = source.indexOf('downloadAndInstall');

  assert.ok(backupIndex > -1, 'install flow must call backupDatabaseBeforeUpdate');
  assert.ok(installIndex > -1, 'install flow must still call downloadAndInstall');
  assert.ok(backupIndex < installIndex, 'backup must happen before downloadAndInstall');
  assert.match(source, /backup.*fileName|backupReport|backup/i);
});

test('updater install reports backup failure before installing', () => {
  const source = read('src/services/updater.ts');

  assert.match(source, /更新前数据库备份失败/);
  assert.match(source, /已取消安装/);
  assert.match(source, /backupDatabaseBeforeUpdate/);
});

test('api exposes backup_database_before_update command', () => {
  const api = read('src/services/api.ts');
  const types = read('src/types/archive.ts');

  assert.match(api, /backupDatabaseBeforeUpdate/);
  assert.match(api, /backup_database_before_update/);
  assert.match(types, /DatabaseUpdateProtectionBackupReport/);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```powershell
node --test scripts/updater-install-flow.test.cjs
```

Expected: FAIL because frontend API and updater gate are not implemented.

- [ ] **Step 3: Add frontend report type**

In `src/types/archive.ts`, add near `DatabaseBackupFile`:

```ts
export type DatabaseUpdateProtectionBackupReport = {
  path: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  quickCheck: string;
};
```

- [ ] **Step 4: Add API wrapper**

In `src/services/api.ts`, extend the archive import:

```ts
import type { AppDataDiagnostics, DatabaseBackupCleanupPolicy, DatabaseBackupCleanupReport, DatabaseUpdateProtectionBackupReport, ImageReferenceAudit, ImageReferenceAuditOptions, LibraryArchiveExportOptions, LibraryArchiveImportOptions, LibraryArchivePreview, LibraryArchiveRestoreOptions, LogRecord, LogRetentionPolicy, TrayStatus } from '@/types/archive';
```

Add the API method next to `backupDatabase`:

```ts
backupDatabaseBeforeUpdate() {
  return command<DatabaseUpdateProtectionBackupReport>('backup_database_before_update');
},
```

- [ ] **Step 5: Update install result and updater flow**

In `src/services/updaterModel.ts`, define:

```ts
export type UpdateProtectionBackupInfo = {
  fileName: string;
  path: string;
  sizeBytes: number;
};
```

Update `UpdaterInstallResult` so installed results can include backup information:

```ts
export type UpdaterInstallResult =
  | { kind: 'installed'; message: string; backup?: UpdateProtectionBackupInfo }
  | { kind: 'failed'; message: string };
```

In `src/services/updater.ts`, import `api` and call backup first:

```ts
import { api } from './api';
```

Replace the install body with:

```ts
try {
  const backupReport = await api.backupDatabaseBeforeUpdate();
  await update.downloadAndInstall();
  return {
    kind: 'installed',
    message: `更新已安装，重启后生效。更新前数据库备份：${backupReport.fileName}`,
    backup: {
      fileName: backupReport.fileName,
      path: backupReport.path,
      sizeBytes: backupReport.sizeBytes,
    },
  };
} catch (error) {
  return { kind: 'failed', message: formatUpdaterError(error).replace('更新失败：', '更新前数据库备份失败或更新失败：') };
}
```

Then refine the catch block to distinguish backup failure before install:

```ts
let backupStarted = false;
try {
  backupStarted = true;
  const backupReport = await api.backupDatabaseBeforeUpdate();
  await update.downloadAndInstall();
  return {
    kind: 'installed',
    message: `更新已安装，重启后生效。更新前数据库备份：${backupReport.fileName}`,
    backup: {
      fileName: backupReport.fileName,
      path: backupReport.path,
      sizeBytes: backupReport.sizeBytes,
    },
  };
} catch (error) {
  const formatted = formatUpdaterError(error);
  if (backupStarted) {
    return { kind: 'failed', message: `更新前数据库备份失败，已取消安装。${formatted}` };
  }
  return { kind: 'failed', message: formatted };
}
```

If TypeScript flags `backupStarted` as always true, replace it with a narrower two-stage flow:

```ts
let backupReport;
try {
  backupReport = await api.backupDatabaseBeforeUpdate();
} catch (error) {
  return { kind: 'failed', message: `更新前数据库备份失败，已取消安装。${formatUpdaterError(error)}` };
}

try {
  await update.downloadAndInstall();
  return {
    kind: 'installed',
    message: `更新已安装，重启后生效。更新前数据库备份：${backupReport.fileName}`,
    backup: {
      fileName: backupReport.fileName,
      path: backupReport.path,
      sizeBytes: backupReport.sizeBytes,
    },
  };
} catch (error) {
  return { kind: 'failed', message: formatUpdaterError(error) };
}
```

- [ ] **Step 6: Add test script to updater release group**

In `package.json`, update `test:updater-release`:

```json
"test:updater-release": "node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs scripts/updater-install-flow.test.cjs"
```

- [ ] **Step 7: Run frontend updater tests and commit**

Run:

```powershell
node --test scripts/updater-install-flow.test.cjs
npm run test:updater-release
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add scripts/updater-install-flow.test.cjs package.json src/types/archive.ts src/services/api.ts src/services/updater.ts src/services/updaterModel.ts
git commit -m "feat: gate updater install on database backup"
```

## Task 3: Backup and Restore Entry UI

**Files:**
- Modify: `scripts/settings-updater-section.test.cjs`
- Create: `scripts/settings-local-data-section.test.cjs`
- Modify: `package.json`
- Modify: `src/pages/Settings/SettingsUpdateSection.tsx`
- Modify: `src/pages/Settings/SettingsLocalDataSection.tsx`
- Modify: `src/pages/Settings/useSettingsLocalDataActions.ts` if a new handler is needed
- Modify: `src/pages/Dashboard/DashboardLocalPanels.tsx`

- [ ] **Step 1: Write failing UI source tests**

Add to `scripts/settings-updater-section.test.cjs`:

```js
test('settings update section explains update protection backup', () => {
  const source = read('src/pages/Settings/SettingsUpdateSection.tsx');

  assert.match(source, /更新前.*数据库备份/);
  assert.match(source, /备份中|backing_up/);
  assert.match(source, /backup\?\.fileName|backupInfo|backupPath/);
});
```

Create `scripts/settings-local-data-section.test.cjs`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('local data settings exposes clear backup and restore entry', () => {
  const source = read('src/pages/Settings/SettingsLocalDataSection.tsx');

  assert.match(source, /数据库备份与恢复/);
  assert.match(source, /打开备份目录/);
  assert.match(source, /最近备份/);
  assert.match(source, /下次启动/);
  assert.match(source, /保护备份/);
});

test('dashboard local safety links to backup and restore settings', () => {
  const source = read('src/pages/Dashboard/DashboardLocalPanels.tsx');

  assert.match(source, /备份与恢复/);
  assert.match(source, /onOpenSettings\?\.\('local'\)/);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
node --test scripts/settings-updater-section.test.cjs scripts/settings-local-data-section.test.cjs
```

Expected: FAIL because the new copy and action labels are missing.

- [ ] **Step 3: Show backup status in update settings**

In `src/pages/Settings/SettingsUpdateSection.tsx`, extend state:

```ts
const [backupInfo, setBackupInfo] = useState<{ fileName: string; path: string } | null>(null);
```

Reset backup info before checking:

```ts
setBackupInfo(null);
```

Update install result handling:

```ts
if (installResult.kind === 'installed') {
  setBackupInfo(installResult.backup ? { fileName: installResult.backup.fileName, path: installResult.backup.path } : null);
  setState('installed');
  setResult({
    kind: 'available',
    version: result?.kind === 'available' ? result.version : '新版本',
    notes: result?.kind === 'available' ? result.notes : '更新已安装。',
    message: installResult.message,
  });
} else {
  setState('failed');
  setError(installResult.message);
}
```

Add visible text near the result:

```tsx
<div className="max-w-[42rem] text-right text-xs text-slate-400">
  下载并安装前会自动创建更新前数据库备份；备份失败会取消安装。
</div>
{state === 'installing' && <div className="max-w-[42rem] text-right text-xs text-amber-200">备份中，然后下载并安装更新。</div>}
{backupInfo && <div className="max-w-[42rem] break-all text-right text-xs text-emerald-200">更新前数据库备份：{backupInfo.fileName}</div>}
```

- [ ] **Step 4: Make local backup/restore area clearer**

In `src/pages/Settings/SettingsLocalDataSection.tsx`, compute latest backup at top of component:

```ts
const latestBackup = diagnostics?.databaseBackups.files[0] ?? null;
```

Replace separate backup/restore items with a clearer grouped item:

```tsx
<ConfigItem title="数据库备份与恢复" description="手动备份、打开备份目录，或安排下次启动恢复数据库。恢复前会自动创建保护备份。">
  <div className="flex max-w-[42rem] flex-col items-end gap-2 text-right">
    <div className="text-xs text-slate-400">
      最近备份：{latestBackup ? `${latestBackup.fileName} · ${formatBytes(latestBackup.sizeBytes)}` : '暂无可用数据库备份'}
    </div>
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" disabled={!diagnostics?.databaseBackups.rootPath} onClick={() => diagnostics && void onRevealPath('数据库备份目录', diagnostics.databaseBackups.rootPath)}><Folder className="h-4 w-4" />打开备份目录</Button>
      <Button variant="secondary" onClick={onBackupDatabase}><Download className="h-4 w-4" />手动备份</Button>
      <Button variant="outline" onClick={onRestoreDatabase}><RotateCcw className="h-4 w-4" />安排恢复</Button>
    </div>
    <div className="text-xs text-slate-500">恢复会复制备份到 pending-restore，下次启动前先创建保护备份再替换当前数据库。</div>
  </div>
</ConfigItem>
```

Remove the old `手动备份数据库` and `恢复数据库备份` items to avoid duplicate buttons.

- [ ] **Step 5: Rename Dashboard action**

In `src/pages/Dashboard/DashboardLocalPanels.tsx`, change the database safety button text:

```tsx
<Button size="sm" variant="outline" onClick={() => onOpenSettings?.('local')}>备份与恢复</Button>
```

- [ ] **Step 6: Add local data test to package scripts**

In `package.json`, update `test:updater-release` or add a grouped script. Recommended:

```json
"test:updater-release": "node --test scripts/updater-release-config.test.cjs scripts/updater-service-model.test.cjs scripts/settings-updater-section.test.cjs scripts/startup-updater.test.cjs scripts/updater-install-flow.test.cjs scripts/settings-local-data-section.test.cjs"
```

- [ ] **Step 7: Run UI tests and commit**

Run:

```powershell
node --test scripts/settings-updater-section.test.cjs scripts/settings-local-data-section.test.cjs
npm run test:updater-release
npm run test:dashboard-personal
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add scripts/settings-updater-section.test.cjs scripts/settings-local-data-section.test.cjs package.json src/pages/Settings/SettingsUpdateSection.tsx src/pages/Settings/SettingsLocalDataSection.tsx src/pages/Dashboard/DashboardLocalPanels.tsx
git commit -m "feat: clarify database backup and restore entry"
```

## Task 4: Full Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run targeted backend verification**

Run:

```powershell
cargo test -q update_protection --manifest-path src-tauri\Cargo.toml
cargo test -q backup --manifest-path src-tauri\Cargo.toml
```

Expected: PASS.

- [ ] **Step 2: Run targeted frontend verification**

Run:

```powershell
npm run test:updater-release
npm run test:dashboard-personal
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run release core validation**

Run:

```powershell
npm run release:validate:core
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected: working tree clean except any unrelated pre-existing changes; newest commits correspond to the data-safety implementation.

## Self-Review

Spec coverage:

- Automatic update backup: Task 1 and Task 2.
- Verified backup before install: Task 1 validates `quick_check`; Task 2 gates `downloadAndInstall`.
- Backup failure cancels update: Task 2.
- Restore entry clearer: Task 3.
- Backup retention strategy: Task 1 updates known backup recognition so existing cleanup covers `before-update-*.db`.
- Diagnostics visibility: Task 1 updates summary recognition; Task 3 surfaces latest backup from diagnostics.
- Release validation: Task 4.

Placeholder scan:

- No unresolved placeholder markers or ambiguous implementation notes are intentionally left.

Type consistency:

- Backend command: `backup_database_before_update`.
- Frontend API: `backupDatabaseBeforeUpdate`.
- Report type: `DatabaseUpdateProtectionBackupReport`.
- Backup fields: `fileName`, `path`, `sizeBytes`, `createdAt`, `quickCheck`.
