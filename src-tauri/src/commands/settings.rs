use std::collections::HashMap;

use tauri::State;

use crate::db::DbResult;
use crate::services::settings as settings_service;
use crate::AppState;

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> DbResult<HashMap<String, String>> {
    let db = state.db()?;
    settings_service::get_app_settings(&db)
}

#[tauri::command]
pub fn set_app_setting(state: State<'_, AppState>, key: String, value: String) -> DbResult<()> {
    let db = state.db()?;
    settings_service::set_app_setting(&db, key, value)
}

#[tauri::command]
pub fn set_app_settings(
    state: State<'_, AppState>,
    settings: HashMap<String, String>,
) -> DbResult<()> {
    let db = state.db()?;
    settings_service::set_app_settings(&db, settings)
}
