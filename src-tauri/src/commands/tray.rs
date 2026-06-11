use tauri::State;

use crate::db::DbResult;
use crate::services::tray::{self, TrayStatus};
use crate::AppState;

#[tauri::command]
pub fn get_tray_status(state: State<'_, AppState>) -> DbResult<TrayStatus> {
    let db = state.db()?;
    Ok(tray::tray_status_for_db(&db))
}
