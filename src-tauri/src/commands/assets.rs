use tauri::{AppHandle, State};

use crate::db::models::{
    AssetCacheCleanupResult, AssetDownloadInput, AssetImportInput, AssetInput, Game, GameAsset,
    TagRecord,
};
use crate::db::DbResult;
use crate::services::assets as asset_service;
use crate::AppState;

#[tauri::command]
pub fn list_game_assets(state: State<'_, AppState>, game_id: String) -> DbResult<Vec<GameAsset>> {
    let db = state.db()?;
    asset_service::list_game_assets(&db, game_id)
}

#[tauri::command]
pub fn upsert_game_asset(
    state: State<'_, AppState>,
    game_id: String,
    input: AssetInput,
) -> DbResult<GameAsset> {
    let db = state.db()?;
    asset_service::upsert_game_asset(&db, game_id, input)
}

#[tauri::command]
pub fn remove_game_asset(state: State<'_, AppState>, id: String) -> DbResult<Game> {
    let db = state.db()?;
    asset_service::remove_game_asset(&db, id)
}

#[tauri::command]
pub fn set_primary_asset(state: State<'_, AppState>, id: String) -> DbResult<Game> {
    let db = state.db()?;
    asset_service::set_primary_asset(&db, id)
}

#[tauri::command]
pub fn import_game_asset_from_path(
    app: AppHandle,
    state: State<'_, AppState>,
    game_id: String,
    input: AssetImportInput,
) -> DbResult<GameAsset> {
    let db = state.db()?;
    asset_service::import_game_asset_from_path(&app, &db, game_id, input)
}

#[tauri::command]
pub fn download_game_asset(
    app: AppHandle,
    state: State<'_, AppState>,
    game_id: String,
    input: AssetDownloadInput,
) -> DbResult<GameAsset> {
    let db = state.db()?;
    asset_service::download_game_asset(&app, &db, game_id, input)
}

#[tauri::command]
pub fn cleanup_asset_cache(
    app: AppHandle,
    state: State<'_, AppState>,
) -> DbResult<AssetCacheCleanupResult> {
    let db = state.db()?;
    asset_service::cleanup_asset_cache(&app, &db)
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>, kind: Option<String>) -> DbResult<Vec<TagRecord>> {
    let db = state.db()?;
    asset_service::list_tags(&db, kind)
}

#[tauri::command]
pub fn rename_tag(state: State<'_, AppState>, id: String, name: String) -> DbResult<TagRecord> {
    let db = state.db()?;
    asset_service::rename_tag(&db, id, name)
}

#[tauri::command]
pub fn merge_tags(
    state: State<'_, AppState>,
    source_ids: Vec<String>,
    target_id: String,
) -> DbResult<TagRecord> {
    let db = state.db()?;
    asset_service::merge_tags(&db, source_ids, target_id)
}

#[tauri::command]
pub fn delete_tag(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    asset_service::delete_tag(&db, id)
}
