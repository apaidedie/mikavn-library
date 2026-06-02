use tauri::State;

use crate::db::models::{
    AdvancedSearchInput, AdvancedSearchResult, SavedSearch, SavedSearchInput, SearchQueryValidation,
};
use crate::db::DbResult;
use crate::services::search as search_service;
use crate::AppState;

#[tauri::command]
pub fn search_games_advanced(
    state: State<'_, AppState>,
    input: AdvancedSearchInput,
) -> DbResult<AdvancedSearchResult> {
    let db = state.db()?;
    search_service::search_games(&db, input)
}

#[tauri::command]
pub fn validate_search_query(
    _state: State<'_, AppState>,
    query: String,
) -> DbResult<SearchQueryValidation> {
    Ok(search_service::validate_search_query(query))
}

#[tauri::command]
pub fn list_saved_searches(state: State<'_, AppState>) -> DbResult<Vec<SavedSearch>> {
    let db = state.db()?;
    search_service::list_saved_searches(&db)
}

#[tauri::command]
pub fn create_saved_search(
    state: State<'_, AppState>,
    input: SavedSearchInput,
) -> DbResult<SavedSearch> {
    let db = state.db()?;
    search_service::create_saved_search(&db, input)
}

#[tauri::command]
pub fn update_saved_search(
    state: State<'_, AppState>,
    id: String,
    input: SavedSearchInput,
) -> DbResult<SavedSearch> {
    let db = state.db()?;
    search_service::update_saved_search(&db, id, input)
}

#[tauri::command]
pub fn delete_saved_search(state: State<'_, AppState>, id: String) -> DbResult<()> {
    let db = state.db()?;
    search_service::delete_saved_search(&db, id)
}
