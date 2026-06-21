use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, OpenFlags};
use tauri::AppHandle;

use crate::db::DbResult;
use crate::infrastructure::paths::AppPaths;
use crate::services::images;

mod description;
mod quarantine;
mod types;

use description::description_image_sources;
pub use quarantine::{
    quarantine_duplicate_content_images, quarantine_invalid_image_cache_files,
    quarantine_orphan_images,
};
#[cfg(test)]
pub(crate) use quarantine::{
    quarantine_duplicate_content_images_with_paths,
    quarantine_invalid_image_cache_files_with_paths, quarantine_orphan_images_with_paths,
};
use types::{
    ImageCacheContentCandidate, ImageDuplicateContentGroups, ImageDuplicateNameGroups,
    ImageReferenceCollection,
};
pub use types::{
    ImageCacheFileIssue, ImageCacheHealth, ImageCacheReferenceSample, ImageDuplicateContentGroup,
    ImageDuplicateNameGroup, ImageHealthReport, ImageHealthReportOptions, ImageHealthSummary,
    ImageQuarantineReport, ImageQuarantineSkippedFile,
};

const DEFAULT_OVERSIZED_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const DEFAULT_SAMPLE_LIMIT: usize = 100;

pub fn get_image_health_report(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    let paths = AppPaths::from_app(app)?;
    get_image_health_report_with_paths(&paths, options)
}

pub(crate) fn get_image_health_report_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageHealthReport> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let sample_limit = options
        .sample_limit
        .unwrap_or(DEFAULT_SAMPLE_LIMIT)
        .clamp(1, 500);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        &references.reference_sources,
        oversized_bytes,
        sample_limit,
    )?;
    let mut summary = references.summary;
    summary.image_files = cache.file_count;
    summary.orphan_files = cache.orphan_file_count;
    summary.duplicate_file_name_groups = cache.duplicate_file_name_groups;
    summary.duplicate_content_groups = cache.duplicate_content_groups;
    summary.oversized_files = cache.oversized_file_count;
    summary.invalid_image_files = cache.invalid_image_file_count;
    summary.invalid_image_refs = cache.invalid_referenced_file_count;
    summary.content_type_mismatch_files = cache.content_type_mismatch_file_count;
    summary.content_type_mismatch_refs = cache.content_type_mismatch_referenced_file_count;
    summary.issue_image_refs += cache.invalid_referenced_file_count;
    let recommendations = image_health_recommendations(&summary);

    Ok(ImageHealthReport {
        generated_at: Utc::now().to_rfc3339(),
        summary,
        cache,
        recommendations,
    })
}

fn collect_image_references(paths: &AppPaths) -> DbResult<ImageReferenceCollection> {
    let database_path = paths.database();
    if !database_path.is_file() {
        return Ok(ImageReferenceCollection::default());
    }

    let conn = Connection::open_with_flags(&database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut collection = ImageReferenceCollection::default();
    if table_exists(&conn, "games")? {
        collect_game_image_fields(paths, &conn, &mut collection)?;
        collect_description_image_fields(paths, &conn, &mut collection)?;
        collection.summary.missing_cover_games =
            count_games_where(&conn, "cover_image IS NULL OR TRIM(cover_image) = ''")?;
        collection.summary.missing_artwork_games = count_games_where(
            &conn,
            "cover_image IS NULL OR TRIM(cover_image) = '' OR banner_image IS NULL OR TRIM(banner_image) = '' OR background_image IS NULL OR TRIM(background_image) = ''",
        )?;
    }
    if table_exists(&conn, "game_assets")? && column_exists(&conn, "game_assets", "uri")? {
        collect_asset_image_fields(paths, &conn, &mut collection)?;
    }
    Ok(collection)
}

fn collect_game_image_fields(
    paths: &AppPaths,
    conn: &Connection,
    collection: &mut ImageReferenceCollection,
) -> DbResult<()> {
    let columns = ["cover_image", "banner_image", "background_image"]
        .into_iter()
        .filter(|column| column_exists(conn, "games", column).unwrap_or(false))
        .collect::<Vec<_>>();
    if columns.is_empty() {
        return Ok(());
    }
    let has_id = column_exists(conn, "games", "id")?;
    let has_title = column_exists(conn, "games", "title")?;
    let mut select_columns = Vec::new();
    if has_id {
        select_columns.push("id".to_string());
    }
    if has_title {
        select_columns.push("title".to_string());
    }
    select_columns.extend(columns.iter().map(|column| (*column).to_string()));
    let sql = format!("SELECT {} FROM games", select_columns.join(", "));
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        let mut offset = 0;
        let game_id = if has_id {
            let value = row.get::<_, Option<String>>(offset)?;
            offset += 1;
            value
        } else {
            None
        };
        let game_title = if has_title {
            let value = row.get::<_, Option<String>>(offset)?;
            offset += 1;
            value
        } else {
            None
        };
        let mut values = Vec::new();
        for index in 0..columns.len() {
            values.push(row.get::<_, Option<String>>(offset + index)?);
        }
        Ok((game_id, game_title, values))
    })?;
    for row in rows {
        let (game_id, game_title, values) = row?;
        for (index, value) in values.into_iter().enumerate() {
            add_reference(
                paths,
                collection,
                value,
                Some(ImageCacheReferenceSample {
                    game_id: game_id.clone(),
                    game_title: game_title.clone(),
                    source_kind: "game".to_string(),
                    field_name: Some(columns[index].to_string()),
                }),
            );
        }
    }
    Ok(())
}

fn collect_description_image_fields(
    paths: &AppPaths,
    conn: &Connection,
    collection: &mut ImageReferenceCollection,
) -> DbResult<()> {
    if !column_exists(conn, "games", "description")? {
        return Ok(());
    }
    let has_id = column_exists(conn, "games", "id")?;
    let has_title = column_exists(conn, "games", "title")?;
    let id_expr = if has_id { "id" } else { "NULL" };
    let title_expr = if has_title { "title" } else { "NULL" };
    let mut stmt = conn.prepare(&format!(
        "SELECT {id_expr}, {title_expr}, description FROM games"
    ))?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
        ))
    })?;
    for row in rows {
        let (game_id, game_title, description) = row?;
        for source in description_image_sources(&description.unwrap_or_default()) {
            add_reference(
                paths,
                collection,
                Some(source),
                Some(ImageCacheReferenceSample {
                    game_id: game_id.clone(),
                    game_title: game_title.clone(),
                    source_kind: "description".to_string(),
                    field_name: Some("description".to_string()),
                }),
            );
        }
    }
    Ok(())
}

fn collect_asset_image_fields(
    paths: &AppPaths,
    conn: &Connection,
    collection: &mut ImageReferenceCollection,
) -> DbResult<()> {
    let has_game_id = column_exists(conn, "game_assets", "game_id")?;
    let has_asset_type = column_exists(conn, "game_assets", "asset_type")?;
    let has_games_join = table_exists(conn, "games")?
        && column_exists(conn, "games", "id")?
        && column_exists(conn, "games", "title")?;
    let sql = if has_game_id && has_games_join {
        if has_asset_type {
            "SELECT game_assets.uri, game_assets.game_id, games.title, game_assets.asset_type FROM game_assets LEFT JOIN games ON games.id = game_assets.game_id".to_string()
        } else {
            "SELECT game_assets.uri, game_assets.game_id, games.title, NULL FROM game_assets LEFT JOIN games ON games.id = game_assets.game_id".to_string()
        }
    } else if has_game_id {
        if has_asset_type {
            "SELECT uri, game_id, NULL, asset_type FROM game_assets".to_string()
        } else {
            "SELECT uri, game_id, NULL, NULL FROM game_assets".to_string()
        }
    } else {
        "SELECT uri, NULL, NULL, NULL FROM game_assets".to_string()
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;
    for row in rows {
        let (value, game_id, game_title, asset_type) = row?;
        add_reference(
            paths,
            collection,
            value,
            Some(ImageCacheReferenceSample {
                game_id,
                game_title,
                source_kind: "asset".to_string(),
                field_name: asset_type.or_else(|| Some("uri".to_string())),
            }),
        );
    }
    Ok(())
}

fn add_reference(
    paths: &AppPaths,
    collection: &mut ImageReferenceCollection,
    value: Option<String>,
    source: Option<ImageCacheReferenceSample>,
) {
    let Some(value) = value.map(|item| item.trim().trim_matches(['\'', '"']).to_string()) else {
        return;
    };
    if value.is_empty() || images::is_remote_url(&value) || value.starts_with("data:") {
        return;
    }

    collection.summary.total_image_refs += 1;
    let lower = value.to_lowercase();
    let playnite = lower.contains("\\playnite\\")
        || lower.contains("/playnite/")
        || lower.contains("playnite-import")
        || lower.starts_with("d:\\playnite")
        || lower.starts_with("d:/playnite");

    let resolved = resolve_existing_image_path(paths, &value);
    let missing = resolved.is_none();
    if let Some(path) = resolved.as_ref() {
        let key = normalize_path_key(path);
        collection.referenced_paths.insert(key.clone());
        if let Some(source) = source {
            let sources = collection.reference_sources.entry(key).or_default();
            if sources.len() < 5 {
                sources.push(source);
            }
        }
    }

    let under_app_images = resolved
        .as_deref()
        .map(|path| is_under_path(Path::new(path), &paths.images()))
        .unwrap_or(false);
    let c_drive = !under_app_images && (lower.starts_with("c:\\") || lower.starts_with("c:/"));
    if c_drive {
        collection.summary.c_drive_refs += 1;
    }
    if playnite {
        collection.summary.playnite_refs += 1;
        if under_app_images {
            collection.summary.legacy_app_data_import_refs += 1;
        } else {
            collection.summary.external_legacy_refs += 1;
        }
    }
    if missing {
        collection.summary.missing_local_refs += 1;
    }
    if missing || c_drive || (playnite && !under_app_images) {
        collection.summary.issue_image_refs += 1;
    }
}

fn resolve_existing_image_path(paths: &AppPaths, value: &str) -> Option<String> {
    let clean = value.trim().trim_matches(['\'', '"']);
    let path = PathBuf::from(clean);
    if path.is_absolute() {
        return path.is_file().then(|| path.to_string_lossy().to_string());
    }

    let normalized = clean.replace('/', "\\");
    let mut candidates = Vec::new();
    if normalized.to_lowercase().starts_with("images\\") && normalized.len() > "images\\".len() {
        candidates.push(paths.images().join(&normalized["images\\".len()..]));
    }
    candidates.push(paths.root().join(clean));
    candidates.push(paths.images().join(clean));
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .map(|path| path.to_string_lossy().to_string())
}

fn scan_image_cache(
    paths: &AppPaths,
    referenced_paths: &HashSet<String>,
    reference_sources: &HashMap<String, Vec<ImageCacheReferenceSample>>,
    oversized_bytes: u64,
    sample_limit: usize,
) -> DbResult<ImageCacheHealth> {
    let root = paths.images();
    let mut health = ImageCacheHealth {
        root_path: root.to_string_lossy().to_string(),
        ..ImageCacheHealth::default()
    };
    let mut duplicate_names: HashMap<String, Vec<String>> = HashMap::new();
    let mut content_candidates = Vec::new();
    if !root.exists() {
        return Ok(health);
    }
    scan_image_dir(
        &root,
        &root,
        referenced_paths,
        reference_sources,
        oversized_bytes,
        sample_limit,
        &mut duplicate_names,
        &mut content_candidates,
        &mut health,
    )?;
    let duplicate_name_groups = duplicate_name_groups_from_names(duplicate_names, sample_limit);
    health.duplicate_file_name_groups = duplicate_name_groups.total_groups;
    health.duplicate_name_samples = duplicate_name_groups.samples;
    let duplicate_content_groups =
        duplicate_content_groups_from_candidates(content_candidates, sample_limit)?;
    health.duplicate_content_groups = duplicate_content_groups.total_groups;
    health.duplicate_content_samples = duplicate_content_groups.samples;
    Ok(health)
}

fn duplicate_name_groups_from_names(
    duplicate_names: HashMap<String, Vec<String>>,
    sample_limit: usize,
) -> ImageDuplicateNameGroups {
    let mut groups = ImageDuplicateNameGroups::default();
    for (file_name, samples) in duplicate_names {
        if samples.len() <= 1 || is_common_generated_cache_name(&file_name) {
            continue;
        }
        let mut samples = samples;
        samples.sort();
        groups.total_groups += 1;
        groups.samples.push(ImageDuplicateNameGroup {
            file_name,
            count: samples.len() as i64,
            samples: samples.into_iter().take(5).collect(),
        });
    }
    groups.samples.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.file_name.cmp(&right.file_name))
            .then_with(|| left.samples.first().cmp(&right.samples.first()))
    });
    groups.samples.truncate(sample_limit);
    groups
}

fn is_common_generated_cache_name(file_name: &str) -> bool {
    let Some((stem, extension)) = file_name.rsplit_once('.') else {
        return false;
    };
    if !matches!(extension, "jpg" | "jpeg" | "png" | "webp" | "gif" | "ico") {
        return false;
    }
    matches!(stem, "cover" | "background" | "banner" | "icon")
        || stem
            .strip_prefix("description-")
            .map(|suffix| !suffix.is_empty() && suffix.chars().all(|value| value.is_ascii_digit()))
            .unwrap_or(false)
}

#[allow(clippy::too_many_arguments)]
fn scan_image_dir(
    root: &Path,
    path: &Path,
    referenced_paths: &HashSet<String>,
    reference_sources: &HashMap<String, Vec<ImageCacheReferenceSample>>,
    oversized_bytes: u64,
    sample_limit: usize,
    duplicate_names: &mut HashMap<String, Vec<String>>,
    content_candidates: &mut Vec<ImageCacheContentCandidate>,
    health: &mut ImageCacheHealth,
) -> DbResult<()> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            scan_image_dir(
                root,
                &path,
                referenced_paths,
                reference_sources,
                oversized_bytes,
                sample_limit,
                duplicate_names,
                content_candidates,
                health,
            )?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let metadata = entry.metadata()?;
        let size_bytes = metadata.len();
        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();
        let issue = ImageCacheFileIssue {
            path: path.to_string_lossy().to_string(),
            relative_path: relative_path.clone(),
            size_bytes,
            reference_samples: reference_sources
                .get(&normalize_path_key(&path.to_string_lossy()))
                .cloned()
                .unwrap_or_default(),
        };
        health.file_count += 1;
        health.total_bytes += size_bytes;
        duplicate_names
            .entry(
                path.file_name()
                    .map(|name| name.to_string_lossy().to_ascii_lowercase())
                    .unwrap_or_default(),
            )
            .or_default()
            .push(relative_path.clone());
        content_candidates.push(ImageCacheContentCandidate {
            path: path.clone(),
            relative_path: relative_path.clone(),
            size_bytes,
            content_hash: 0,
        });

        let path_key = normalize_path_key(&path.to_string_lossy());
        let is_referenced = referenced_paths.contains(&path_key);
        if is_referenced {
            health.referenced_file_count += 1;
        } else {
            health.orphan_file_count += 1;
            health.orphan_bytes += size_bytes;
            if health.orphan_samples.len() < sample_limit {
                health.orphan_samples.push(issue.clone());
            }
        }

        if size_bytes > oversized_bytes {
            health.oversized_file_count += 1;
            health.oversized_bytes += size_bytes;
            if health.oversized_samples.len() < sample_limit {
                health.oversized_samples.push(issue.clone());
            }
        }

        match classify_image_cache_content(&path)? {
            Some(ImageCacheContentIssue::Invalid) => {
                health.invalid_image_file_count += 1;
                health.invalid_image_bytes += size_bytes;
                if is_referenced {
                    health.invalid_referenced_file_count += 1;
                }
                if health.invalid_image_samples.len() < sample_limit {
                    health.invalid_image_samples.push(issue);
                }
            }
            Some(ImageCacheContentIssue::ContentTypeMismatch) => {
                health.content_type_mismatch_file_count += 1;
                health.content_type_mismatch_bytes += size_bytes;
                if is_referenced {
                    health.content_type_mismatch_referenced_file_count += 1;
                }
                if health.content_type_mismatch_samples.len() < sample_limit {
                    health.content_type_mismatch_samples.push(issue);
                }
            }
            None => {}
        }
    }
    Ok(())
}

fn duplicate_content_groups_from_candidates(
    candidates: Vec<ImageCacheContentCandidate>,
    sample_limit: usize,
) -> DbResult<ImageDuplicateContentGroups> {
    let mut groups = ImageDuplicateContentGroups::default();
    for group in duplicate_content_candidate_groups_from_candidates(candidates)? {
        let size_bytes = group
            .first()
            .map(|candidate| candidate.size_bytes)
            .unwrap_or(0);
        let content_hash = group
            .first()
            .map(|candidate| candidate.content_hash)
            .unwrap_or(0);
        let mut samples = group
            .into_iter()
            .map(|candidate| candidate.relative_path)
            .collect::<Vec<_>>();
        samples.sort();
        groups.total_groups += 1;
        groups.samples.push(ImageDuplicateContentGroup {
            content_hash: format!("{content_hash:016x}"),
            size_bytes,
            count: samples.len() as i64,
            samples: samples.into_iter().take(5).collect(),
        });
    }
    groups.samples.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| right.size_bytes.cmp(&left.size_bytes))
            .then_with(|| left.samples.first().cmp(&right.samples.first()))
            .then_with(|| left.content_hash.cmp(&right.content_hash))
    });
    groups.samples.truncate(sample_limit);
    Ok(groups)
}

fn duplicate_content_candidate_groups_from_candidates(
    candidates: Vec<ImageCacheContentCandidate>,
) -> DbResult<Vec<Vec<ImageCacheContentCandidate>>> {
    let mut by_size: HashMap<u64, Vec<ImageCacheContentCandidate>> = HashMap::new();
    for candidate in candidates {
        by_size
            .entry(candidate.size_bytes)
            .or_default()
            .push(candidate);
    }

    let mut by_content: HashMap<(u64, u64), Vec<ImageCacheContentCandidate>> = HashMap::new();
    for (size_bytes, same_size_candidates) in by_size {
        if same_size_candidates.len() < 2 {
            continue;
        }
        for mut candidate in same_size_candidates {
            let content_hash = hash_file_content(&candidate.path)?;
            candidate.content_hash = content_hash;
            by_content
                .entry((content_hash, size_bytes))
                .or_default()
                .push(candidate);
        }
    }

    Ok(by_content
        .into_values()
        .filter(|group| group.len() > 1)
        .collect())
}

fn image_health_recommendations(summary: &ImageHealthSummary) -> Vec<String> {
    let mut recommendations = Vec::new();
    if summary.orphan_files > 0 {
        recommendations.push("先预览孤儿图片隔离；隔离不会永久删除文件。".to_string());
    }
    if summary.invalid_image_files > 0 {
        recommendations
            .push("发现空文件或损坏的图片缓存；建议重新抓取对应封面或媒体图。".to_string());
    }
    if summary.content_type_mismatch_files > 0 {
        recommendations.push(
            "发现扩展名和真实图片格式不一致的缓存；应用会按文件头显示，后续可做路径规范化。"
                .to_string(),
        );
    }
    if summary.missing_local_refs > 0 {
        recommendations.push("先修复缺失图片引用，再运行缓存隔离。".to_string());
    }
    if summary.duplicate_file_name_groups > 0 {
        recommendations.push("重复文件名需要人工定位样本并确认内容是否相同。".to_string());
    }
    if summary.duplicate_content_groups > 0 {
        recommendations.push("发现重复内容缓存；确认引用后可优先隔离未引用副本。".to_string());
    }
    if summary.oversized_files > 0 {
        recommendations.push("过大图片建议先定位样本，确认后再压缩或重新抓取。".to_string());
    }
    if summary.legacy_app_data_import_refs > 0 {
        recommendations.push(
            "Playnite 旧导入路径仍在 app-data/images 内，可稍后做便携路径规范化。".to_string(),
        );
    }
    if recommendations.is_empty() {
        recommendations.push("图片缓存和引用未发现需要立即处理的问题。".to_string());
    }
    recommendations
}

fn hash_file_content(path: &Path) -> DbResult<u64> {
    let mut file = fs::File::open(path)?;
    let mut hash = 0xcbf29ce484222325u64;
    let mut buffer = [0u8; 8192];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        for byte in &buffer[..read] {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
    }
    Ok(hash)
}

enum ImageCacheContentIssue {
    Invalid,
    ContentTypeMismatch,
}

fn classify_image_cache_content(path: &Path) -> DbResult<Option<ImageCacheContentIssue>> {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return Ok(None);
    };
    let extension = extension.to_ascii_lowercase();
    if !matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp" | "gif") {
        return Ok(None);
    }

    let mut file = fs::File::open(path)?;
    let mut header = [0u8; 16];
    let read = file.read(&mut header)?;
    if read == 0 {
        return Ok(Some(ImageCacheContentIssue::Invalid));
    }

    let bytes = &header[..read];
    let expected = if extension == "jpeg" {
        "jpg"
    } else {
        extension.as_str()
    };
    let Some(actual) = image_content_kind(bytes) else {
        return Ok(Some(ImageCacheContentIssue::Invalid));
    };
    if actual == expected {
        Ok(None)
    } else {
        Ok(Some(ImageCacheContentIssue::ContentTypeMismatch))
    }
}

fn image_content_kind(bytes: &[u8]) -> Option<&'static str> {
    if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Some("jpg");
    }
    if bytes.starts_with(b"\x89PNG\r\n\x1A\n") {
        return Some("png");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("webp");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("gif");
    }
    None
}

fn table_exists(conn: &Connection, table: &str) -> DbResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [table],
        |row| row.get::<_, i64>(0),
    )? != 0)
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> DbResult<bool> {
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for name in rows {
        if name? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn count_games_where(conn: &Connection, condition: &str) -> DbResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM games WHERE {condition}");
    Ok(conn.query_row(&sql, [], |row| row.get::<_, i64>(0))?)
}

fn normalize_path_key(value: &str) -> String {
    value.replace('/', "\\").to_lowercase()
}

fn is_under_path(path: &Path, root: &Path) -> bool {
    let Ok(path) = path.canonicalize() else {
        return false;
    };
    let Ok(root) = root.canonicalize() else {
        return false;
    };
    path.starts_with(root)
}

#[cfg(test)]
#[path = "image_health_tests.rs"]
mod image_health_tests;
