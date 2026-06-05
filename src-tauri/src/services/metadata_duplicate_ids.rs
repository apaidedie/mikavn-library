use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::thread;

use tauri::AppHandle;

use crate::db::models::{Game, GameFilter, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

const DEFAULT_LIMIT: usize = 50;
const MAX_LIMIT: usize = 500;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateExternalIdAuditOptions {
    pub providers: Option<Vec<String>>,
    pub limit: Option<usize>,
    pub retry_attempted: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateExternalIdPreview {
    pub groups: Vec<DuplicateExternalIdGroup>,
    pub total_groups: usize,
    pub total_games: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateExternalIdGroup {
    pub provider: String,
    pub external_id: String,
    pub game_count: usize,
    pub games: Vec<DuplicateExternalIdGame>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateExternalIdGame {
    pub game_id: String,
    pub title: String,
    pub install_path: String,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DuplicateExternalIdAuditPayload {
    providers: Option<Vec<String>>,
    limit: usize,
    retry_attempted: bool,
}

struct AuditRunOptions {
    provider_filter: Option<HashSet<String>>,
    providers_payload: Option<Vec<String>>,
    limit: usize,
    retry_attempted: bool,
}

#[derive(Debug, Clone)]
struct ExternalIdEntry {
    provider: String,
    external_id: String,
    normalized_external_id: String,
    game_id: String,
    title: String,
    install_path: String,
    source: String,
}

#[derive(Debug, Clone)]
struct DuplicateGroupAccumulator {
    provider: String,
    external_id: String,
    games: BTreeMap<String, DuplicateExternalIdGame>,
}

pub fn preview_duplicate_external_ids(
    db: &Database,
    options: DuplicateExternalIdAuditOptions,
) -> DbResult<DuplicateExternalIdPreview> {
    let run_options = normalize_options(options)?;
    let entries = collect_external_id_entries(db, &run_options)?;
    Ok(build_duplicate_preview(entries, run_options.limit))
}

pub fn enqueue_duplicate_external_id_audit_task(
    app: AppHandle,
    db: &Database,
    options: DuplicateExternalIdAuditOptions,
) -> DbResult<TaskRecord> {
    let run_options = normalize_options(options)?;
    let preview = preview_duplicate_external_ids(
        db,
        DuplicateExternalIdAuditOptions {
            providers: run_options.providers_payload.clone(),
            limit: Some(run_options.limit),
            retry_attempted: Some(run_options.retry_attempted),
        },
    )?;
    if preview.total_groups == 0 {
        return Err(DbError::validation("no duplicate external ids"));
    }

    let payload = serde_json::to_string(&DuplicateExternalIdAuditPayload {
        providers: run_options.providers_payload.clone(),
        limit: run_options.limit,
        retry_attempted: run_options.retry_attempted,
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "metadata.duplicate_id_audit",
        Some(format!("正在审查 {} 组重复外部 ID", preview.groups.len())),
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
        if let Err(error) =
            run_duplicate_external_id_audit(&app_handle, &db, &paths, &task_id, run_options)
        {
            logger::log_error(&paths, "metadata.duplicate_id_audit", error.to_string());
            let _ = tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "failed",
                1.0,
                Some("重复外部 ID 审查失败".to_string()),
                Some(error.to_string()),
            );
        }
    });

    Ok(task)
}

pub fn retry_duplicate_external_id_audit_task(
    app: AppHandle,
    db: &Database,
    payload: &str,
) -> DbResult<TaskRecord> {
    let payload: DuplicateExternalIdAuditPayload = serde_json::from_str(payload)?;
    enqueue_duplicate_external_id_audit_task(
        app,
        db,
        DuplicateExternalIdAuditOptions {
            providers: payload.providers,
            limit: Some(payload.limit),
            retry_attempted: Some(payload.retry_attempted),
        },
    )
}

fn run_duplicate_external_id_audit(
    app: &AppHandle,
    db: &Database,
    paths: &AppPaths,
    task_id: &str,
    options: AuditRunOptions,
) -> DbResult<()> {
    let entries = collect_external_id_entries(db, &options)?;
    let preview = build_duplicate_preview(entries, options.limit);
    if preview.total_groups == 0 {
        tasks::update_task(
            app,
            db,
            task_id,
            "completed",
            1.0,
            Some("没有发现重复外部 ID。".to_string()),
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
        Some(format!(
            "发现 {} 组重复外部 ID，涉及 {} 个游戏记录",
            preview.total_groups, preview.total_games
        )),
        None,
    )?;

    let total = preview.groups.len().max(1) as f64;
    for (index, group) in preview.groups.iter().enumerate() {
        let progress = (index as f64 / total).clamp(0.0, 0.98);
        tasks::update_task(
            app,
            db,
            task_id,
            "running",
            progress,
            Some(format!(
                "正在记录 {}/{}：{} {}",
                index + 1,
                preview.groups.len(),
                group.provider,
                group.external_id
            )),
            None,
        )?;
        let games = group
            .games
            .iter()
            .map(|game| {
                format!(
                    "{} [{}] · {} · 来源 {}",
                    game.title,
                    game.game_id,
                    game.install_path,
                    game.sources.join("+")
                )
            })
            .collect::<Vec<_>>()
            .join(" | ");
        let _ = db.append_task_log(
            task_id,
            "warn",
            &format!(
                "重复组：{} {}，{} 个游戏：{}",
                group.provider, group.external_id, group.game_count, games
            ),
        );
    }

    let message = format!(
        "重复外部 ID 审查完成：发现 {} 组，涉及 {} 个游戏记录。请在任务日志中确认是否需要合并游戏条目。",
        preview.total_groups, preview.total_games
    );
    logger::log_info(paths, "metadata.duplicate_id_audit", &message);
    tasks::update_task(app, db, task_id, "completed", 1.0, Some(message), None)?;
    Ok(())
}

fn collect_external_id_entries(
    db: &Database,
    options: &AuditRunOptions,
) -> DbResult<Vec<ExternalIdEntry>> {
    let games = db.list_games(GameFilter {
        sort_by: Some("title".to_string()),
        sort_direction: Some("asc".to_string()),
        ..GameFilter::default()
    })?;
    let mut entries = Vec::new();
    for game in games {
        push_game_field(
            &mut entries,
            &game,
            "vndb",
            game.vndb_id.as_deref(),
            "vndb_id",
            options,
        );
        push_game_field(
            &mut entries,
            &game,
            "bangumi",
            game.bangumi_id.as_deref(),
            "bangumi_id",
            options,
        );
        push_game_field(
            &mut entries,
            &game,
            "dlsite",
            game.dlsite_id.as_deref(),
            "dlsite_id",
            options,
        );
        push_game_field(
            &mut entries,
            &game,
            "fanza",
            game.fanza_id.as_deref(),
            "fanza_id",
            options,
        );
        push_game_field(
            &mut entries,
            &game,
            "ymgal",
            game.ymgal_id.as_deref(),
            "ymgal_id",
            options,
        );

        for record in db.list_external_ids(game.id.clone())? {
            let provider = record.provider.trim().to_lowercase();
            if !provider_allowed(&provider, options) {
                continue;
            }
            if let Some(entry) = external_id_entry(
                &game,
                &provider,
                &record.external_id,
                &record
                    .source
                    .as_deref()
                    .map(|source| format!("external_ids:{source}"))
                    .unwrap_or_else(|| "external_ids".to_string()),
            ) {
                entries.push(entry);
            }
        }
    }
    Ok(entries)
}

fn push_game_field(
    entries: &mut Vec<ExternalIdEntry>,
    game: &Game,
    provider: &str,
    external_id: Option<&str>,
    field_name: &str,
    options: &AuditRunOptions,
) {
    if !provider_allowed(provider, options) {
        return;
    }
    if let Some(entry) = external_id
        .and_then(|id| external_id_entry(game, provider, id, &format!("games.{field_name}")))
    {
        entries.push(entry);
    }
}

fn external_id_entry(
    game: &Game,
    provider: &str,
    external_id: &str,
    source: &str,
) -> Option<ExternalIdEntry> {
    let external_id = external_id.trim();
    if provider.trim().is_empty() || external_id.is_empty() {
        return None;
    }
    Some(ExternalIdEntry {
        provider: provider.trim().to_lowercase(),
        external_id: external_id.to_string(),
        normalized_external_id: external_id.to_lowercase(),
        game_id: game.id.clone(),
        title: game.title.clone(),
        install_path: game.install_path.clone(),
        source: source.to_string(),
    })
}

fn build_duplicate_preview(
    entries: Vec<ExternalIdEntry>,
    limit: usize,
) -> DuplicateExternalIdPreview {
    let mut grouped: BTreeMap<(String, String), DuplicateGroupAccumulator> = BTreeMap::new();
    for entry in entries {
        let key = (entry.provider.clone(), entry.normalized_external_id.clone());
        let group = grouped
            .entry(key)
            .or_insert_with(|| DuplicateGroupAccumulator {
                provider: entry.provider.clone(),
                external_id: entry.external_id.clone(),
                games: BTreeMap::new(),
            });
        let game =
            group
                .games
                .entry(entry.game_id.clone())
                .or_insert_with(|| DuplicateExternalIdGame {
                    game_id: entry.game_id,
                    title: entry.title,
                    install_path: entry.install_path,
                    sources: Vec::new(),
                });
        if !game.sources.contains(&entry.source) {
            game.sources.push(entry.source);
        }
    }

    let mut groups = grouped
        .into_values()
        .filter(|group| group.games.len() > 1)
        .map(|group| DuplicateExternalIdGroup {
            provider: group.provider,
            external_id: group.external_id,
            game_count: group.games.len(),
            games: group.games.into_values().collect(),
        })
        .collect::<Vec<_>>();
    groups.sort_by(|left, right| {
        right
            .game_count
            .cmp(&left.game_count)
            .then_with(|| left.provider.cmp(&right.provider))
            .then_with(|| left.external_id.cmp(&right.external_id))
    });
    let total_groups = groups.len();
    let total_games = groups
        .iter()
        .flat_map(|group| group.games.iter().map(|game| game.game_id.clone()))
        .collect::<HashSet<_>>()
        .len();
    DuplicateExternalIdPreview {
        groups: groups.into_iter().take(limit).collect(),
        total_groups,
        total_games,
    }
}

fn provider_allowed(provider: &str, options: &AuditRunOptions) -> bool {
    options
        .provider_filter
        .as_ref()
        .map(|filter| filter.contains(provider))
        .unwrap_or(true)
}

fn normalize_options(options: DuplicateExternalIdAuditOptions) -> DbResult<AuditRunOptions> {
    let limit = options.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let providers = options.providers.unwrap_or_default();
    let providers = providers
        .into_iter()
        .map(|provider| provider.trim().to_lowercase())
        .filter(|provider| !provider.is_empty())
        .collect::<Vec<_>>();
    let provider_filter =
        if providers.is_empty() || providers.iter().any(|provider| provider == "all") {
            None
        } else {
            Some(providers.iter().cloned().collect::<HashSet<_>>())
        };
    let providers_payload = provider_filter
        .as_ref()
        .map(|filter| filter.iter().cloned().collect::<Vec<_>>());
    Ok(AuditRunOptions {
        provider_filter,
        providers_payload,
        limit,
        retry_attempted: options.retry_attempted.unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(provider: &str, external_id: &str, game_id: &str, title: &str) -> ExternalIdEntry {
        ExternalIdEntry {
            provider: provider.to_string(),
            external_id: external_id.to_string(),
            normalized_external_id: external_id.to_lowercase(),
            game_id: game_id.to_string(),
            title: title.to_string(),
            install_path: format!("D:\\Games\\{title}"),
            source: "games.vndb_id".to_string(),
        }
    }

    #[test]
    fn duplicate_preview_groups_distinct_games_only() {
        let preview = build_duplicate_preview(
            vec![
                entry("vndb", "v123", "g1", "One"),
                entry("vndb", "V123", "g1", "One"),
                entry("vndb", "v123", "g2", "Two"),
                entry("dlsite", "RJ01000000", "g3", "Three"),
            ],
            10,
        );

        assert_eq!(preview.total_groups, 1);
        assert_eq!(preview.total_games, 2);
        assert_eq!(preview.groups[0].provider, "vndb");
        assert_eq!(preview.groups[0].game_count, 2);
        assert_eq!(preview.groups[0].games[0].sources.len(), 1);
    }

    #[test]
    fn duplicate_preview_respects_limit() {
        let preview = build_duplicate_preview(
            vec![
                entry("vndb", "v1", "g1", "One"),
                entry("vndb", "v1", "g2", "Two"),
                entry("dlsite", "RJ1", "g3", "Three"),
                entry("dlsite", "RJ1", "g4", "Four"),
            ],
            1,
        );

        assert_eq!(preview.total_groups, 2);
        assert_eq!(preview.groups.len(), 1);
    }
}
