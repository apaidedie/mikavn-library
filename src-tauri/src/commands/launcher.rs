use tauri::{AppHandle, State};

use crate::db::models::{
    CreateLaunchProfileInput, LaunchProfile, PlaySession, UpdateLaunchProfileInput,
};
use crate::db::DbResult;
use crate::services::launcher as launcher_service;
use crate::AppState;

#[tauri::command]
pub fn list_launch_profiles(
    state: State<'_, AppState>,
    game_id: String,
) -> DbResult<Vec<LaunchProfile>> {
    let db = state.db()?;
    launcher_service::list_launch_profiles(&db, game_id)
}

#[tauri::command]
pub fn create_launch_profile(
    state: State<'_, AppState>,
    input: CreateLaunchProfileInput,
) -> DbResult<LaunchProfile> {
    let db = state.db()?;
    launcher_service::create_launch_profile(&db, input)
}

#[tauri::command]
pub fn update_launch_profile(
    state: State<'_, AppState>,
    id: String,
    input: UpdateLaunchProfileInput,
) -> DbResult<LaunchProfile> {
    let db = state.db()?;
    launcher_service::update_launch_profile(&db, id, input)
}

#[tauri::command]
pub fn delete_launch_profile(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    launcher_service::delete_launch_profile(&db, id)
}

#[tauri::command]
pub fn set_default_launch_profile(
    state: State<'_, AppState>,
    id: String,
) -> DbResult<LaunchProfile> {
    let db = state.db()?;
    launcher_service::set_default_launch_profile(&db, id)
}

#[tauri::command]
pub fn list_play_sessions(
    state: State<'_, AppState>,
    game_id: String,
    limit: Option<i64>,
) -> DbResult<Vec<PlaySession>> {
    let db = state.db()?;
    launcher_service::list_play_sessions(&db, game_id, limit)
}

#[tauri::command]
pub fn launch_game(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> DbResult<PlaySession> {
    let db = state.db()?;
    launcher_service::launch_game(app, &db, id)
}

#[tauri::command]
pub fn launch_game_with_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    profile_id: Option<String>,
) -> DbResult<PlaySession> {
    let db = state.db()?;
    launcher_service::launch_game_with_profile(app, &db, id, profile_id)
}
