use tauri::{AppHandle, State};

use crate::db::models::TaskRecord;
use crate::db::DbResult;
use crate::services::archives as archive_service;
use crate::AppState;

pub use archive_service::{
    LibraryArchiveExportOptions, LibraryArchiveImportOptions, LibraryArchivePreview,
};

#[tauri::command]
pub fn export_library_archive(
    app: AppHandle,
    state: State<'_, AppState>,
    options: LibraryArchiveExportOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    archive_service::enqueue_library_archive_export_task(app, &db, options)
}

#[tauri::command]
pub fn export_library_archive_zip(
    app: AppHandle,
    state: State<'_, AppState>,
    options: LibraryArchiveExportOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    archive_service::enqueue_library_archive_export_zip_task(app, &db, options)
}

#[tauri::command]
pub fn preview_library_archive(path: String) -> DbResult<LibraryArchivePreview> {
    archive_service::preview_library_archive(path)
}

#[tauri::command]
pub fn import_library_archive(
    app: AppHandle,
    state: State<'_, AppState>,
    options: LibraryArchiveImportOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    archive_service::enqueue_library_archive_import_task(app, &db, options)
}
