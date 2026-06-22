use tauri::{AppHandle, State};

use crate::db::models::{
    AiRecognitionResult, BatchMatchJob, BatchMatchStatus, DuplicateGameMergeOptions,
    DuplicateGameMergePreview, DuplicateGameMergeResult, ExternalIdRecord, FieldLock, Game,
    MatchSuggestion, MetadataSearchResponse, MetadataSourceRecord, NormalizedMetadata, TaskRecord,
};
use crate::db::DbResult;
use crate::services::metadata;
use crate::services::metadata::ai::AiConnectionTestResult;
use crate::services::metadata_artwork_repair::{
    self, ArtworkRepairDiagnosis, ArtworkRepairOptions, ArtworkRepairPreview,
};
use crate::services::metadata_description_images::{
    self, DescriptionImageRepairOptions, DescriptionImageRepairPreview,
};
use crate::services::metadata_duplicate_ids::{
    self, DuplicateExternalIdAuditOptions, DuplicateExternalIdPreview,
};
use crate::services::metadata_duplicate_merge;
use crate::AppState;

#[tauri::command]
pub fn search_metadata(
    state: State<'_, AppState>,
    query: String,
    providers: Vec<String>,
) -> DbResult<MetadataSearchResponse> {
    let db = state.db()?;
    metadata::search_metadata(&db, query, providers)
}

#[tauri::command]
pub fn get_metadata_detail(
    state: State<'_, AppState>,
    provider: String,
    id: String,
) -> DbResult<NormalizedMetadata> {
    let db = state.db()?;
    metadata::get_metadata_detail(&db, provider, id)
}

#[tauri::command]
pub fn match_metadata_for_game(
    state: State<'_, AppState>,
    game_id: String,
) -> DbResult<MatchSuggestion> {
    let (game, providers) = {
        let db = state.db()?;
        (
            db.get_game(game_id.clone())?,
            metadata::enabled_providers(&db, Vec::new())?,
        )
    };
    Ok(metadata::match_game_with_providers(&game, providers))
}

#[tauri::command]
pub fn apply_metadata_to_game(
    app: AppHandle,
    state: State<'_, AppState>,
    game_id: String,
    metadata: NormalizedMetadata,
    fields: Vec<String>,
    force_locked: Option<bool>,
) -> DbResult<Game> {
    let db = state.db()?;
    metadata::apply_metadata_to_game(&app, &db, game_id, metadata, fields, force_locked)
}

#[tauri::command]
pub fn list_metadata_sources(state: State<'_, AppState>) -> DbResult<Vec<MetadataSourceRecord>> {
    let db = state.db()?;
    metadata::list_metadata_sources(&db)
}

#[tauri::command]
pub fn list_external_ids(
    state: State<'_, AppState>,
    game_id: String,
) -> DbResult<Vec<ExternalIdRecord>> {
    let db = state.db()?;
    metadata::list_external_ids(&db, game_id)
}

#[tauri::command]
pub fn list_field_locks(state: State<'_, AppState>, game_id: String) -> DbResult<Vec<FieldLock>> {
    let db = state.db()?;
    metadata::list_field_locks(&db, game_id)
}

#[tauri::command]
pub fn set_field_lock(
    state: State<'_, AppState>,
    game_id: String,
    field_name: String,
    locked_by_user: bool,
) -> DbResult<FieldLock> {
    let db = state.db()?;
    metadata::set_field_lock(&db, game_id, field_name, locked_by_user)
}

#[tauri::command]
pub fn set_field_locks(
    state: State<'_, AppState>,
    game_id: String,
    field_names: Vec<String>,
    locked_by_user: bool,
) -> DbResult<Vec<FieldLock>> {
    let db = state.db()?;
    metadata::set_field_locks(&db, game_id, field_names, locked_by_user)
}

#[tauri::command]
pub fn batch_match_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
    game_ids: Vec<String>,
) -> DbResult<BatchMatchJob> {
    let db = state.db()?;
    let (job, _) = metadata::enqueue_batch_match_metadata(app, &db, game_ids)?;
    Ok(job)
}

#[tauri::command]
pub fn batch_match_missing_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
) -> DbResult<Option<BatchMatchJob>> {
    let db = state.db()?;
    let Some((job, _)) = metadata::enqueue_missing_metadata_batch_match(app, &db)? else {
        return Ok(None);
    };
    Ok(Some(job))
}

#[tauri::command]
pub fn preview_description_image_repair(
    state: State<'_, AppState>,
    options: DescriptionImageRepairOptions,
) -> DbResult<DescriptionImageRepairPreview> {
    let db = state.db()?;
    metadata_description_images::preview_description_image_repair(&db, options)
}

#[tauri::command]
pub fn repair_description_images(
    app: AppHandle,
    state: State<'_, AppState>,
    options: DescriptionImageRepairOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    metadata_description_images::enqueue_description_image_repair_task(app, &db, options)
}

#[tauri::command]
pub fn preview_artwork_repair(
    state: State<'_, AppState>,
    options: ArtworkRepairOptions,
) -> DbResult<ArtworkRepairPreview> {
    let db = state.db()?;
    metadata_artwork_repair::preview_artwork_repair(&db, options)
}

#[tauri::command]
pub fn diagnose_artwork_repair(
    state: State<'_, AppState>,
    options: ArtworkRepairOptions,
) -> DbResult<ArtworkRepairDiagnosis> {
    let db = state.db()?;
    metadata_artwork_repair::diagnose_artwork_repair(&db, options)
}

#[tauri::command]
pub fn repair_artwork(
    app: AppHandle,
    state: State<'_, AppState>,
    options: ArtworkRepairOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    metadata_artwork_repair::enqueue_artwork_repair_task(app, &db, options)
}

#[tauri::command]
pub fn preview_duplicate_external_ids(
    state: State<'_, AppState>,
    options: DuplicateExternalIdAuditOptions,
) -> DbResult<DuplicateExternalIdPreview> {
    let db = state.db()?;
    metadata_duplicate_ids::preview_duplicate_external_ids(&db, options)
}

#[tauri::command]
pub fn audit_duplicate_external_ids(
    app: AppHandle,
    state: State<'_, AppState>,
    options: DuplicateExternalIdAuditOptions,
) -> DbResult<TaskRecord> {
    let db = state.db()?;
    metadata_duplicate_ids::enqueue_duplicate_external_id_audit_task(app, &db, options)
}

#[tauri::command]
pub fn preview_duplicate_game_merge(
    state: State<'_, AppState>,
    options: DuplicateGameMergeOptions,
) -> DbResult<DuplicateGameMergePreview> {
    let db = state.db()?;
    metadata_duplicate_merge::preview_duplicate_game_merge(&db, options)
}

#[tauri::command]
pub fn merge_duplicate_games(
    state: State<'_, AppState>,
    options: DuplicateGameMergeOptions,
) -> DbResult<DuplicateGameMergeResult> {
    let db = state.db()?;
    metadata_duplicate_merge::merge_duplicate_games(&db, options)
}

#[tauri::command]
pub fn get_batch_match_status(
    state: State<'_, AppState>,
    job_id: String,
) -> DbResult<BatchMatchStatus> {
    let db = state.db()?;
    metadata::get_batch_match_status(&db, job_id)
}

#[tauri::command]
pub fn cancel_batch_match(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> DbResult<()> {
    let db = state.db()?;
    metadata::cancel_batch_match(&app, &db, job_id)
}

#[tauri::command]
pub fn recognize_game_from_image(
    state: State<'_, AppState>,
    image_path: String,
) -> DbResult<AiRecognitionResult> {
    let db = state.db()?;
    metadata::recognize_game_from_image(&db, image_path)
}

#[tauri::command]
pub fn test_ai_connection(state: State<'_, AppState>) -> DbResult<AiConnectionTestResult> {
    let db = state.db()?;
    metadata::test_ai_connection(&db)
}
