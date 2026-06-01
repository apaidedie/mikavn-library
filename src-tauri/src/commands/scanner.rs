use tauri::{AppHandle, State};

use crate::db::models::{
    Game, ImportCandidate, LibraryRoot, ScanCandidate, ScanTaskStatus, TaskRecord,
};
use crate::db::DbResult;
use crate::services::scanner as scanner_service;
use crate::AppState;

#[tauri::command]
pub fn add_library_root(state: State<'_, AppState>, path: String) -> DbResult<LibraryRoot> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::add_library_root(&db, path)
}

#[tauri::command]
pub fn list_library_roots(state: State<'_, AppState>) -> DbResult<Vec<LibraryRoot>> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::list_library_roots(&db)
}

#[tauri::command]
pub fn update_library_root(
    state: State<'_, AppState>,
    id: String,
    recursive: Option<bool>,
    enabled: Option<bool>,
) -> DbResult<LibraryRoot> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::update_library_root(&db, id, recursive, enabled)
}

#[tauri::command]
pub fn remove_library_root(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::remove_library_root(&db, id)
}

#[tauri::command]
pub fn scan_library_root(state: State<'_, AppState>, id: String) -> DbResult<Vec<ScanCandidate>> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::scan_library_root(&db, id)
}

#[tauri::command]
pub fn scan_path_preview(
    state: State<'_, AppState>,
    path: String,
    recursive: bool,
) -> DbResult<Vec<ScanCandidate>> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::scan_path_preview(&db, path, recursive)
}

#[tauri::command]
pub fn start_scan_task(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    recursive: bool,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::enqueue_scan_task(app, &db, path, recursive)
}

#[tauri::command]
pub fn get_scan_task_status(
    state: State<'_, AppState>,
    task_id: String,
) -> DbResult<ScanTaskStatus> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::get_scan_task_status(&db, task_id)
}

#[tauri::command]
pub fn import_scan_candidates(
    state: State<'_, AppState>,
    candidates: Vec<ImportCandidate>,
) -> DbResult<Vec<Game>> {
    let db = state.db.lock().expect("database mutex poisoned");
    scanner_service::import_scan_candidates(&db, candidates)
}
