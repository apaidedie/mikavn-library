use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::db::models::{SaveBackup, SavePath, SavePathCandidate, TaskRecord};
use crate::db::DbResult;
use crate::services::saves as save_service;
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestoreOptions {
    pub mode: Option<String>,
}

#[tauri::command]
pub fn list_save_paths(state: State<'_, AppState>, game_id: String) -> DbResult<Vec<SavePath>> {
    let db = state.db()?;
    save_service::list_save_paths(&db, game_id)
}

#[tauri::command]
pub fn add_save_path(
    state: State<'_, AppState>,
    game_id: String,
    label: String,
    path: String,
) -> DbResult<SavePath> {
    let db = state.db()?;
    save_service::add_save_path(&db, game_id, label, path)
}

#[tauri::command]
pub fn remove_save_path(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    save_service::remove_save_path(&db, id)
}

#[tauri::command]
pub fn suggest_save_paths(
    state: State<'_, AppState>,
    game_id: String,
) -> DbResult<Vec<SavePathCandidate>> {
    let db = state.db()?;
    save_service::suggest_save_paths(&db, game_id)
}

#[tauri::command]
pub fn create_save_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    save_path_id: String,
    label: String,
) -> DbResult<SaveBackup> {
    let db = state.db()?;
    save_service::create_save_backup(&app, &db, save_path_id, label)
}

#[tauri::command]
pub fn create_save_backup_task(
    app: AppHandle,
    state: State<'_, AppState>,
    save_path_id: String,
    label: String,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    save_service::enqueue_save_backup_task(app, &db, save_path_id, label)
}

#[tauri::command]
pub fn list_save_backups(state: State<'_, AppState>, game_id: String) -> DbResult<Vec<SaveBackup>> {
    let db = state.db()?;
    save_service::list_save_backups(&db, game_id)
}

#[tauri::command]
pub fn restore_save_backup(
    app: AppHandle,
    state: State<'_, AppState>,
    backup_id: String,
) -> DbResult<SaveBackup> {
    let db = state.db()?;
    save_service::restore_save_backup(&app, &db, backup_id)
}

#[tauri::command]
pub fn restore_save_backup_task(
    app: AppHandle,
    state: State<'_, AppState>,
    backup_id: String,
    options: Option<SaveRestoreOptions>,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    save_service::enqueue_save_restore_task(
        app,
        &db,
        backup_id,
        save_service::restore_mode(options.and_then(|item| item.mode)),
    )
}

#[tauri::command]
pub fn delete_save_backup_record(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    save_service::delete_save_backup_record(&db, id)
}
