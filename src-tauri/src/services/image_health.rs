use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db::DbResult;
use crate::infrastructure::paths::AppPaths;
use crate::services::images;

const DEFAULT_OVERSIZED_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
const DEFAULT_SAMPLE_LIMIT: usize = 100;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReportOptions {
    pub oversized_bytes: Option<u64>,
    pub sample_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthReport {
    pub generated_at: String,
    pub summary: ImageHealthSummary,
    pub cache: ImageCacheHealth,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHealthSummary {
    pub total_image_refs: i64,
    pub issue_image_refs: i64,
    pub missing_local_refs: i64,
    pub c_drive_refs: i64,
    pub playnite_refs: i64,
    pub legacy_app_data_import_refs: i64,
    pub external_legacy_refs: i64,
    pub image_files: i64,
    pub orphan_files: i64,
    pub duplicate_file_name_groups: i64,
    pub oversized_files: i64,
    pub missing_cover_games: i64,
    pub missing_artwork_games: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheHealth {
    pub root_path: String,
    pub file_count: i64,
    pub total_bytes: u64,
    pub referenced_file_count: i64,
    pub orphan_file_count: i64,
    pub orphan_bytes: u64,
    pub duplicate_file_name_groups: i64,
    pub oversized_file_count: i64,
    pub oversized_bytes: u64,
    pub orphan_samples: Vec<ImageCacheFileIssue>,
    pub duplicate_name_samples: Vec<ImageDuplicateNameGroup>,
    pub oversized_samples: Vec<ImageCacheFileIssue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCacheFileIssue {
    pub path: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDuplicateNameGroup {
    pub file_name: String,
    pub count: i64,
    pub samples: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineReport {
    pub quarantine_dir: String,
    pub manifest_path: String,
    pub moved_files: i64,
    pub moved_bytes: u64,
    pub skipped_files: i64,
    pub skipped: Vec<ImageQuarantineSkippedFile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageQuarantineSkippedFile {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageQuarantineManifest {
    app: String,
    created_at: String,
    moved: Vec<ImageQuarantineManifestItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageQuarantineManifestItem {
    source_path: String,
    quarantine_path: String,
    relative_path: String,
    size_bytes: u64,
    reason: String,
}

#[derive(Debug, Default)]
struct ImageReferenceCollection {
    summary: ImageHealthSummary,
    referenced_paths: HashSet<String>,
}

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
        oversized_bytes,
        sample_limit,
    )?;
    let mut summary = references.summary;
    summary.image_files = cache.file_count;
    summary.orphan_files = cache.orphan_file_count;
    summary.duplicate_file_name_groups = cache.duplicate_file_name_groups;
    summary.oversized_files = cache.oversized_file_count;
    let recommendations = image_health_recommendations(&summary);

    Ok(ImageHealthReport {
        generated_at: Utc::now().to_rfc3339(),
        summary,
        cache,
        recommendations,
    })
}

pub fn quarantine_orphan_images(
    app: &AppHandle,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let paths = AppPaths::from_app(app)?;
    quarantine_orphan_images_with_paths(&paths, options)
}

pub(crate) fn quarantine_orphan_images_with_paths(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<ImageQuarantineReport> {
    let created_at = Utc::now();
    let quarantine_dir = paths
        .root()
        .join("image-quarantine")
        .join(created_at.format("%Y%m%d-%H%M%S").to_string());
    fs::create_dir_all(&quarantine_dir)?;

    let candidates = orphan_candidates(paths, options)?;
    let images_root = paths.images().canonicalize().ok();
    let mut moved = Vec::new();
    let mut skipped = Vec::new();
    let mut moved_bytes = 0;

    for candidate in candidates {
        let source = PathBuf::from(&candidate.path);
        if !source.is_file() {
            skipped.push(ImageQuarantineSkippedFile {
                path: candidate.path,
                reason: "source file no longer exists".to_string(),
            });
            continue;
        }
        if let (Some(images_root), Ok(canonical_source)) =
            (images_root.as_ref(), source.canonicalize())
        {
            if !canonical_source.starts_with(images_root) {
                skipped.push(ImageQuarantineSkippedFile {
                    path: candidate.path,
                    reason: "source is outside image cache".to_string(),
                });
                continue;
            }
        }

        let target = quarantine_dir.join(&candidate.relative_path);
        if target.exists() {
            skipped.push(ImageQuarantineSkippedFile {
                path: candidate.path,
                reason: "quarantine target already exists".to_string(),
            });
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&source, &target)?;
        moved_bytes += candidate.size_bytes;
        moved.push(ImageQuarantineManifestItem {
            source_path: candidate.path,
            quarantine_path: target.to_string_lossy().to_string(),
            relative_path: candidate.relative_path,
            size_bytes: candidate.size_bytes,
            reason: "orphan image cache file".to_string(),
        });
    }

    let manifest_path = quarantine_dir.join("manifest.json");
    let manifest = ImageQuarantineManifest {
        app: "MikaVN Library".to_string(),
        created_at: created_at.to_rfc3339(),
        moved,
    };
    fs::write(&manifest_path, serde_json::to_string_pretty(&manifest)?)?;

    Ok(ImageQuarantineReport {
        quarantine_dir: quarantine_dir.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        moved_files: manifest.moved.len() as i64,
        moved_bytes,
        skipped_files: skipped.len() as i64,
        skipped,
    })
}

fn orphan_candidates(
    paths: &AppPaths,
    options: ImageHealthReportOptions,
) -> DbResult<Vec<ImageCacheFileIssue>> {
    let oversized_bytes = options
        .oversized_bytes
        .unwrap_or(DEFAULT_OVERSIZED_IMAGE_BYTES);
    let references = collect_image_references(paths)?;
    let cache = scan_image_cache(
        paths,
        &references.referenced_paths,
        oversized_bytes,
        usize::MAX,
    )?;
    Ok(cache.orphan_samples)
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
        collection.summary.missing_cover_games =
            count_games_where(&conn, "cover_image IS NULL OR TRIM(cover_image) = ''")?;
        collection.summary.missing_artwork_games = count_games_where(
            &conn,
            "cover_image IS NULL OR TRIM(cover_image) = '' OR banner_image IS NULL OR TRIM(banner_image) = '' OR background_image IS NULL OR TRIM(background_image) = ''",
        )?;
    }
    if table_exists(&conn, "game_assets")? && column_exists(&conn, "game_assets", "uri")? {
        let mut stmt = conn.prepare("SELECT uri FROM game_assets")?;
        let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
        for row in rows {
            add_reference(paths, &mut collection, row?);
        }
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
    let sql = format!("SELECT {} FROM games", columns.join(", "));
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        let mut values = Vec::new();
        for index in 0..columns.len() {
            values.push(row.get::<_, Option<String>>(index)?);
        }
        Ok(values)
    })?;
    for row in rows {
        for value in row? {
            add_reference(paths, collection, value);
        }
    }
    Ok(())
}

fn add_reference(
    paths: &AppPaths,
    collection: &mut ImageReferenceCollection,
    value: Option<String>,
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
        collection.referenced_paths.insert(normalize_path_key(path));
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
    if missing || c_drive || playnite {
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
    oversized_bytes: u64,
    sample_limit: usize,
) -> DbResult<ImageCacheHealth> {
    let root = paths.images();
    let mut health = ImageCacheHealth {
        root_path: root.to_string_lossy().to_string(),
        ..ImageCacheHealth::default()
    };
    let mut duplicate_names: HashMap<String, Vec<String>> = HashMap::new();
    if !root.exists() {
        return Ok(health);
    }
    scan_image_dir(
        &root,
        &root,
        referenced_paths,
        oversized_bytes,
        sample_limit,
        &mut duplicate_names,
        &mut health,
    )?;
    for (file_name, samples) in duplicate_names {
        if samples.len() > 1 {
            health.duplicate_file_name_groups += 1;
            if health.duplicate_name_samples.len() < sample_limit {
                health.duplicate_name_samples.push(ImageDuplicateNameGroup {
                    file_name,
                    count: samples.len() as i64,
                    samples: samples.into_iter().take(5).collect(),
                });
            }
        }
    }
    Ok(health)
}

#[allow(clippy::too_many_arguments)]
fn scan_image_dir(
    root: &Path,
    path: &Path,
    referenced_paths: &HashSet<String>,
    oversized_bytes: u64,
    sample_limit: usize,
    duplicate_names: &mut HashMap<String, Vec<String>>,
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
                oversized_bytes,
                sample_limit,
                duplicate_names,
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
            .push(relative_path);

        if referenced_paths.contains(&normalize_path_key(&path.to_string_lossy())) {
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
                health.oversized_samples.push(issue);
            }
        }
    }
    Ok(())
}

fn image_health_recommendations(summary: &ImageHealthSummary) -> Vec<String> {
    let mut recommendations = Vec::new();
    if summary.orphan_files > 0 {
        recommendations.push("先预览孤儿图片隔离；隔离不会永久删除文件。".to_string());
    }
    if summary.missing_local_refs > 0 {
        recommendations.push("先修复缺失图片引用，再运行缓存隔离。".to_string());
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
mod tests {
    use super::*;
    use crate::infrastructure::paths::AppPaths;
    use rusqlite::Connection;
    use std::fs;
    use std::path::Path;
    use uuid::Uuid;

    #[test]
    fn image_health_report_counts_reference_and_cache_issues() {
        let root = std::env::temp_dir().join(format!("mikavn-image-health-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::create_dir_all(paths.images().join("playnite-import/game")).unwrap();
        fs::create_dir_all(paths.images().join("dupes/a")).unwrap();
        fs::create_dir_all(paths.images().join("dupes/b")).unwrap();

        let cover = paths.images().join("cover.jpg");
        let legacy = paths.images().join("playnite-import/game/cover.jpg");
        let orphan = paths.images().join("orphan.webp");
        let duplicate_a = paths.images().join("dupes/a/same.png");
        let duplicate_b = paths.images().join("dupes/b/same.png");
        let oversized = paths.images().join("large.jpg");
        fs::write(&cover, b"cover").unwrap();
        fs::write(&legacy, b"legacy").unwrap();
        fs::write(&orphan, b"orphan").unwrap();
        fs::write(&duplicate_a, b"a").unwrap();
        fs::write(&duplicate_b, b"b").unwrap();
        fs::write(&oversized, vec![1u8; 6 * 1024 * 1024]).unwrap();

        create_health_db(
            &paths.database(),
            &cover.to_string_lossy(),
            &legacy.to_string_lossy(),
            "C:\\old\\missing.jpg",
        );

        let report =
            get_image_health_report_with_paths(&paths, ImageHealthReportOptions::default())
                .unwrap();

        assert_eq!(report.summary.total_image_refs, 3);
        assert_eq!(report.summary.missing_local_refs, 1);
        assert_eq!(report.summary.c_drive_refs, 1);
        assert_eq!(report.summary.playnite_refs, 1);
        assert_eq!(report.summary.legacy_app_data_import_refs, 1);
        assert_eq!(report.cache.file_count, 6);
        assert_eq!(report.cache.orphan_file_count, 4);
        assert_eq!(report.cache.duplicate_file_name_groups, 2);
        assert_eq!(report.cache.oversized_file_count, 1);
        assert!(report
            .cache
            .orphan_samples
            .iter()
            .any(|item| item.path.ends_with("orphan.webp")));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn quarantine_orphan_images_moves_only_unreferenced_files() {
        let root = std::env::temp_dir().join(format!("mikavn-image-quarantine-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::create_dir_all(paths.images()).unwrap();
        let referenced = paths.images().join("cover.jpg");
        let orphan = paths.images().join("stale/orphan.jpg");
        fs::create_dir_all(orphan.parent().unwrap()).unwrap();
        fs::write(&referenced, b"cover").unwrap();
        fs::write(&orphan, b"orphan").unwrap();
        create_health_db(&paths.database(), &referenced.to_string_lossy(), "", "");

        let report =
            quarantine_orphan_images_with_paths(&paths, ImageHealthReportOptions::default())
                .unwrap();

        assert_eq!(report.moved_files, 1);
        assert_eq!(report.skipped_files, 0);
        assert!(referenced.is_file());
        assert!(!orphan.exists());
        assert!(Path::new(&report.manifest_path).is_file());
        assert!(report.quarantine_dir.contains("image-quarantine"));
        let manifest = fs::read_to_string(&report.manifest_path).unwrap();
        assert!(manifest.contains("stale"));
        assert!(manifest.contains("orphan.jpg"));

        let _ = fs::remove_dir_all(root);
    }

    fn create_health_db(path: &std::path::Path, cover: &str, legacy: &str, missing: &str) {
        let conn = Connection::open(path).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              description TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              asset_type TEXT NOT NULL,
              uri TEXT NOT NULL,
              source TEXT,
              is_primary INTEGER NOT NULL DEFAULT 0
            );
            "#,
        )
        .unwrap();
        conn.execute(
            "INSERT INTO games (id, title, cover_image, banner_image, background_image, description) VALUES ('g1', 'VN', ?1, ?2, ?3, '')",
            (cover, legacy, missing),
        )
        .unwrap();
    }
}
