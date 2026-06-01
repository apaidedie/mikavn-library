use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use chrono::Utc;
use tauri::AppHandle;

use crate::db::models::TaskRecord;
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

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
        let result = schedule_pending_restore(&paths, &source);
        match result {
            Ok(pending) => {
                logger::log_warn(
                    &paths,
                    "database.restore",
                    format!(
                        "database restore scheduled from {}",
                        logger::display_path(&source)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "数据库恢复已安排，下次启动时应用：{}",
                        logger::display_path(&pending)
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

    let database = paths.database();
    if database.is_file() {
        fs::create_dir_all(paths.database_restore_protection())?;
        let protection = paths.database_restore_protection().join(format!(
            "before-restore-{}.db",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        fs::copy(&database, &protection)?;
        logger::log_warn(
            paths,
            "database.restore",
            format!(
                "protection backup before restore: {}",
                logger::display_path(&protection)
            ),
        );
    }
    fs::copy(&pending, &database)?;
    fs::remove_file(&pending)?;
    logger::log_warn(
        paths,
        "database.restore",
        "pending database restore applied",
    );
    Ok(())
}

fn schedule_pending_restore(paths: &AppPaths, source: &Path) -> DbResult<PathBuf> {
    fs::create_dir_all(paths.database_restore_pending())?;
    let target = paths.database_restore_pending().join("mikavn.db");
    fs::copy(source, &target)?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn pending_restore_replaces_database_after_protection_backup() {
        let root = std::env::temp_dir().join(format!("mikavn-restore-test-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::write(paths.database(), b"current").unwrap();
        let source = root.join("backup.db");
        fs::write(&source, b"restored").unwrap();

        let pending = schedule_pending_restore(&paths, &source).unwrap();
        assert!(pending.is_file());
        apply_pending_database_restore(&paths).unwrap();

        assert_eq!(fs::read(paths.database()).unwrap(), b"restored");
        assert!(!pending.exists());
        assert_eq!(
            fs::read_dir(paths.database_restore_protection())
                .unwrap()
                .count(),
            1
        );
        let _ = fs::remove_dir_all(root);
    }
}
