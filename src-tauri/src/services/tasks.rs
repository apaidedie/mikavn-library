use serde::Deserialize;
use tauri::{AppHandle, Emitter};

use crate::db::models::{TaskDetail, TaskLogEntry, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::services::archives as archive_service;
use crate::services::backups as backup_service;
use crate::services::library_paths as path_service;
use crate::services::metadata as metadata_service;
use crate::services::metadata_description_images as description_image_service;
use crate::services::metadata_duplicate_ids as duplicate_id_service;
use crate::services::saves as save_service;
use crate::services::scanner as scanner_service;

pub const TASK_UPDATED_EVENT: &str = "task://updated";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanRetryPayload {
    path: String,
    recursive: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseBackupRetryPayload {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveBackupRetryPayload {
    save_path_id: String,
    label: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveRestoreRetryPayload {
    backup_id: String,
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveExportRetryPayload {
    target_dir: String,
    include_images: Option<bool>,
    include_save_backups: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveImportRetryPayload {
    archive_dir: String,
    include_images: Option<bool>,
    include_save_backups: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathCheckRetryPayload {
    game_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetadataBatchRetryPayload {
    game_ids: Vec<String>,
}

pub fn create_task(
    app: &AppHandle,
    db: &Database,
    task_type: &str,
    message: Option<String>,
) -> DbResult<TaskRecord> {
    let task = db.create_task_with_payload(task_type, message, None, false)?;
    emit_task_updated(app, &task);
    Ok(task)
}

pub fn create_task_with_payload(
    app: &AppHandle,
    db: &Database,
    task_type: &str,
    message: Option<String>,
    retry_payload: Option<String>,
    retryable: bool,
) -> DbResult<TaskRecord> {
    let task = db.create_task_with_payload(task_type, message, retry_payload, retryable)?;
    emit_task_updated(app, &task);
    Ok(task)
}

pub fn update_task(
    app: &AppHandle,
    db: &Database,
    id: &str,
    status: &str,
    progress: f64,
    message: Option<String>,
    error: Option<String>,
) -> DbResult<TaskRecord> {
    let task = db.update_task(id, status, progress, message, error)?;
    emit_task_updated(app, &task);
    Ok(task)
}

pub fn list_tasks(db: &Database, limit: Option<i64>) -> DbResult<Vec<TaskRecord>> {
    db.list_tasks(limit.unwrap_or(50))
}

pub fn get_task(db: &Database, id: String) -> DbResult<TaskRecord> {
    db.get_task(&id)
}

pub fn get_task_detail(db: &Database, id: String) -> DbResult<TaskDetail> {
    db.get_task_detail(&id)
}

pub fn list_task_logs(db: &Database, task_id: String) -> DbResult<Vec<TaskLogEntry>> {
    db.list_task_logs(&task_id)
}

pub fn cancel_task(app: &AppHandle, db: &Database, id: String) -> DbResult<TaskRecord> {
    let task = update_task(
        app,
        db,
        &id,
        "cancelled",
        1.0,
        Some("任务已取消".to_string()),
        None,
    )?;
    if task.task_type == "metadata.batch_match" {
        if let Ok(Some(job)) = db.find_match_job_by_task_id(&id) {
            let _ = db.set_match_job_status(&job.id, "cancelled");
        }
    }
    Ok(task)
}

pub fn retry_task(app: AppHandle, db: &Database, id: String) -> DbResult<TaskRecord> {
    let task = db.get_task(&id)?;
    ensure_retryable(&task)?;

    let payload = task
        .retry_payload
        .as_deref()
        .filter(|item| !item.trim().is_empty())
        .ok_or_else(|| DbError::validation("task retry payload is missing"))?;

    match task.task_type.as_str() {
        "library.scan" => {
            let payload: ScanRetryPayload = serde_json::from_str(payload)?;
            scanner_service::enqueue_scan_task(app, db, payload.path, payload.recursive)
        }
        "database.backup" => {
            let payload: DatabaseBackupRetryPayload = serde_json::from_str(payload)?;
            backup_service::enqueue_database_backup_task(app, db, payload.path)
        }
        "save.backup" => {
            let payload: SaveBackupRetryPayload = serde_json::from_str(payload)?;
            save_service::enqueue_save_backup_task(app, db, payload.save_path_id, payload.label)
        }
        "save.restore" => {
            let payload: SaveRestoreRetryPayload = serde_json::from_str(payload)?;
            save_service::enqueue_save_restore_task(
                app,
                db,
                payload.backup_id,
                payload.mode.unwrap_or_else(|| "merge".to_string()),
            )
        }
        "library.archive_export" => {
            let payload: ArchiveExportRetryPayload = serde_json::from_str(payload)?;
            archive_service::enqueue_library_archive_export_task(
                app,
                db,
                archive_service::LibraryArchiveExportOptions {
                    target_dir: payload.target_dir,
                    include_images: payload.include_images,
                    include_save_backups: payload.include_save_backups,
                },
            )
        }
        "library.archive_export_zip" => {
            let payload: ArchiveExportRetryPayload = serde_json::from_str(payload)?;
            archive_service::enqueue_library_archive_export_zip_task(
                app,
                db,
                archive_service::LibraryArchiveExportOptions {
                    target_dir: payload.target_dir,
                    include_images: payload.include_images,
                    include_save_backups: payload.include_save_backups,
                },
            )
        }
        "library.archive_import" => {
            let payload: ArchiveImportRetryPayload = serde_json::from_str(payload)?;
            archive_service::enqueue_library_archive_import_task(
                app,
                db,
                archive_service::LibraryArchiveImportOptions {
                    archive_dir: payload.archive_dir,
                    include_images: payload.include_images,
                    include_save_backups: payload.include_save_backups,
                },
            )
        }
        "game.path_check" => {
            let payload: PathCheckRetryPayload = serde_json::from_str(payload)?;
            path_service::enqueue_path_check_task(app, db, payload.game_id)
        }
        "metadata.batch_match" => {
            let payload: MetadataBatchRetryPayload = serde_json::from_str(payload)?;
            let (_, task) =
                metadata_service::enqueue_batch_match_metadata(app, db, payload.game_ids)?;
            Ok(task)
        }
        "metadata.description_image_repair" => {
            description_image_service::retry_description_image_repair_task(app, db, payload)
        }
        "metadata.duplicate_id_audit" => {
            duplicate_id_service::retry_duplicate_external_id_audit_task(app, db, payload)
        }
        _ => Err(DbError::validation(
            "this task type does not support retry yet",
        )),
    }
}

fn ensure_retryable(task: &TaskRecord) -> DbResult<()> {
    if !task.retryable {
        return Err(DbError::validation("task is not retryable"));
    }
    if task.status != "failed" && task.status != "cancelled" {
        return Err(DbError::validation(
            "only failed or cancelled tasks can be retried",
        ));
    }
    Ok(())
}

pub fn emit_task_updated(app: &AppHandle, task: &TaskRecord) {
    let _ = app.emit(TASK_UPDATED_EVENT, task);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(status: &str, retryable: bool) -> TaskRecord {
        TaskRecord {
            id: "task".to_string(),
            task_type: "library.scan".to_string(),
            status: status.to_string(),
            progress: 0.0,
            message: None,
            error: None,
            retry_payload: Some("{}".to_string()),
            retryable,
            created_at: "now".to_string(),
            updated_at: "now".to_string(),
        }
    }

    #[test]
    fn retry_validation_rejects_non_retryable_task() {
        let error = ensure_retryable(&task("failed", false)).unwrap_err();
        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    #[test]
    fn retry_validation_requires_failed_or_cancelled_status() {
        let error = ensure_retryable(&task("running", true)).unwrap_err();
        assert_eq!(error.code, "VALIDATION_ERROR");
    }

    #[test]
    fn retry_validation_accepts_cancelled_retryable_task() {
        ensure_retryable(&task("cancelled", true)).unwrap();
    }
}
