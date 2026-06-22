use tauri::State;

use tauri::AppHandle;

use crate::db::models::{DashboardData, ReportSummary, TaskRecord};
use crate::db::DbResult;
use crate::services::reports as report_service;
use crate::AppState;

#[tauri::command]
pub fn get_dashboard(state: State<'_, AppState>) -> DbResult<DashboardData> {
    let db = state.db()?;
    report_service::get_dashboard(&db)
}

#[tauri::command]
pub fn get_report_summary(state: State<'_, AppState>) -> DbResult<ReportSummary> {
    let db = state.db()?;
    report_service::get_report_summary(&db)
}

#[tauri::command]
pub fn export_report_markdown(path: String, content: String) -> DbResult<()> {
    report_service::export_report_markdown(path, content)
}

#[tauri::command]
pub fn export_report_markdown_task(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    content: String,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    report_service::enqueue_report_export_task(app, &db, path, content)
}
