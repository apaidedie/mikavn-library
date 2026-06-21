use std::cmp::Reverse;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Duration, Utc};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db::models::TaskRecord;
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

const STARTUP_AUTO_BACKUP_MIN_INTERVAL_HOURS: i64 = 24;

#[derive(Debug)]
struct DatabaseRestoreScheduleReport {
    pending_path: PathBuf,
    source_size_bytes: u64,
    pending_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseBackupFile {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseBackupSummary {
    pub root_path: String,
    pub file_count: i64,
    pub total_bytes: u64,
    pub files: Vec<DatabaseBackupFile>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseBackupCleanupPolicy {
    pub retain_count: Option<usize>,
    pub retain_days: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseBackupCleanupReport {
    pub scanned_files: i64,
    pub removed_files: i64,
    pub kept_files: i64,
    pub removed_bytes: u64,
    pub kept_bytes: u64,
    pub retain_count: usize,
    pub retain_days: Option<i64>,
    pub removed: Vec<DatabaseBackupFile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseUpdateProtectionBackupReport {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub quick_check: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStartupAutomaticBackupReport {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub quick_check: String,
}

#[derive(Debug, Clone)]
struct DatabaseBackupCandidate {
    file: DatabaseBackupFile,
    modified: SystemTime,
    path: PathBuf,
}

#[derive(Debug)]
struct VerifiedDatabaseBackupReport {
    target_path: PathBuf,
    size_bytes: u64,
    quick_check: String,
}

pub fn enqueue_database_backup_task(
    app: AppHandle,
    db: &Database,
    path: String,
) -> DbResult<TaskRecord> {
    let target = PathBuf::from(path.trim());
    if target.as_os_str().is_empty() {
        return Err(DbError::validation("backup path is required"));
    }

    let payload = serde_json::json!({ "path": target.to_string_lossy().to_string() }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "database.backup",
        Some("正在创建数据库备份".to_string()),
        Some(payload),
        true,
    )?;
    let task_id = task.id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let Ok(paths) = AppPaths::from_app(&app_handle) else {
            return;
        };
        let Ok(db) = Database::new_from_path(paths.database()) else {
            return;
        };

        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.2,
            Some("正在生成 SQLite 一致性备份".to_string()),
            None,
        );
        match create_verified_database_backup_with_paths(&paths, &target) {
            Ok(report) => {
                logger::log_info(
                    &paths,
                    "database.backup",
                    format!(
                        "database backup written to {}",
                        logger::display_path(&report.target_path)
                    ),
                );
                let _ = db.append_task_log(
                    &task_id,
                    "info",
                    &database_backup_report_log(
                        &logger::display_path(&report.target_path),
                        report.size_bytes,
                        &report.quick_check,
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "数据库备份已验证并写入 {}",
                        logger::display_path(&report.target_path)
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "database.backup", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("数据库备份失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub fn enqueue_database_restore_task(
    app: AppHandle,
    db: &Database,
    path: String,
) -> DbResult<TaskRecord> {
    let source = PathBuf::from(path.trim());
    if !source.is_file() {
        return Err(DbError::path_not_found(
            "database backup file does not exist",
        ));
    }

    let payload = serde_json::json!({ "path": source.to_string_lossy().to_string() }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "database.restore",
        Some("正在安排数据库恢复".to_string()),
        Some(payload),
        false,
    )?;
    let task_id = task.id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let Ok(paths) = AppPaths::from_app(&app_handle) else {
            return;
        };
        let Ok(db) = Database::new_from_path(paths.database()) else {
            return;
        };
        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.2,
            Some("正在校验数据库备份".to_string()),
            None,
        );
        let result = schedule_pending_restore(&paths, &source);
        match result {
            Ok(report) => {
                logger::log_warn(
                    &paths,
                    "database.restore",
                    format!(
                        "database restore scheduled from {} ({} bytes) to {} ({} bytes)",
                        logger::display_path(&source),
                        report.source_size_bytes,
                        logger::display_path(&report.pending_path),
                        report.pending_size_bytes,
                    ),
                );
                let _ = db.append_task_log(
                    &task_id,
                    "info",
                    &format!(
                        "数据库恢复来源：{}（{} bytes）",
                        logger::display_path(&source),
                        report.source_size_bytes
                    ),
                );
                let _ = db.append_task_log(
                    &task_id,
                    "info",
                    &format!(
                        "数据库恢复待应用：{}（{} bytes）",
                        logger::display_path(&report.pending_path),
                        report.pending_size_bytes
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "数据库恢复已安排，下次启动时应用：{}（{} bytes）",
                        logger::display_path(&report.pending_path),
                        report.pending_size_bytes
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "database.restore", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("数据库恢复安排失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub fn database_backup_summary(paths: &AppPaths) -> DbResult<DatabaseBackupSummary> {
    let candidates = collect_database_backup_candidates(paths)?;
    let total_bytes = candidates
        .iter()
        .map(|candidate| candidate.file.size_bytes)
        .sum();
    let file_count = candidates.len() as i64;
    Ok(DatabaseBackupSummary {
        root_path: paths.database_backups().to_string_lossy().to_string(),
        file_count,
        total_bytes,
        files: candidates
            .into_iter()
            .map(|candidate| candidate.file)
            .collect(),
    })
}

pub fn cleanup_old_database_backups(
    app: &AppHandle,
    policy: DatabaseBackupCleanupPolicy,
) -> DbResult<DatabaseBackupCleanupReport> {
    let paths = AppPaths::from_app(app)?;
    cleanup_old_database_backups_with_paths(&paths, policy)
}

pub fn create_update_protection_backup(
    app: &AppHandle,
) -> DbResult<DatabaseUpdateProtectionBackupReport> {
    let paths = AppPaths::from_app(app)?;
    create_update_protection_backup_with_paths(&paths)
}

pub fn create_startup_automatic_backup_if_needed(
    paths: &AppPaths,
) -> DbResult<Option<DatabaseStartupAutomaticBackupReport>> {
    create_startup_automatic_backup_if_needed_with_paths(paths)
}

fn cleanup_old_database_backups_with_paths(
    paths: &AppPaths,
    policy: DatabaseBackupCleanupPolicy,
) -> DbResult<DatabaseBackupCleanupReport> {
    if let Some(retain_days) = policy.retain_days {
        if retain_days < 0 {
            return Err(DbError::validation("retainDays must be zero or greater"));
        }
    }
    let retain_count = policy.retain_count.unwrap_or(10).min(2000);
    let retain_days = policy.retain_days;
    let cutoff = retain_days.map(|days| Utc::now() - Duration::days(days));
    let roots = backup_cleanup_roots(paths)?;
    let mut candidates = collect_database_backup_candidates(paths)?;
    candidates.sort_by_key(|candidate| Reverse(candidate.modified));

    let mut report = DatabaseBackupCleanupReport {
        scanned_files: candidates.len() as i64,
        removed_files: 0,
        kept_files: 0,
        removed_bytes: 0,
        kept_bytes: 0,
        retain_count,
        retain_days,
        removed: Vec::new(),
    };

    for (index, candidate) in candidates.into_iter().enumerate() {
        let keep_by_count = index < retain_count;
        let keep_by_age = cutoff
            .map(|cutoff| DateTime::<Utc>::from(candidate.modified) >= cutoff)
            .unwrap_or(false);
        if keep_by_count || keep_by_age {
            report.kept_files += 1;
            report.kept_bytes += candidate.file.size_bytes;
            continue;
        }

        let target = canonicalize_existing(&candidate.path)?;
        if !roots.iter().any(|root| target.starts_with(root)) || target == paths.database() {
            report.kept_files += 1;
            report.kept_bytes += candidate.file.size_bytes;
            continue;
        }
        fs::remove_file(&target)?;
        report.removed_files += 1;
        report.removed_bytes += candidate.file.size_bytes;
        report.removed.push(candidate.file);
    }

    Ok(report)
}

fn collect_database_backup_candidates(paths: &AppPaths) -> DbResult<Vec<DatabaseBackupCandidate>> {
    let mut candidates = Vec::new();
    collect_database_backup_candidates_from_dir(
        &paths.database_backups(),
        BackupDirKind::AnyDatabaseBackup,
        &mut candidates,
    )?;
    collect_database_backup_candidates_from_dir(
        &legacy_database_update_protection_dir(paths),
        BackupDirKind::LegacyUpdateProtection,
        &mut candidates,
    )?;
    collect_database_backup_candidates_from_dir(
        paths.root(),
        BackupDirKind::Root,
        &mut candidates,
    )?;
    collect_database_backup_candidates_from_dir(
        &paths.database_restore_protection(),
        BackupDirKind::RestoreProtection,
        &mut candidates,
    )?;
    collect_database_backup_candidates_from_dir(
        &paths.archive_import_protection(),
        BackupDirKind::ArchiveImportProtection,
        &mut candidates,
    )?;
    collect_database_backup_candidates_from_dir(
        &paths.database_restore_pending(),
        BackupDirKind::RejectedPendingRestore,
        &mut candidates,
    )?;
    candidates.sort_by_key(|candidate| Reverse(candidate.modified));
    Ok(candidates)
}

fn backup_cleanup_roots(paths: &AppPaths) -> DbResult<Vec<PathBuf>> {
    let mut roots = Vec::new();
    for path in [
        paths.root().to_path_buf(),
        paths.database_backups(),
        legacy_database_update_protection_dir(paths),
        paths.database_restore_protection(),
        paths.archive_import_protection(),
        paths.database_restore_pending(),
    ] {
        if path.is_dir() {
            roots.push(canonicalize_existing(&path)?);
        }
    }
    Ok(roots)
}

fn collect_database_backup_candidates_from_dir(
    dir: &Path,
    kind: BackupDirKind,
    candidates: &mut Vec<DatabaseBackupCandidate>,
) -> DbResult<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() && kind == BackupDirKind::AnyDatabaseBackup {
            collect_database_backup_candidates_from_dir(&path, kind, candidates)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        if !is_known_database_backup_name(kind, &file_name) {
            continue;
        }
        let metadata = entry.metadata()?;
        let modified = metadata.modified().unwrap_or(UNIX_EPOCH);
        candidates.push(DatabaseBackupCandidate {
            file: DatabaseBackupFile {
                path: path.to_string_lossy().to_string(),
                file_name,
                size_bytes: metadata.len(),
                modified_at: metadata.modified().ok().map(format_system_time),
            },
            modified,
            path,
        });
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BackupDirKind {
    AnyDatabaseBackup,
    LegacyUpdateProtection,
    Root,
    RestoreProtection,
    ArchiveImportProtection,
    RejectedPendingRestore,
}

fn is_known_database_backup_name(kind: BackupDirKind, file_name: &str) -> bool {
    let lower = file_name.to_ascii_lowercase();
    if !lower.ends_with(".db") {
        return false;
    }
    match kind {
        BackupDirKind::AnyDatabaseBackup => {
            lower.starts_with("mikavn.before-")
                || lower.starts_with("before-update-")
                || lower.starts_with("startup-auto-")
                || lower.starts_with("before-restore-")
                || lower.starts_with("before-import-")
                || lower.starts_with("rejected-")
        }
        BackupDirKind::LegacyUpdateProtection => lower.starts_with("before-"),
        BackupDirKind::Root => lower.starts_with("mikavn.before-"),
        BackupDirKind::RestoreProtection => lower.starts_with("before-restore-"),
        BackupDirKind::ArchiveImportProtection => lower.starts_with("before-import-"),
        BackupDirKind::RejectedPendingRestore => lower.starts_with("rejected-"),
    }
}

fn legacy_database_update_protection_dir(paths: &AppPaths) -> PathBuf {
    paths.root().join("database-update-protection")
}

fn canonicalize_existing(path: &Path) -> DbResult<PathBuf> {
    Ok(path.canonicalize()?)
}

fn format_system_time(value: SystemTime) -> String {
    DateTime::<Utc>::from(value).to_rfc3339()
}

fn database_backup_report_log(target: &str, size_bytes: u64, quick_check: &str) -> String {
    format!("数据库备份报告：目标 {target}，大小 {size_bytes} bytes，quick_check {quick_check}。")
}

pub fn apply_pending_database_restore(paths: &AppPaths) -> DbResult<()> {
    let pending = paths.database_restore_pending().join("mikavn.db");
    if !pending.is_file() {
        return Ok(());
    }

    if let Err(error) = validate_restore_database_file(&pending) {
        let rejected = paths.database_restore_pending().join(format!(
            "rejected-{}.db",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        move_file(&pending, &rejected)?;
        logger::log_error(
            paths,
            "database.restore",
            format!(
                "pending database restore rejected: {}; moved to {}",
                error,
                logger::display_path(&rejected)
            ),
        );
        return Ok(());
    }

    let database = paths.database();
    if database.is_file() {
        fs::create_dir_all(paths.database_restore_protection())?;
        let protection = paths.database_restore_protection().join(format!(
            "before-restore-{}.db",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        let protection_size = fs::copy(&database, &protection)?;
        logger::log_warn(
            paths,
            "database.restore",
            format!(
                "protection backup before restore: {} ({} bytes)",
                logger::display_path(&protection),
                protection_size
            ),
        );
    }
    let restored_size = fs::copy(&pending, &database)?;
    fs::remove_file(&pending)?;
    logger::log_warn(
        paths,
        "database.restore",
        format!("pending database restore applied ({} bytes)", restored_size),
    );
    Ok(())
}

fn schedule_pending_restore(
    paths: &AppPaths,
    source: &Path,
) -> DbResult<DatabaseRestoreScheduleReport> {
    validate_restore_database_file(source)?;
    let source_size_bytes = fs::metadata(source)?.len();
    fs::create_dir_all(paths.database_restore_pending())?;
    let target = paths.database_restore_pending().join("mikavn.db");
    let pending_size_bytes = fs::copy(source, &target)?;
    if source_size_bytes != pending_size_bytes {
        return Err(DbError::backup_failed(
            "copied database restore file size does not match source",
        ));
    }
    validate_restore_database_file(&target)?;
    Ok(DatabaseRestoreScheduleReport {
        pending_path: target,
        source_size_bytes,
        pending_size_bytes,
    })
}

fn create_startup_automatic_backup_if_needed_with_paths(
    paths: &AppPaths,
) -> DbResult<Option<DatabaseStartupAutomaticBackupReport>> {
    if !paths.database().is_file() {
        return Ok(None);
    }
    if has_recent_database_backup(paths, STARTUP_AUTO_BACKUP_MIN_INTERVAL_HOURS)? {
        return Ok(None);
    }

    let created_at = Utc::now();
    let target_dir = paths.database_backups().join("auto");
    fs::create_dir_all(&target_dir)?;
    let file_name = format!("startup-auto-{}.db", created_at.format("%Y%m%d-%H%M%S"));
    let target = target_dir.join(&file_name);
    let report = create_verified_database_backup_with_paths(paths, &target)?;

    logger::log_warn(
        paths,
        "database.backup",
        format!(
            "startup automatic backup created: {} ({} bytes)",
            logger::display_path(&report.target_path),
            report.size_bytes
        ),
    );
    if let Err(error) = cleanup_old_database_backups_with_paths(
        paths,
        DatabaseBackupCleanupPolicy {
            retain_count: Some(30),
            retain_days: Some(90),
        },
    ) {
        logger::log_error(
            paths,
            "database.backup",
            format!("startup automatic backup cleanup failed: {error}"),
        );
    }

    Ok(Some(DatabaseStartupAutomaticBackupReport {
        path: report.target_path.to_string_lossy().to_string(),
        file_name,
        size_bytes: report.size_bytes,
        created_at: created_at.to_rfc3339(),
        quick_check: report.quick_check,
    }))
}

fn has_recent_database_backup(paths: &AppPaths, min_interval_hours: i64) -> DbResult<bool> {
    let cutoff = Utc::now() - Duration::hours(min_interval_hours);
    Ok(collect_database_backup_candidates(paths)?
        .into_iter()
        .any(|candidate| DateTime::<Utc>::from(candidate.modified) >= cutoff))
}

fn create_update_protection_backup_with_paths(
    paths: &AppPaths,
) -> DbResult<DatabaseUpdateProtectionBackupReport> {
    let created_at = Utc::now();
    let target_dir = paths.database_backups().join("update-protection");
    fs::create_dir_all(&target_dir)?;
    let file_name = format!("before-update-{}.db", created_at.format("%Y%m%d-%H%M%S"));
    let target = target_dir.join(&file_name);

    let report = create_verified_database_backup_with_paths(paths, &target)?;

    logger::log_warn(
        paths,
        "database.backup",
        format!(
            "update protection backup created: {} ({} bytes)",
            logger::display_path(&report.target_path),
            report.size_bytes
        ),
    );

    Ok(DatabaseUpdateProtectionBackupReport {
        path: report.target_path.to_string_lossy().to_string(),
        file_name,
        size_bytes: report.size_bytes,
        created_at: created_at.to_rfc3339(),
        quick_check: report.quick_check,
    })
}

fn create_verified_database_backup_with_paths(
    paths: &AppPaths,
    target: &Path,
) -> DbResult<VerifiedDatabaseBackupReport> {
    let database = paths.database();
    if !database.is_file() {
        return Err(DbError::path_not_found("current database does not exist"));
    }

    let db = Database::new_from_path(database)?;
    db.backup_to_path(target)?;
    let quick_check = validate_database_backup_file(target)?;
    let size_bytes = fs::metadata(target)?.len();

    Ok(VerifiedDatabaseBackupReport {
        target_path: target.to_path_buf(),
        size_bytes,
        quick_check,
    })
}

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

fn move_file(source: &Path, target: &Path) -> DbResult<()> {
    match fs::rename(source, target) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(source, target)?;
            fs::remove_file(source)?;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn pending_restore_replaces_database_after_protection_backup() {
        let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");
        let source = root.join("backup.db");
        create_mikavn_db(&source, "restored");

        let report = schedule_pending_restore(&paths, &source).unwrap();
        assert!(report.pending_path.is_file());
        assert_eq!(report.source_size_bytes, report.pending_size_bytes);
        apply_pending_database_restore(&paths).unwrap();

        assert_eq!(database_marker(&paths.database()), "restored");
        assert!(!report.pending_path.exists());
        assert_eq!(
            fs::read_dir(paths.database_restore_protection())
                .unwrap()
                .count(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn schedule_restore_rejects_non_mikavn_sqlite_database() {
        let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        let source = root.join("foreign.db");
        Connection::open(&source)
            .unwrap()
            .execute_batch("CREATE TABLE other_app (id TEXT PRIMARY KEY);")
            .unwrap();

        let error = schedule_pending_restore(&paths, &source).unwrap_err();

        assert_eq!(error.code, "BACKUP_FAILED");
        assert!(error.message.contains("MikaVN"));
        assert!(!paths.database_restore_pending().join("mikavn.db").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn pending_restore_rejects_invalid_file_without_replacing_database() {
        let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");
        let pending = paths.database_restore_pending().join("mikavn.db");
        fs::write(&pending, b"not sqlite").unwrap();

        apply_pending_database_restore(&paths).unwrap();

        assert_eq!(database_marker(&paths.database()), "current");
        assert!(!pending.exists());
        assert_eq!(
            fs::read_dir(paths.database_restore_pending())
                .unwrap()
                .filter(|entry| entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .starts_with("rejected-"))
                .count(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_old_database_backups_removes_only_safe_old_backups() {
        let root =
            std::env::temp_dir().join(format!("mikavn-backup-cleanup-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");

        let old_backup = paths
            .root()
            .join("mikavn.before-playnite-import-20260101-000000.db");
        let newest_backup = paths
            .root()
            .join("mikavn.before-playnite-import-20260102-000000.db");
        let unrelated = paths.root().join("manual-copy.db");
        fs::write(&old_backup, b"old").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&newest_backup, b"new").unwrap();
        fs::write(&unrelated, b"manual").unwrap();

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
        assert!(unrelated.exists());
        assert!(paths.database().exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn database_backup_summary_includes_restore_protection_backups() {
        let root =
            std::env::temp_dir().join(format!("mikavn-backup-summary-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        let import_backup = paths
            .archive_import_protection()
            .join("before-import-20260101-000000.db");
        let restore_backup = paths
            .database_restore_protection()
            .join("before-restore-20260101-000000.db");
        fs::create_dir_all(paths.archive_import_protection()).unwrap();
        fs::create_dir_all(paths.database_restore_protection()).unwrap();
        fs::write(&import_backup, b"import").unwrap();
        fs::write(&restore_backup, b"restore").unwrap();

        let summary = database_backup_summary(&paths).unwrap();

        assert_eq!(summary.file_count, 2);
        assert!(summary
            .files
            .iter()
            .any(|file| file.file_name == "before-import-20260101-000000.db"));
        assert!(summary
            .files
            .iter()
            .any(|file| file.file_name == "before-restore-20260101-000000.db"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn update_protection_backup_creates_verified_database_copy() {
        let root =
            std::env::temp_dir().join(format!("mikavn-update-backup-test-{}", Uuid::new_v4()));
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
        let root = std::env::temp_dir().join(format!(
            "mikavn-update-backup-summary-test-{}",
            Uuid::new_v4()
        ));
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
        assert!(summary
            .files
            .iter()
            .any(|file| file.file_name == "before-update-20260101-000000.db"));

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

    #[test]
    fn legacy_update_protection_backups_are_listed_and_cleanup_safe() {
        let root = std::env::temp_dir().join(format!(
            "mikavn-legacy-update-backup-summary-test-{}",
            Uuid::new_v4()
        ));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");
        let legacy_dir = paths.root().join("database-update-protection");
        let old_backup = legacy_dir.join("before-manual-install-20260101-000000.db");
        let newest_backup = legacy_dir.join("before-017-manual-install-20260102-000000.db");
        let unrelated = legacy_dir.join("manual-copy.db");
        fs::create_dir_all(&legacy_dir).unwrap();
        fs::write(&old_backup, b"old").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&newest_backup, b"new").unwrap();
        fs::write(&unrelated, b"manual").unwrap();

        let summary = database_backup_summary(&paths).unwrap();
        assert_eq!(summary.file_count, 2);
        assert!(summary
            .files
            .iter()
            .any(|file| file.file_name == "before-manual-install-20260101-000000.db"));
        assert!(summary
            .files
            .iter()
            .any(|file| file.file_name == "before-017-manual-install-20260102-000000.db"));

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
        assert!(unrelated.exists());
        assert!(paths.database().exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn startup_automatic_backup_creates_when_no_recent_backup_exists() {
        let root = std::env::temp_dir().join(format!(
            "mikavn-startup-auto-backup-test-{}",
            Uuid::new_v4()
        ));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");

        let report = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();

        let report = report.expect("startup auto backup should be created");
        assert_eq!(report.quick_check, "ok");
        assert!(report.file_name.starts_with("startup-auto-"));
        assert!(report.file_name.ends_with(".db"));
        assert!(report.path.contains("database-backups"));
        assert!(report.path.contains("auto"));
        assert!(Path::new(&report.path).is_file());
        assert_eq!(database_marker(Path::new(&report.path)), "current");

        let summary = database_backup_summary(&paths).unwrap();
        assert_eq!(summary.file_count, 1);
        assert_eq!(summary.files[0].file_name, report.file_name);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn startup_automatic_backup_skips_when_recent_backup_exists() {
        let root = std::env::temp_dir().join(format!(
            "mikavn-startup-auto-backup-skip-test-{}",
            Uuid::new_v4()
        ));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");

        let first = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();
        let second = create_startup_automatic_backup_if_needed_with_paths(&paths).unwrap();

        assert!(first.is_some());
        assert!(second.is_none());
        let summary = database_backup_summary(&paths).unwrap();
        assert_eq!(summary.file_count, 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn database_backup_report_log_describes_target_and_size() {
        let message = database_backup_report_log("D:\\MikaVN-Backups\\manual.db", 131072, "ok");

        assert_eq!(
            message,
            "数据库备份报告：目标 D:\\MikaVN-Backups\\manual.db，大小 131072 bytes，quick_check ok。"
        );
    }

    #[test]
    fn manual_database_backup_creates_verified_database_copy() {
        let root =
            std::env::temp_dir().join(format!("mikavn-manual-backup-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        create_mikavn_db(&paths.database(), "current");
        let target = paths.database_backups().join("manual").join("manual.db");

        let report = create_verified_database_backup_with_paths(&paths, &target).unwrap();

        assert_eq!(report.quick_check, "ok");
        assert_eq!(report.target_path, target);
        assert_eq!(
            report.size_bytes,
            fs::metadata(&report.target_path).unwrap().len()
        );
        assert_eq!(database_marker(&report.target_path), "current");
        let _ = fs::remove_dir_all(root);
    }

    fn create_mikavn_db(path: &Path, title: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              install_path TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO games (id, title, install_path, created_at, updated_at) VALUES ('game', ?1, 'D:\\Game', 'now', 'now')",
            [title],
        )
        .unwrap();
    }

    fn database_marker(path: &Path) -> String {
        Connection::open(path)
            .unwrap()
            .query_row("SELECT title FROM games WHERE id = 'game'", [], |row| {
                row.get(0)
            })
            .unwrap()
    }
}
