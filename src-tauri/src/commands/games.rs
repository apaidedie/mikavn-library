use tauri::{AppHandle, State};

use crate::db::models::{
    AddGameInput, Game, GameFilter, GamePathHealth, TaskRecord, UpdateGameInput,
};
use crate::db::DbResult;
use crate::services::games as game_service;
use crate::services::library_paths as path_service;
use crate::AppState;

#[tauri::command]
pub fn add_game(state: State<'_, AppState>, input: AddGameInput) -> DbResult<Game> {
    let db = state.db.lock().expect("database mutex poisoned");
    game_service::add_game(&db, input)
}

#[tauri::command]
pub fn update_game(
    state: State<'_, AppState>,
    id: String,
    input: UpdateGameInput,
) -> DbResult<Game> {
    let db = state.db.lock().expect("database mutex poisoned");
    game_service::update_game(&db, id, input)
}

#[tauri::command]
pub fn delete_game_record(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db.lock().expect("database mutex poisoned");
    game_service::delete_game_record(&db, id)
}

#[tauri::command]
pub fn list_games(state: State<'_, AppState>, filter: Option<GameFilter>) -> DbResult<Vec<Game>> {
    let db = state.db.lock().expect("database mutex poisoned");
    game_service::list_games(&db, filter)
}

#[tauri::command]
pub fn get_game(state: State<'_, AppState>, id: String) -> DbResult<Game> {
    let db = state.db.lock().expect("database mutex poisoned");
    game_service::get_game(&db, id)
}

#[tauri::command]
pub fn check_game_paths(state: State<'_, AppState>, id: String) -> DbResult<GamePathHealth> {
    let db = state.db.lock().expect("database mutex poisoned");
    path_service::check_game_paths(&db, id)
}

#[tauri::command]
pub fn check_game_paths_task(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> DbResult<TaskRecord> {
    let db = state.db.lock().expect("database mutex poisoned");
    path_service::enqueue_path_check_task(app, &db, id)
}

#[tauri::command]
pub fn relocate_game_paths(
    state: State<'_, AppState>,
    id: String,
    install_path: String,
) -> DbResult<Game> {
    let db = state.db.lock().expect("database mutex poisoned");
    path_service::relocate_game_paths(&db, id, install_path)
}
