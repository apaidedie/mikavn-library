use tauri::{AppHandle, State};

use crate::db::models::{TaskDetail, TaskLogEntry, TaskRecord};
use crate::db::DbResult;
use crate::services::tasks as task_service;
use crate::AppState;

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    state: State<'_, AppState>,
    task_type: String,
    message: Option<String>,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::create_task(&app, &db, &task_type, message)
}

#[tauri::command]
pub fn list_tasks(state: State<'_, AppState>, limit: Option<i64>) -> DbResult<Vec<TaskRecord>> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::list_tasks(&db, limit)
}

#[tauri::command]
pub fn get_task(state: State<'_, AppState>, id: String) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::get_task(&db, id)
}

#[tauri::command]
pub fn get_task_detail(state: State<'_, AppState>, id: String) -> DbResult<TaskDetail> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::get_task_detail(&db, id)
}

#[tauri::command]
pub fn list_task_logs(state: State<'_, AppState>, task_id: String) -> DbResult<Vec<TaskLogEntry>> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::list_task_logs(&db, task_id)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    status: String,
    progress: f64,
    message: Option<String>,
    error: Option<String>,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::update_task(&app, &db, &id, &status, progress, message, error)
}

#[tauri::command]
pub fn cancel_task(app: AppHandle, state: State<'_, AppState>, id: String) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::cancel_task(&app, &db, id)
}

#[tauri::command]
pub fn retry_task(app: AppHandle, state: State<'_, AppState>, id: String) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    task_service::retry_task(app, &db, id)
}
