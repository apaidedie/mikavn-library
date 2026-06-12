pub mod ai;
pub mod cleaning;
pub mod matching;
pub mod providers;

use std::thread;

use tauri::AppHandle;

use crate::db::models::{
    AiRecognitionResult, BatchMatchJob, BatchMatchStatus, ExternalIdRecord, ExternalIds, FieldLock,
    Game, MatchSuggestion, MetadataSearchResponse, MetadataSearchResult, MetadataSourceRecord,
    NormalizedMetadata, TaskRecord, UpdateGameInput,
};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::paths::AppPaths;
use crate::repositories::metadata_matches::InsertMatchResultInput;
use crate::services::games as game_service;
use crate::services::images;
use crate::services::tasks;

pub const SEARCH_CACHE_TTL_SECONDS: i64 = 24 * 60 * 60;
pub const DETAIL_CACHE_TTL_SECONDS: i64 = 7 * 24 * 60 * 60;

pub fn selected_providers(input: Vec<String>) -> Vec<String> {
    let defaults = ["vndb", "dlsite", "fanza"];
    let providers = if input.is_empty() {
        defaults
            .iter()
            .map(|item| item.to_string())
            .collect::<Vec<_>>()
    } else {
        input.into_iter().map(|item| item.to_lowercase()).collect()
    };

    let mut selected = Vec::new();
    for provider in providers {
        if defaults.contains(&provider.as_str()) && !selected.contains(&provider) {
            selected.push(provider);
        }
    }
    selected
}

pub fn empty_search_response(query: &str) -> MetadataSearchResponse {
    let variants = cleaning::generate_search_variants(query);
    let cleaned_query = variants
        .get(1)
        .cloned()
        .unwrap_or_else(|| query.trim().to_string());
    MetadataSearchResponse {
        query: query.to_string(),
        cleaned_query,
        variants,
        results: Vec::new(),
        errors: Vec::new(),
    }
}

pub fn search_all(query: &str, providers: Vec<String>) -> MetadataSearchResponse {
    let active_providers = selected_providers(providers);
    let mut response = empty_search_response(query);
    let variants = response.variants.clone();

    for provider in &active_providers {
        let provider_results = match provider.as_str() {
            "vndb" => providers::vndb::search(query, &variants),
            "dlsite" => providers::dlsite::search(query, &variants),
            "fanza" => providers::fanza::search(query, &variants),
            _ => continue,
        };

        match provider_results {
            Ok(mut results) => response.results.append(&mut results),
            Err(error) => response.errors.push(format!("{provider}: {error}")),
        }
    }

    providers::vndb::integrate_sniffed_ids(
        &mut response.results,
        &mut response.errors,
        &active_providers,
    );
    matching::sort_by_relevance(query, &mut response.results);
    response
}

pub fn get_detail(provider: &str, id: &str) -> DbResult<NormalizedMetadata> {
    match provider.to_lowercase().as_str() {
        "vndb" => providers::vndb::detail(id),
        "dlsite" => providers::dlsite::detail(id),
        "fanza" => providers::fanza::detail(id),
        _ => Err(DbError::metadata_provider_failed(format!(
            "unsupported metadata provider: {provider}"
        ))),
    }
}

pub fn search_metadata(
    db: &Database,
    query: String,
    providers: Vec<String>,
) -> DbResult<MetadataSearchResponse> {
    let providers = enabled_providers(db, providers)?;
    if providers.is_empty() {
        return Ok(empty_search_response(&query));
    }

    let cache_key = search_cache_key(&query, &providers);
    if let Some(cached) = db.cache_get(&cache_key)? {
        return Ok(cached);
    }
    let response = search_all(&query, providers);
    db.cache_set(
        &cache_key,
        "multi",
        &query,
        &response,
        SEARCH_CACHE_TTL_SECONDS,
    )?;
    Ok(response)
}

pub fn get_metadata_detail(
    db: &Database,
    provider: String,
    id: String,
) -> DbResult<NormalizedMetadata> {
    let cache_key = detail_cache_key(&provider, &id);
    if let Some(cached) = db.cache_get(&cache_key)? {
        return Ok(cached);
    }
    let detail = get_detail(&provider, &id)?;
    db.cache_set(
        &cache_key,
        &provider,
        &id,
        &detail,
        DETAIL_CACHE_TTL_SECONDS,
    )?;
    Ok(detail)
}

pub fn apply_metadata_to_game(
    app: &AppHandle,
    db: &Database,
    game_id: String,
    metadata: NormalizedMetadata,
    fields: Vec<String>,
    force_locked: Option<bool>,
) -> DbResult<Game> {
    let locked_fields = if force_locked.unwrap_or(false) {
        Vec::new()
    } else {
        db.locked_field_names(&game_id)?
    };
    let input = build_metadata_update_input(app, &metadata, &fields, &locked_fields);
    let game = game_service::update_game(db, game_id.clone(), input)?;
    if is_selected_unlocked("externalIds", &fields, &locked_fields) {
        sync_metadata_external_ids(db, &game_id, &metadata)?;
    }
    Ok(game)
}

pub fn list_metadata_sources(db: &Database) -> DbResult<Vec<MetadataSourceRecord>> {
    db.list_metadata_sources()
}

pub fn list_external_ids(db: &Database, game_id: String) -> DbResult<Vec<ExternalIdRecord>> {
    db.list_external_ids(game_id)
}

pub fn list_field_locks(db: &Database, game_id: String) -> DbResult<Vec<FieldLock>> {
    db.list_field_locks(game_id)
}

pub fn set_field_lock(
    db: &Database,
    game_id: String,
    field_name: String,
    locked_by_user: bool,
) -> DbResult<FieldLock> {
    db.set_field_lock(game_id, field_name, locked_by_user)
}

pub fn set_field_locks(
    db: &Database,
    game_id: String,
    field_names: Vec<String>,
    locked_by_user: bool,
) -> DbResult<Vec<FieldLock>> {
    db.set_field_locks(game_id, field_names, locked_by_user)
}

pub fn get_batch_match_status(db: &Database, job_id: String) -> DbResult<BatchMatchStatus> {
    db.match_status(job_id)
}

pub fn cancel_batch_match(app: &AppHandle, db: &Database, job_id: String) -> DbResult<()> {
    let job = db.get_match_job(&job_id)?;
    db.set_match_job_status(&job_id, "cancelled")?;
    if let Some(task_id) = job.task_id {
        let progress = (job.completed as f64 / job.total.max(1) as f64).clamp(0.0, 1.0);
        let _ = tasks::update_task(
            app,
            db,
            &task_id,
            "cancelled",
            progress,
            Some("批量匹配已取消".to_string()),
            None,
        );
    }
    Ok(())
}

pub fn recognize_game_from_image(
    db: &Database,
    image_path: String,
) -> DbResult<AiRecognitionResult> {
    let config = ai::config_from_sources(db)?;
    ai::recognize_from_image(config, image_path)
}

pub fn test_ai_connection(db: &Database) -> DbResult<ai::AiConnectionTestResult> {
    let config = ai::config_from_sources(db)?;
    ai::test_connection(config)
}

pub fn enabled_providers(db: &Database, requested: Vec<String>) -> DbResult<Vec<String>> {
    let candidates = if requested.is_empty() {
        vec![
            "vndb".to_string(),
            "dlsite".to_string(),
            "fanza".to_string(),
        ]
    } else {
        selected_providers(requested)
    };

    let mut enabled = Vec::new();
    for provider in candidates {
        let key = format!("provider_{provider}_enabled");
        if db.get_setting(&key)?.as_deref() != Some("false") {
            enabled.push(provider);
        }
    }
    Ok(enabled)
}

pub fn match_game_with_providers(game: &Game, providers: Vec<String>) -> MatchSuggestion {
    let cleaned_title = cleaning::clean_title(&game.title);
    let mut response = if providers.is_empty() {
        empty_search_response(&cleaned_title)
    } else {
        search_all(&cleaned_title, providers)
    };
    let selected = matching::select_best(&response.results);
    let status = if selected.is_some() {
        "success"
    } else if response.results.is_empty() {
        "no_result"
    } else {
        "review"
    };
    let reason = if response.results.is_empty() {
        Some("未找到候选结果".to_string())
    } else if selected.is_none() {
        Some("候选分数低于自动匹配阈值".to_string())
    } else {
        None
    };
    response.results.truncate(10);
    MatchSuggestion {
        game_id: game.id.clone(),
        original_title: game.title.clone(),
        cleaned_title,
        selected,
        candidates: response.results,
        status: status.to_string(),
        reason,
    }
}

pub fn enqueue_batch_match_metadata(
    app: AppHandle,
    db: &Database,
    game_ids: Vec<String>,
) -> DbResult<(BatchMatchJob, TaskRecord)> {
    let payload = serde_json::json!({ "gameIds": game_ids }).to_string();
    let (job, task) = {
        let task = tasks::create_task_with_payload(
            &app,
            db,
            "metadata.batch_match",
            Some(format!("正在批量匹配 {} 个条目", game_ids.len())),
            Some(payload),
            true,
        )?;
        let job = db.create_match_job(&game_ids, Some(task.id.clone()))?;
        (job, task)
    };
    let job_id = job.id.clone();
    let task_id = task.id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let Ok(paths) = AppPaths::from_app(&app_handle) else {
            return;
        };
        let Ok(db) = Database::new_from_path(paths.database()) else {
            return;
        };
        let total = game_ids.len().max(1) as f64;
        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.0,
            Some("正在检索候选元数据".to_string()),
            None,
        );
        for game_id in game_ids {
            let Ok(current_job) = db.get_match_job(&job_id) else {
                break;
            };
            if current_job.status == "cancelled" {
                let progress = (current_job.completed as f64 / total).clamp(0.0, 1.0);
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "cancelled",
                    progress,
                    Some("批量匹配已取消".to_string()),
                    None,
                );
                break;
            }
            process_match_game(&db, &job_id, &game_id);
            if let Ok(current_job) = db.get_match_job(&job_id) {
                let progress = (current_job.completed as f64 / total).clamp(0.0, 1.0);
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    progress,
                    Some(format!(
                        "已完成 {}/{}",
                        current_job.completed, current_job.total
                    )),
                    None,
                );
            }
        }
        if let Ok(current_job) = db.get_match_job(&job_id) {
            if current_job.status != "cancelled" {
                let _ = db.set_match_job_status(&job_id, "completed");
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some("批量匹配完成".to_string()),
                    None,
                );
            }
        }
    });
    Ok((job, task))
}

fn build_metadata_update_input(
    app: &AppHandle,
    metadata: &NormalizedMetadata,
    fields: &[String],
    locked_fields: &[String],
) -> UpdateGameInput {
    let mut input = UpdateGameInput::default();

    if is_selected_unlocked("title", fields, locked_fields) {
        input.title = Some(metadata.title.clone());
    }
    if is_selected_unlocked("originalTitle", fields, locked_fields) {
        input.original_title = metadata
            .original_title
            .clone()
            .or_else(|| Some(metadata.title.clone()));
    }
    if is_selected_unlocked("description", fields, locked_fields) {
        input.description = metadata.description.clone();
    }
    if is_selected_unlocked("releaseDate", fields, locked_fields) {
        input.release_date = metadata.release_date.clone();
    }
    if is_selected_unlocked("developer", fields, locked_fields) {
        input.developer = metadata.developers.first().cloned();
    }
    if is_selected_unlocked("publisher", fields, locked_fields) {
        input.publisher = metadata.publishers.first().cloned();
    }
    if is_selected_unlocked("tags", fields, locked_fields) {
        input.tags = Some(metadata.tags.clone());
    }
    if is_selected_unlocked("genres", fields, locked_fields) {
        input.genres = Some(metadata.genres.clone());
    }
    if is_selected_unlocked("coverImage", fields, locked_fields) {
        input.cover_image = metadata.images.first().map(|image_url| {
            if images::is_remote_url(image_url) {
                AppPaths::from_app(app)
                    .ok()
                    .and_then(|paths| {
                        images::cache_cover_image(
                            paths.root(),
                            &metadata.provider,
                            &metadata.id,
                            image_url,
                        )
                        .ok()
                    })
                    .unwrap_or_else(|| image_url.clone())
            } else {
                image_url.clone()
            }
        });
    }
    if is_selected_unlocked("externalIds", fields, locked_fields) {
        input.vndb_id = metadata.external_ids.vndb.clone();
        input.bangumi_id = metadata.external_ids.bangumi.clone();
        input.dlsite_id = metadata.external_ids.dlsite.clone();
        input.fanza_id = metadata.external_ids.fanza.clone();
        input.ymgal_id = metadata.external_ids.ymgal.clone();
    }
    if is_selected_unlocked("ageRating", fields, locked_fields) {
        input.age_rating = metadata.age_rating.clone();
    }

    input
}

fn sync_metadata_external_ids(
    db: &Database,
    game_id: &str,
    metadata: &NormalizedMetadata,
) -> DbResult<()> {
    if let Some(value) = metadata.external_ids.vndb.as_deref() {
        db.upsert_external_id(game_id, "vndb", value, Some("metadata_apply"), Some(1.0))?;
    }
    if let Some(value) = metadata.external_ids.bangumi.as_deref() {
        db.upsert_external_id(game_id, "bangumi", value, Some("metadata_apply"), Some(1.0))?;
    }
    if let Some(value) = metadata.external_ids.dlsite.as_deref() {
        db.upsert_external_id(game_id, "dlsite", value, Some("metadata_apply"), Some(1.0))?;
    }
    if let Some(value) = metadata.external_ids.fanza.as_deref() {
        db.upsert_external_id(game_id, "fanza", value, Some("metadata_apply"), Some(1.0))?;
    }
    if let Some(value) = metadata.external_ids.ymgal.as_deref() {
        db.upsert_external_id(game_id, "ymgal", value, Some("metadata_apply"), Some(1.0))?;
    }
    Ok(())
}

fn is_selected_unlocked(name: &str, fields: &[String], locked_fields: &[String]) -> bool {
    fields.iter().any(|field| field == name) && !locked_fields.iter().any(|field| field == name)
}

fn search_cache_key(query: &str, providers: &[String]) -> String {
    format!(
        "search:{}:{}",
        providers.join(","),
        query.trim().to_lowercase()
    )
}

fn detail_cache_key(provider: &str, id: &str) -> String {
    format!("detail:{}:{}", provider.to_lowercase(), id.to_lowercase())
}

fn process_match_game(db: &Database, job_id: &str, game_id: &str) {
    let game = match db.get_game(game_id.to_string()) {
        Ok(game) => game,
        Err(error) => {
            let _ = db.insert_match_result(InsertMatchResultInput {
                job_id,
                game_id,
                original_title: "",
                cleaned_title: "",
                selected: None,
                status: "error",
                reason: Some(error.to_string()),
                candidates: Vec::new(),
            });
            return;
        }
    };
    let providers = enabled_providers(db, Vec::new()).unwrap_or_else(|_| {
        vec![
            "vndb".to_string(),
            "dlsite".to_string(),
            "fanza".to_string(),
        ]
    });
    let suggestion = match_game_with_providers(&game, providers);
    let _ = db.insert_match_result(InsertMatchResultInput {
        job_id,
        game_id: &game.id,
        original_title: &suggestion.original_title,
        cleaned_title: &suggestion.cleaned_title,
        selected: suggestion.selected.as_ref(),
        status: &suggestion.status,
        reason: suggestion.reason.clone(),
        candidates: suggestion.candidates,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_update_respects_selected_locked_fields() {
        let metadata = NormalizedMetadata {
            title: "New title".to_string(),
            original_title: Some("Original".to_string()),
            description: Some("Description".to_string()),
            tags: vec!["tag".to_string()],
            ..NormalizedMetadata::default()
        };
        let fields = vec![
            "title".to_string(),
            "description".to_string(),
            "tags".to_string(),
        ];
        let locked = vec!["description".to_string()];
        let input = build_metadata_update_input_for_test(&metadata, &fields, &locked);

        assert_eq!(input.title.as_deref(), Some("New title"));
        assert_eq!(input.description, None);
        assert_eq!(input.tags, Some(vec!["tag".to_string()]));
    }

    #[test]
    fn cache_keys_normalize_query_provider_and_id() {
        assert_eq!(
            search_cache_key(
                "  Summer Pockets  ",
                &["vndb".to_string(), "dlsite".to_string()]
            ),
            "search:vndb,dlsite:summer pockets"
        );
        assert_eq!(detail_cache_key("VNDB", "V123"), "detail:vndb:v123");
    }

    #[cfg(test)]
    fn build_metadata_update_input_for_test(
        metadata: &NormalizedMetadata,
        fields: &[String],
        locked_fields: &[String],
    ) -> UpdateGameInput {
        let mut input = UpdateGameInput::default();
        if is_selected_unlocked("title", fields, locked_fields) {
            input.title = Some(metadata.title.clone());
        }
        if is_selected_unlocked("description", fields, locked_fields) {
            input.description = metadata.description.clone();
        }
        if is_selected_unlocked("tags", fields, locked_fields) {
            input.tags = Some(metadata.tags.clone());
        }
        input
    }
}

pub fn metadata_from_result(result: &MetadataSearchResult) -> NormalizedMetadata {
    NormalizedMetadata {
        provider: result.provider.clone(),
        id: result.id.clone(),
        title: result.title.clone(),
        original_title: None,
        aliases: Vec::new(),
        description: result.description.clone(),
        release_date: result.release_date.clone(),
        developers: result.developers.clone(),
        publishers: Vec::new(),
        tags: result.tags.clone(),
        genres: vec!["Visual Novel".to_string()],
        images: result.image_url.clone().into_iter().collect(),
        external_ids: result.external_ids.clone(),
        age_rating: None,
    }
}

pub fn make_result(provider: &str, id: String, title: String, url: String) -> MetadataSearchResult {
    let mut external_ids = ExternalIds::default();
    match provider {
        "vndb" => external_ids.vndb = Some(id.clone()),
        "bangumi" => external_ids.bangumi = Some(id.clone()),
        "dlsite" => external_ids.dlsite = Some(id.clone()),
        "fanza" => external_ids.fanza = Some(id.clone()),
        "ymgal" => external_ids.ymgal = Some(id.clone()),
        _ => {}
    }
    MetadataSearchResult {
        provider: provider.to_string(),
        id,
        title,
        url,
        image_url: None,
        description: None,
        release_date: None,
        developers: Vec::new(),
        tags: Vec::new(),
        external_ids,
        relevance_score: 0.0,
        from_vndb_sniff: false,
    }
}
