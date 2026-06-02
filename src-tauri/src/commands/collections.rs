use tauri::State;

use crate::db::models::{
    CollectionGameLink, CollectionInput, Game, GameCollection, UpdateCollectionInput,
};
use crate::db::DbResult;
use crate::services::collections as collection_service;
use crate::AppState;

#[tauri::command]
pub fn list_collections(state: State<'_, AppState>) -> DbResult<Vec<GameCollection>> {
    let db = state.db()?;
    collection_service::list_collections(&db)
}

#[tauri::command]
pub fn create_collection(
    state: State<'_, AppState>,
    input: CollectionInput,
) -> DbResult<GameCollection> {
    let db = state.db()?;
    collection_service::create_collection(&db, input)
}

#[tauri::command]
pub fn update_collection(
    state: State<'_, AppState>,
    id: String,
    input: UpdateCollectionInput,
) -> DbResult<GameCollection> {
    let db = state.db()?;
    collection_service::update_collection(&db, id, input)
}

#[tauri::command]
pub fn delete_collection(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    collection_service::delete_collection(&db, id)
}

#[tauri::command]
pub fn list_collection_games(
    state: State<'_, AppState>,
    collection_id: String,
) -> DbResult<Vec<Game>> {
    let db = state.db()?;
    collection_service::list_collection_games(&db, collection_id)
}

#[tauri::command]
pub fn add_game_to_collection(
    state: State<'_, AppState>,
    collection_id: String,
    game_id: String,
) -> DbResult<CollectionGameLink> {
    let db = state.db()?;
    collection_service::add_game_to_collection(&db, collection_id, game_id)
}

#[tauri::command]
pub fn remove_game_from_collection(
    state: State<'_, AppState>,
    collection_id: String,
    game_id: String,
) -> DbResult<()> {
    let db = state.db()?;
    collection_service::remove_game_from_collection(&db, collection_id, game_id)
}
