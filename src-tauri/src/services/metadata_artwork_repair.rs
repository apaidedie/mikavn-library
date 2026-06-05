use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::thread;

use tauri::AppHandle;

use crate::db::models::{ExternalIdRecord, Game, GameFilter, TaskRecord, UpdateGameInput};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::games as game_service;
use crate::services::images;
use crate::services::metadata;
use crate::services::metadata::cleaning::{is_dlsite_id, is_fanza_id};
use crate::services::tasks;

const DEFAULT_LIMIT: usize = 20;
const MAX_LIMIT: usize = 200;
const DEFAULT_PROVIDERS: [&str; 3] = ["vndb", "dlsite", "fanza"];
const DEFAULT_FIELDS: [&str; 2] = ["cover", "background"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkRepairOptions {
    pub providers: Option<Vec<String>>,
    pub fields: Option<Vec<String>>,
    pub limit: Option<usize>,
    pub retry_attempted: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkRepairPreview {
    pub candidates: Vec<ArtworkRepairCandidate>,
    pub total_candidates: usize,
    pub total_missing_fields: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkRepairCandidate {
    pub game_id: String,
    pub title: String,
    pub missing_fields: Vec<String>,
    pub providers: Vec<ArtworkProviderRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkProviderRef {
    pub provider: String,
    pub provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArtworkRepairPayload {
    providers: Vec<String>,
    fields: Vec<String>,
    limit: usize,
    retry_attempted: bool,
}

struct ArtworkRunOptions {
    providers: Vec<String>,
    fields: Vec<String>,
    limit: usize,
    retry_attempted: bool,
}

enum ArtworkOutcome {
    Updated {
        field_count: usize,
        fields: Vec<String>,
        provider: String,
        provider_id: String,
    },
    Skipped(String),
}

pub fn preview_artwork_repair(
    db: &Database,
    options: ArtworkRepairOptions,
) -> DbResult<ArtworkRepairPreview> {
    let run_options = normalize_options(options)?;
    let all_candidates = artwork_candidates(db, &run_options)?;
    let total_candidates = all_candidates.len();
    let total_missing_fields = all_candidates
        .iter()
        .map(|candidate| candidate.missing_fields.len())
        .sum();
    Ok(ArtworkRepairPreview {
        candidates: all_candidates.into_iter().take(run_options.limit).collect(),
        total_candidates,
        total_missing_fields,
    })
}

pub fn enqueue_artwork_repair_task(
    app: AppHandle,
    db: &Database,
    options: ArtworkRepairOptions,
) -> DbResult<TaskRecord> {
    let run_options = normalize_options(options)?;
    let preview = preview_artwork_repair(
        db,
        ArtworkRepairOptions {
            providers: Some(run_options.providers.clone()),
            fields: Some(run_options.fields.clone()),
            limit: Some(run_options.limit),
            retry_attempted: Some(run_options.retry_attempted),
        },
    )?;
    if preview.total_candidates == 0 {
        return Err(DbError::validation("no artwork repair candidates"));
    }

    let payload = serde_json::to_string(&ArtworkRepairPayload {
        providers: run_options.providers.clone(),
        fields: run_options.fields.clone(),
        limit: run_options.limit,
        retry_attempted: run_options.retry_attempted,
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "metadata.artwork_repair",
        Some(format!(
            "正在补全 {} 个条目的媒体图片",
            preview.candidates.len()
        )),
        Some(payload),
        true,
    )?;
    let task_id = task.id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let Ok(paths) = AppPaths::from_app(&app_handle) else {
            return;
        };
        let Ok(db) = Database::new_from_path(paths.database()) else {
            return;
        };
        if let Err(error) = run_artwork_repair(&app_handle, &db, &paths, &task_id, run_options) {
            logger::log_error(&paths, "metadata.artwork_repair", error.to_string());
            let _ = tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "failed",
                1.0,
                Some("媒体图片补全失败".to_string()),
                Some(error.to_string()),
            );
        }
    });

    Ok(task)
}

pub fn retry_artwork_repair_task(
    app: AppHandle,
    db: &Database,
    payload: &str,
) -> DbResult<TaskRecord> {
    let payload: ArtworkRepairPayload = serde_json::from_str(payload)?;
    enqueue_artwork_repair_task(
        app,
        db,
        ArtworkRepairOptions {
            providers: Some(payload.providers),
            fields: Some(payload.fields),
            limit: Some(payload.limit),
            retry_attempted: Some(payload.retry_attempted),
        },
    )
}

fn run_artwork_repair(
    app: &AppHandle,
    db: &Database,
    paths: &AppPaths,
    task_id: &str,
    options: ArtworkRunOptions,
) -> DbResult<()> {
    let candidates = artwork_candidates(db, &options)?
        .into_iter()
        .take(options.limit)
        .collect::<Vec<_>>();
    if candidates.is_empty() {
        tasks::update_task(
            app,
            db,
            task_id,
            "completed",
            1.0,
            Some("没有需要补全媒体图片的条目".to_string()),
            None,
        )?;
        return Ok(());
    }

    tasks::update_task(
        app,
        db,
        task_id,
        "running",
        0.0,
        Some(format!("准备处理 {} 个候选条目", candidates.len())),
        None,
    )?;

    let total = candidates.len().max(1) as f64;
    let mut updated = 0usize;
    let mut filled_fields = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;

    for (index, candidate) in candidates.iter().enumerate() {
        let progress = (index as f64 / total).clamp(0.0, 0.98);
        tasks::update_task(
            app,
            db,
            task_id,
            "running",
            progress,
            Some(format!(
                "正在处理 {}/{}：{}",
                index + 1,
                candidates.len(),
                candidate.title
            )),
            None,
        )?;

        match repair_candidate(paths, db, candidate, &options) {
            Ok(ArtworkOutcome::Updated {
                field_count,
                fields,
                provider,
                provider_id,
            }) => {
                updated += 1;
                filled_fields += field_count;
                let _ = db.append_task_log(
                    task_id,
                    "info",
                    &format!(
                        "已补全：{} [{}]，字段 {}，来源 {} {}。",
                        candidate.title,
                        candidate.game_id,
                        fields.join("/"),
                        provider,
                        provider_id
                    ),
                );
            }
            Ok(ArtworkOutcome::Skipped(reason)) => {
                skipped += 1;
                let _ = db.append_task_log(
                    task_id,
                    "warn",
                    &format!(
                        "跳过：{} [{}]，{}。",
                        candidate.title, candidate.game_id, reason
                    ),
                );
            }
            Err(error) => {
                failed += 1;
                let _ = db.append_task_log(
                    task_id,
                    "error",
                    &format!(
                        "失败：{} [{}]，{}。",
                        candidate.title, candidate.game_id, error
                    ),
                );
            }
        }
    }

    let message = format!(
        "媒体图片补全完成：更新 {} 个条目，填充 {} 个字段，跳过 {} 个，失败 {} 个。",
        updated, filled_fields, skipped, failed
    );
    logger::log_info(paths, "metadata.artwork_repair", &message);
    tasks::update_task(app, db, task_id, "completed", 1.0, Some(message), None)?;
    Ok(())
}

fn repair_candidate(
    paths: &AppPaths,
    db: &Database,
    candidate: &ArtworkRepairCandidate,
    options: &ArtworkRunOptions,
) -> DbResult<ArtworkOutcome> {
    let game = db.get_game(candidate.game_id.clone())?;
    let missing_fields = missing_artwork_fields(&game, &options.fields);
    if missing_fields.is_empty() {
        return Ok(ArtworkOutcome::Skipped(
            "条目已经有目标媒体图片".to_string(),
        ));
    }
    let providers = provider_refs_for_game(db, &game, &options.providers)?;
    if providers.is_empty() {
        return Ok(ArtworkOutcome::Skipped(
            "没有可用的 VNDB/DLsite/FANZA 外部 ID".to_string(),
        ));
    }

    let mut provider_errors = Vec::new();
    for provider in providers {
        match cached_artwork_from_provider(paths, db, &provider) {
            Ok(Some(path)) => {
                let mut input = UpdateGameInput::default();
                let mut fields = Vec::new();
                if missing_fields.iter().any(|field| field == "cover") {
                    input.cover_image = Some(path.clone());
                    fields.push("封面".to_string());
                }
                if missing_fields.iter().any(|field| field == "background") {
                    input.background_image = Some(path.clone());
                    fields.push("背景".to_string());
                }
                if fields.is_empty() {
                    return Ok(ArtworkOutcome::Skipped(
                        "没有需要写入的目标字段".to_string(),
                    ));
                }
                game_service::update_game(db, game.id.clone(), input)?;
                return Ok(ArtworkOutcome::Updated {
                    field_count: fields.len(),
                    fields,
                    provider: provider.provider,
                    provider_id: provider.provider_id,
                });
            }
            Ok(None) => provider_errors.push(format!(
                "{} {} 没有可用主图",
                provider.provider, provider.provider_id
            )),
            Err(error) => provider_errors.push(format!(
                "{} {}: {}",
                provider.provider, provider.provider_id, error
            )),
        }
    }

    if provider_errors.is_empty() {
        Ok(ArtworkOutcome::Skipped("来源没有可用主图".to_string()))
    } else {
        Err(DbError::metadata_provider_failed(
            provider_errors.join(" | "),
        ))
    }
}

fn cached_artwork_from_provider(
    paths: &AppPaths,
    db: &Database,
    provider: &ArtworkProviderRef,
) -> DbResult<Option<String>> {
    let detail =
        metadata::get_metadata_detail(db, provider.provider.clone(), provider.provider_id.clone())?;
    let Some(image_url) = detail
        .images
        .first()
        .filter(|value| !value.trim().is_empty())
    else {
        return Ok(None);
    };
    let cached = images::cache_remote_image(
        paths.root(),
        &provider.provider,
        &provider.provider_id,
        image_url,
        "artwork",
    )?;
    Ok(Some(cached))
}

fn artwork_candidates(
    db: &Database,
    options: &ArtworkRunOptions,
) -> DbResult<Vec<ArtworkRepairCandidate>> {
    let games = db.list_games(GameFilter {
        sort_by: Some("updated_at".to_string()),
        sort_direction: Some("desc".to_string()),
        ..GameFilter::default()
    })?;
    let mut candidates = Vec::new();
    for game in games {
        let missing_fields = missing_artwork_fields(&game, &options.fields);
        if missing_fields.is_empty() {
            continue;
        }
        let providers = provider_refs_for_game(db, &game, &options.providers)?;
        if providers.is_empty() {
            continue;
        }
        candidates.push(ArtworkRepairCandidate {
            game_id: game.id,
            title: game.title,
            missing_fields,
            providers,
        });
    }
    Ok(candidates)
}

fn missing_artwork_fields(game: &Game, fields: &[String]) -> Vec<String> {
    let mut missing = Vec::new();
    if fields.iter().any(|field| field == "cover") && is_empty(game.cover_image.as_deref()) {
        missing.push("cover".to_string());
    }
    if fields.iter().any(|field| field == "background")
        && is_empty(game.background_image.as_deref())
    {
        missing.push("background".to_string());
    }
    missing
}

fn provider_refs_for_game(
    db: &Database,
    game: &Game,
    provider_order: &[String],
) -> DbResult<Vec<ArtworkProviderRef>> {
    let external_ids = db.list_external_ids(game.id.clone())?;
    let mut refs = Vec::new();
    let mut seen = HashSet::new();
    for provider in provider_order {
        match provider.as_str() {
            "vndb" => push_provider_ref(
                &mut refs,
                &mut seen,
                "vndb",
                game.vndb_id.as_deref(),
                is_vndb_id,
            ),
            "dlsite" => push_provider_ref(
                &mut refs,
                &mut seen,
                "dlsite",
                game.dlsite_id.as_deref(),
                is_dlsite_id,
            ),
            "fanza" => push_provider_ref(
                &mut refs,
                &mut seen,
                "fanza",
                game.fanza_id.as_deref(),
                is_fanza_id,
            ),
            _ => {}
        }
        for record in external_ids
            .iter()
            .filter(|record| record.provider.trim().eq_ignore_ascii_case(provider))
        {
            push_external_provider_ref(&mut refs, &mut seen, record);
        }
    }
    Ok(refs)
}

fn push_provider_ref(
    refs: &mut Vec<ArtworkProviderRef>,
    seen: &mut HashSet<(String, String)>,
    provider: &str,
    provider_id: Option<&str>,
    is_valid: impl Fn(&str) -> bool,
) {
    let Some(provider_id) = provider_id.map(str::trim).filter(|id| is_valid(id)) else {
        return;
    };
    push_normalized_provider_ref(refs, seen, provider, provider_id);
}

fn push_external_provider_ref(
    refs: &mut Vec<ArtworkProviderRef>,
    seen: &mut HashSet<(String, String)>,
    record: &ExternalIdRecord,
) {
    let provider = record.provider.trim().to_lowercase();
    let id = record.external_id.trim();
    let valid = match provider.as_str() {
        "vndb" => is_vndb_id(id),
        "dlsite" => is_dlsite_id(id),
        "fanza" => is_fanza_id(id),
        _ => false,
    };
    if valid {
        push_normalized_provider_ref(refs, seen, &provider, id);
    }
}

fn push_normalized_provider_ref(
    refs: &mut Vec<ArtworkProviderRef>,
    seen: &mut HashSet<(String, String)>,
    provider: &str,
    provider_id: &str,
) {
    let provider = provider.trim().to_lowercase();
    let provider_id = normalize_provider_id(&provider, provider_id);
    if seen.insert((provider.clone(), provider_id.clone())) {
        refs.push(ArtworkProviderRef {
            provider,
            provider_id,
        });
    }
}

fn normalize_provider_id(provider: &str, provider_id: &str) -> String {
    match provider {
        "dlsite" => provider_id.trim().to_uppercase(),
        "fanza" | "vndb" => provider_id.trim().to_lowercase(),
        _ => provider_id.trim().to_string(),
    }
}

fn is_vndb_id(value: &str) -> bool {
    let value = value.trim();
    value.len() >= 2
        && value.starts_with(['v', 'V'])
        && value[1..].chars().all(|ch| ch.is_ascii_digit())
}

fn is_empty(value: Option<&str>) -> bool {
    value.map(|item| item.trim().is_empty()).unwrap_or(true)
}

fn normalize_options(options: ArtworkRepairOptions) -> DbResult<ArtworkRunOptions> {
    let providers = normalize_providers(options.providers)?;
    let fields = normalize_fields(options.fields)?;
    let limit = options.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    Ok(ArtworkRunOptions {
        providers,
        fields,
        limit,
        retry_attempted: options.retry_attempted.unwrap_or(false),
    })
}

fn normalize_providers(input: Option<Vec<String>>) -> DbResult<Vec<String>> {
    let raw = input.unwrap_or_default();
    let values = if raw.is_empty()
        || raw
            .iter()
            .any(|item| item.trim().eq_ignore_ascii_case("all"))
    {
        DEFAULT_PROVIDERS
            .iter()
            .map(|provider| provider.to_string())
            .collect::<Vec<_>>()
    } else {
        raw.into_iter()
            .map(|provider| provider.trim().to_lowercase())
            .filter(|provider| !provider.is_empty())
            .collect::<Vec<_>>()
    };
    let mut providers = Vec::new();
    for provider in values {
        if !DEFAULT_PROVIDERS.contains(&provider.as_str()) {
            return Err(DbError::validation(
                "providers must be all, vndb, dlsite, or fanza",
            ));
        }
        if !providers.contains(&provider) {
            providers.push(provider);
        }
    }
    if providers.is_empty() {
        return Err(DbError::validation("at least one provider is required"));
    }
    Ok(providers)
}

fn normalize_fields(input: Option<Vec<String>>) -> DbResult<Vec<String>> {
    let raw = input.unwrap_or_default();
    let values = if raw.is_empty()
        || raw
            .iter()
            .any(|item| item.trim().eq_ignore_ascii_case("all"))
    {
        DEFAULT_FIELDS
            .iter()
            .map(|field| field.to_string())
            .collect::<Vec<_>>()
    } else {
        raw.into_iter()
            .map(|field| field.trim().to_lowercase())
            .filter(|field| !field.is_empty())
            .collect::<Vec<_>>()
    };
    let mut fields = Vec::new();
    for field in values {
        if !DEFAULT_FIELDS.contains(&field.as_str()) {
            return Err(DbError::validation(
                "fields must be all, cover, or background",
            ));
        }
        if !fields.contains(&field) {
            fields.push(field);
        }
    }
    if fields.is_empty() {
        return Err(DbError::validation(
            "at least one artwork field is required",
        ));
    }
    Ok(fields)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn game_with_artwork(cover: Option<&str>, background: Option<&str>) -> Game {
        Game {
            id: "game".to_string(),
            title: "Game".to_string(),
            original_title: None,
            aliases: Vec::new(),
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: None,
            notes: None,
            tags: Vec::new(),
            genres: Vec::new(),
            rating: None,
            age_rating: None,
            play_status: "planned".to_string(),
            favorite: false,
            hidden: false,
            install_path: "D:\\Games\\Game".to_string(),
            executable_path: None,
            working_directory: None,
            launch_args: None,
            path_status: "unknown".to_string(),
            last_path_checked_at: None,
            cover_image: cover.map(ToString::to_string),
            banner_image: None,
            background_image: background.map(ToString::to_string),
            vndb_id: Some("v123".to_string()),
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
            total_play_seconds: 0,
            last_played_at: None,
            created_at: "now".to_string(),
            updated_at: "now".to_string(),
        }
    }

    #[test]
    fn missing_artwork_fields_only_reports_empty_targets() {
        let fields = vec!["cover".to_string(), "background".to_string()];
        assert_eq!(
            missing_artwork_fields(&game_with_artwork(None, Some("bg.png")), &fields),
            vec!["cover".to_string()]
        );
        assert!(missing_artwork_fields(
            &game_with_artwork(Some("cover.png"), Some("bg.png")),
            &fields
        )
        .is_empty());
    }

    #[test]
    fn normalize_options_defaults_and_deduplicates() {
        let options = normalize_options(ArtworkRepairOptions {
            providers: Some(vec!["VNDB".to_string(), "vndb".to_string()]),
            fields: Some(vec!["cover".to_string(), "cover".to_string()]),
            limit: Some(999),
            retry_attempted: Some(true),
        })
        .unwrap();

        assert_eq!(options.providers, vec!["vndb".to_string()]);
        assert_eq!(options.fields, vec!["cover".to_string()]);
        assert_eq!(options.limit, MAX_LIMIT);
        assert!(options.retry_attempted);
    }

    #[test]
    fn detects_vndb_ids() {
        assert!(is_vndb_id("v123"));
        assert!(is_vndb_id("V123"));
        assert!(!is_vndb_id("x123"));
    }
}
