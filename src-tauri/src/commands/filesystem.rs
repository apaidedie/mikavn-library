use tauri::AppHandle;

use crate::db::DbResult;
use crate::services::filesystem as filesystem_service;

#[tauri::command]
pub fn reveal_path(app: AppHandle, path: String) -> DbResult<()> {
    filesystem_service::reveal_path(&app, path)
}
