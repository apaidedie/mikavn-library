use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use chrono::Utc;
use rusqlite::{Connection, OpenFlags};
use tauri::AppHandle;

use crate::db::models::TaskRecord;
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

#[derive(Debug)]
struct DatabaseRestoreScheduleReport {
    pending_path: PathBuf,
    source_size_bytes: u64,
    pending_size_bytes: u64,
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
        match db.backup_to_path(&target) {
            Ok(()) => {
                logger::log_info(
                    &paths,
                    "database.backup",
                    format!(
                        "database backup written to {}",
                        logger::display_path(&target)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "数据库备份已写入 {}",
                        logger::display_path(&target)
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

fn validate_restore_database_file(path: &Path) -> DbResult<()> {
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
    Ok(())
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
