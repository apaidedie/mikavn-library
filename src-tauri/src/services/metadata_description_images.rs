use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::thread;

use tauri::AppHandle;

use crate::db::models::{
    DescriptionImageProviderIdRow, DescriptionImageRepairCandidateRow, Game, TaskRecord,
    UpdateGameInput,
};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::games as game_service;
use crate::services::images;
use crate::services::metadata::cleaning::{is_dlsite_id, is_fanza_id};
use crate::services::metadata::providers::{dlsite, fanza};
use crate::services::tasks;

const DEFAULT_LIMIT: usize = 20;
const MAX_LIMIT: usize = 200;
const DEFAULT_MAX_IMAGES: usize = 3;
const MAX_IMAGES: usize = 8;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionImageRepairOptions {
    pub provider: Option<String>,
    pub limit: Option<usize>,
    pub max_images: Option<usize>,
    pub retry_attempted: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionImageRepairPreview {
    pub candidates: Vec<DescriptionImageRepairCandidate>,
    pub total_candidates: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionImageRepairCandidate {
    pub game_id: String,
    pub title: String,
    pub provider: String,
    pub provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DescriptionImageRepairPayload {
    provider: String,
    limit: usize,
    max_images: usize,
    retry_attempted: bool,
}

struct RepairRunOptions {
    provider: String,
    limit: usize,
    max_images: usize,
    retry_attempted: bool,
}

struct CachedImage {
    alt: String,
    path: String,
}

pub fn preview_description_image_repair(
    db: &Database,
    options: DescriptionImageRepairOptions,
) -> DbResult<DescriptionImageRepairPreview> {
    let run_options = normalize_options(options)?;
    let all_candidates = repair_candidates(db, &run_options)?;
    let total_candidates = all_candidates.len();
    Ok(DescriptionImageRepairPreview {
        candidates: all_candidates.into_iter().take(run_options.limit).collect(),
        total_candidates,
    })
}

pub fn enqueue_description_image_repair_task(
    app: AppHandle,
    db: &Database,
    options: DescriptionImageRepairOptions,
) -> DbResult<TaskRecord> {
    let run_options = normalize_options(options)?;
    let preview = preview_description_image_repair(
        db,
        DescriptionImageRepairOptions {
            provider: Some(run_options.provider.clone()),
            limit: Some(run_options.limit),
            max_images: Some(run_options.max_images),
            retry_attempted: Some(run_options.retry_attempted),
        },
    )?;
    if preview.total_candidates == 0 {
        return Err(DbError::validation(
            "no description image repair candidates",
        ));
    }

    let payload = serde_json::to_string(&DescriptionImageRepairPayload {
        provider: run_options.provider.clone(),
        limit: run_options.limit,
        max_images: run_options.max_images,
        retry_attempted: run_options.retry_attempted,
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "metadata.description_image_repair",
        Some(format!(
            "正在修复 {} 个条目的简介图片",
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
        if let Err(error) =
            run_description_image_repair(&app_handle, &db, &paths, &task_id, run_options)
        {
            logger::log_error(
                &paths,
                "metadata.description_image_repair",
                error.to_string(),
            );
            let _ = tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "failed",
                1.0,
                Some("简介图片修复失败".to_string()),
                Some(error.to_string()),
            );
        }
    });

    Ok(task)
}

pub fn retry_description_image_repair_task(
    app: AppHandle,
    db: &Database,
    payload: &str,
) -> DbResult<TaskRecord> {
    let payload: DescriptionImageRepairPayload = serde_json::from_str(payload)?;
    enqueue_description_image_repair_task(
        app,
        db,
        DescriptionImageRepairOptions {
            provider: Some(payload.provider),
            limit: Some(payload.limit),
            max_images: Some(payload.max_images),
            retry_attempted: Some(payload.retry_attempted),
        },
    )
}

fn run_description_image_repair(
    app: &AppHandle,
    db: &Database,
    paths: &AppPaths,
    task_id: &str,
    options: RepairRunOptions,
) -> DbResult<()> {
    let candidates = repair_candidates(db, &options)?
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
            Some("没有需要修复简介图片的条目".to_string()),
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
    let mut inserted_images = 0usize;
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
                "正在处理 {}/{}：{} {}",
                index + 1,
                candidates.len(),
                candidate.provider,
                candidate.provider_id
            )),
            None,
        )?;

        match repair_candidate(paths, db, candidate, options.max_images) {
            Ok(RepairOutcome::Updated(count)) => {
                updated += 1;
                inserted_images += count;
                let _ = db.append_task_log(
                    task_id,
                    "info",
                    &format!(
                        "已修复：{} [{}]，{} {}，插入 {} 张图片。",
                        candidate.title,
                        candidate.game_id,
                        candidate.provider,
                        candidate.provider_id,
                        count
                    ),
                );
            }
            Ok(RepairOutcome::Skipped(reason)) => {
                skipped += 1;
                let _ = db.append_task_log(
                    task_id,
                    "warn",
                    &format!(
                        "跳过：{} [{}]，{} {}，{}。",
                        candidate.title,
                        candidate.game_id,
                        candidate.provider,
                        candidate.provider_id,
                        reason
                    ),
                );
            }
            Err(error) => {
                failed += 1;
                let _ = db.append_task_log(
                    task_id,
                    "error",
                    &format!(
                        "失败：{} [{}]，{} {}，{}。",
                        candidate.title,
                        candidate.game_id,
                        candidate.provider,
                        candidate.provider_id,
                        error
                    ),
                );
            }
        }
    }

    let message = format!(
        "简介图片修复完成：更新 {} 个条目，插入 {} 张图片，跳过 {} 个，失败 {} 个。",
        updated, inserted_images, skipped, failed
    );
    logger::log_info(paths, "metadata.description_image_repair", &message);
    tasks::update_task(app, db, task_id, "completed", 1.0, Some(message), None)?;
    Ok(())
}

enum RepairOutcome {
    Updated(usize),
    Skipped(String),
}

fn repair_candidate(
    paths: &AppPaths,
    db: &Database,
    candidate: &DescriptionImageRepairCandidate,
    max_images: usize,
) -> DbResult<RepairOutcome> {
    let game = db.get_game(candidate.game_id.clone())?;
    let original = game.description.clone().unwrap_or_default();
    if !description_needs_images(&game) {
        return Ok(RepairOutcome::Skipped(
            "条目已经有简介图片或简介为空".to_string(),
        ));
    }

    let provider_description = provider_description(candidate)?;
    let remote_images = remote_description_image_tokens(&provider_description);
    if remote_images.is_empty() {
        return Ok(RepairOutcome::Skipped(
            "来源详情没有可用简介图片".to_string(),
        ));
    }

    let mut cached = Vec::new();
    for (index, image) in remote_images.into_iter().take(max_images).enumerate() {
        let local_path = images::cache_remote_image(
            paths.root(),
            &candidate.provider,
            &candidate.provider_id,
            &image.src,
            &format!("description-{}", index + 1),
        )?;
        cached.push(CachedImage {
            alt: image.alt,
            path: local_path,
        });
    }
    if cached.is_empty() {
        return Ok(RepairOutcome::Skipped("图片下载失败".to_string()));
    }

    let patched = append_cached_images(&original, &cached);
    game_service::update_game(
        db,
        candidate.game_id.clone(),
        UpdateGameInput {
            description: Some(patched),
            ..UpdateGameInput::default()
        },
    )?;
    Ok(RepairOutcome::Updated(cached.len()))
}

fn provider_description(candidate: &DescriptionImageRepairCandidate) -> DbResult<String> {
    let result = match candidate.provider.as_str() {
        "dlsite" => dlsite::detail(&candidate.provider_id),
        "fanza" => fanza::detail(&candidate.provider_id),
        _ => Err(DbError::validation(
            "unsupported provider for description image repair",
        )),
    }?;
    result
        .description
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| DbError::metadata_provider_failed("provider detail has no description"))
}

fn repair_candidates(
    db: &Database,
    options: &RepairRunOptions,
) -> DbResult<Vec<DescriptionImageRepairCandidate>> {
    let provider_rows =
        description_provider_rows_by_game(db.list_description_image_provider_id_rows()?);
    Ok(db
        .list_description_image_repair_candidate_rows()?
        .into_iter()
        .filter(|row| description_needs_images_from_value(row.description.as_deref()))
        .filter_map(|row| {
            let rows = provider_rows.get(&row.id).map_or(&[][..], Vec::as_slice);
            candidate_from_row(row, rows, &options.provider)
        })
        .collect())
}

fn candidate_from_row(
    row: DescriptionImageRepairCandidateRow,
    provider_rows: &[DescriptionImageProviderIdRow],
    provider_filter: &str,
) -> Option<DescriptionImageRepairCandidate> {
    if provider_filter == "all" || provider_filter == "dlsite" {
        if let Some(id) = provider_id_from_rows(provider_rows, "dlsite", is_dlsite_id) {
            return Some(DescriptionImageRepairCandidate {
                game_id: row.id,
                title: row.title,
                provider: "dlsite".to_string(),
                provider_id: id.to_uppercase(),
            });
        }
    }
    if provider_filter == "all" || provider_filter == "fanza" {
        if let Some(id) = provider_id_from_rows(provider_rows, "fanza", is_fanza_id) {
            return Some(DescriptionImageRepairCandidate {
                game_id: row.id,
                title: row.title,
                provider: "fanza".to_string(),
                provider_id: id.to_lowercase(),
            });
        }
    }
    None
}

fn description_provider_rows_by_game(
    rows: Vec<DescriptionImageProviderIdRow>,
) -> HashMap<String, Vec<DescriptionImageProviderIdRow>> {
    let mut grouped: HashMap<String, Vec<DescriptionImageProviderIdRow>> = HashMap::new();
    for row in rows {
        grouped.entry(row.game_id.clone()).or_default().push(row);
    }
    grouped
}

fn provider_id_from_rows(
    rows: &[DescriptionImageProviderIdRow],
    provider: &str,
    is_valid: impl Fn(&str) -> bool,
) -> Option<String> {
    rows.iter().find_map(|row| {
        let id = row.external_id.trim();
        if row.provider.trim().eq_ignore_ascii_case(provider) && is_valid(id) {
            Some(id.to_string())
        } else {
            None
        }
    })
}

fn description_needs_images(game: &Game) -> bool {
    description_needs_images_from_value(game.description.as_deref())
}

fn description_needs_images_from_value(description: Option<&str>) -> bool {
    description
        .map(|description| {
            !description.trim().is_empty() && !has_description_image_token(description)
        })
        .unwrap_or(false)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DescriptionImageToken {
    alt: String,
    src: String,
}

fn description_image_tokens(value: &str) -> Vec<DescriptionImageToken> {
    static IMAGE_RE: OnceLock<Regex> = OnceLock::new();
    let re = IMAGE_RE.get_or_init(|| {
        Regex::new(r#"(?is)!\[([^\]]*)\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[/img\]|https?://[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?"#)
            .expect("valid description image regex")
    });
    re.captures_iter(value)
        .filter_map(|captures| {
            let src = captures
                .get(2)
                .or_else(|| img_src_from_tag(captures.get(0)?.as_str()))
                .or_else(|| captures.get(3))
                .or_else(|| captures.get(0))?
                .as_str()
                .trim()
                .trim_matches(['\'', '"'])
                .trim_end_matches([')', ',', '，', '。', '.', ';', '；'])
                .to_string();
            let alt = captures
                .get(1)
                .map(|value| sanitize_markdown_alt(value.as_str()))
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "简介图片".to_string());
            Some(DescriptionImageToken { alt, src })
        })
        .collect()
}

fn remote_description_image_tokens(value: &str) -> Vec<DescriptionImageToken> {
    description_image_tokens(value)
        .into_iter()
        .filter(|token| images::is_remote_url(&token.src))
        .collect()
}

fn has_description_image_token(value: &str) -> bool {
    !description_image_tokens(value).is_empty()
}

fn img_src_from_tag(tag: &str) -> Option<regex::Match<'_>> {
    static IMG_SRC_RE: OnceLock<Regex> = OnceLock::new();
    let pattern = IMG_SRC_RE.get_or_init(|| {
        Regex::new(r#"(?i)\b(?:src|data-src|data-original|data-lazy-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#)
            .expect("valid img src regex")
    });
    pattern.captures(tag).and_then(|captures| {
        captures
            .get(1)
            .or_else(|| captures.get(2))
            .or_else(|| captures.get(3))
    })
}

fn append_cached_images(description: &str, images: &[CachedImage]) -> String {
    let mut patched = description.trim_end().to_string();
    let links = images
        .iter()
        .map(|image| format!("![{}]({})", sanitize_markdown_alt(&image.alt), image.path))
        .collect::<Vec<_>>()
        .join("\n\n");
    if !links.is_empty() {
        if !patched.is_empty() {
            patched.push_str("\n\n");
        }
        patched.push_str(&links);
    }
    patched
}

fn sanitize_markdown_alt(value: &str) -> String {
    let clean = value
        .replace(['[', ']'], " ")
        .replace(['\r', '\n'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let clean = clean.chars().take(80).collect::<String>();
    if clean.is_empty() {
        "简介图片".to_string()
    } else {
        clean
    }
}

fn normalize_options(options: DescriptionImageRepairOptions) -> DbResult<RepairRunOptions> {
    let provider = options
        .provider
        .unwrap_or_else(|| "all".to_string())
        .trim()
        .to_lowercase();
    if !matches!(provider.as_str(), "all" | "dlsite" | "fanza") {
        return Err(DbError::validation(
            "provider must be all, dlsite, or fanza",
        ));
    }
    let limit = options.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let max_images = options
        .max_images
        .unwrap_or(DEFAULT_MAX_IMAGES)
        .clamp(1, MAX_IMAGES);
    Ok(RepairRunOptions {
        provider,
        limit,
        max_images,
        retry_attempted: options.retry_attempted.unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        let path = std::env::temp_dir().join(format!(
            "mikavn-description-image-repair-test-{}.db",
            uuid::Uuid::new_v4()
        ));
        Database::new_from_path(path).unwrap()
    }

    fn game_with_description(description: Option<&str>) -> Game {
        Game {
            id: "game".to_string(),
            title: "Game".to_string(),
            original_title: None,
            aliases: Vec::new(),
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: description.map(ToString::to_string),
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
            cover_image: None,
            banner_image: None,
            background_image: None,
            vndb_id: None,
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
            total_play_seconds: 0,
            last_played_at: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn description_image_tokens_extract_markdown_and_urls() {
        let tokens = description_image_tokens(
            "Intro\n![紹介画像](https://example.com/a.webp?x=1)\nhttps://example.com/b.jpg.",
        );

        assert_eq!(tokens.len(), 2);
        assert_eq!(tokens[0].alt, "紹介画像");
        assert_eq!(tokens[0].src, "https://example.com/a.webp?x=1");
        assert_eq!(tokens[1].alt, "简介图片");
        assert_eq!(tokens[1].src, "https://example.com/b.jpg");
    }

    #[test]
    fn description_image_tokens_include_local_and_html_images() {
        let tokens = description_image_tokens(
            r#"Intro
![local](E:\MikaVN Library\app-data\images\local.webp)
<img data-src="https://example.com/html.png" alt="HTML">
[img]E:\MikaVN Library\app-data\images\bbcode.jpg[/img]"#,
        );

        assert_eq!(tokens.len(), 3);
        assert!(has_description_image_token(
            "![local](E:\\MikaVN Library\\app-data\\images\\local.webp)"
        ));
        assert_eq!(
            tokens[0].src,
            r#"E:\MikaVN Library\app-data\images\local.webp"#
        );
        assert_eq!(tokens[1].src, "https://example.com/html.png");
        assert_eq!(
            tokens[2].src,
            r#"E:\MikaVN Library\app-data\images\bbcode.jpg"#
        );
    }

    #[test]
    fn remote_description_image_tokens_only_returns_downloadable_urls() {
        let tokens = remote_description_image_tokens(
            r#"![local](E:\MikaVN Library\app-data\images\local.webp)
![remote](https://example.com/remote.webp)"#,
        );

        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].src, "https://example.com/remote.webp");
    }

    #[test]
    fn append_cached_images_preserves_description_text() {
        let patched = append_cached_images(
            "文本简介\n",
            &[CachedImage {
                alt: "介绍图".to_string(),
                path: "E:\\MikaVN Library\\app-data\\images\\metadata.webp".to_string(),
            }],
        );

        assert_eq!(
            patched,
            "文本简介\n\n![介绍图](E:\\MikaVN Library\\app-data\\images\\metadata.webp)"
        );
    }

    #[test]
    fn normalize_options_clamps_limits() {
        let options = normalize_options(DescriptionImageRepairOptions {
            provider: Some("DLSITE".to_string()),
            limit: Some(999),
            max_images: Some(99),
            retry_attempted: Some(true),
        })
        .unwrap();

        assert_eq!(options.provider, "dlsite");
        assert_eq!(options.limit, MAX_LIMIT);
        assert_eq!(options.max_images, MAX_IMAGES);
        assert!(options.retry_attempted);
    }

    #[test]
    fn description_preview_reads_normalized_external_ids_from_lightweight_rows() {
        let db = test_db();
        db.insert_imported_game_record(game_with_description(Some("只有文字简介。")))
            .unwrap();
        db.upsert_external_id("game", "dlsite", "RJ01234567", Some("manual"), None)
            .unwrap();

        let preview = preview_description_image_repair(
            &db,
            DescriptionImageRepairOptions {
                provider: Some("dlsite".to_string()),
                limit: Some(10),
                max_images: Some(3),
                retry_attempted: None,
            },
        )
        .unwrap();

        assert_eq!(preview.total_candidates, 1);
        assert_eq!(preview.candidates[0].game_id, "game");
        assert_eq!(preview.candidates[0].provider, "dlsite");
        assert_eq!(preview.candidates[0].provider_id, "RJ01234567");
    }
}
