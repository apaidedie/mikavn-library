use tauri::{AppHandle, State};

use crate::db::models::TaskRecord;
use crate::db::DbResult;
use crate::services::backups as backup_service;
use crate::AppState;

#[tauri::command]
pub fn backup_database(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    backup_service::enqueue_database_backup_task(app, &db, path)
}

#[tauri::command]
pub fn restore_database_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    backup_service::enqueue_database_restore_task(app, &db, path)
}
