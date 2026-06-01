use tauri::AppHandle;

use crate::db::DbResult;
use crate::services::logs as log_service;

pub use log_service::{LogRecord, LogRetentionPolicy};

#[tauri::command]
pub fn list_diagnostic_logs(app: AppHandle, limit: Option<i64>) -> DbResult<Vec<LogRecord>> {
    log_service::list_diagnostic_logs(&app, limit)
}

#[tauri::command]
pub fn get_log_retention() -> LogRetentionPolicy {
    log_service::get_log_retention()
}

#[tauri::command]
pub fn prune_diagnostic_logs(app: AppHandle, policy: LogRetentionPolicy) -> DbResult<i64> {
    log_service::prune_diagnostic_logs(&app, policy)
}
