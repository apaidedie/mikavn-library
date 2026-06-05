use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;
use tauri::AppHandle;
use uuid::Uuid;

use crate::db::models::{
    AssetCacheCleanupResult, AssetDownloadInput, AssetImportInput, AssetInput, Game, GameAsset,
    GameFilter, TagRecord,
};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::paths::AppPaths;
use crate::services::images;

pub fn list_game_assets(db: &Database, game_id: String) -> DbResult<Vec<GameAsset>> {
    db.list_game_assets(game_id)
}

pub fn upsert_game_asset(db: &Database, game_id: String, input: AssetInput) -> DbResult<GameAsset> {
    db.upsert_game_asset(game_id, input)
}

pub fn remove_game_asset(db: &Database, id: String) -> DbResult<Game> {
    db.remove_game_asset(id)
}

pub fn set_primary_asset(db: &Database, id: String) -> DbResult<Game> {
    db.set_primary_asset(id)
}

pub fn import_game_asset_from_path(
    app: &AppHandle,
    db: &Database,
    game_id: String,
    input: AssetImportInput,
) -> DbResult<GameAsset> {
    let paths = AppPaths::from_app(app)?;
    let source = PathBuf::from(input.source_path.trim());
    if !source.is_file() {
        return Err(DbError::path_not_found("asset source file does not exist"));
    }
    let extension = supported_image_extension(&source)?;
    let target = paths
        .images()
        .join(format!("manual-{}.{extension}", Uuid::new_v4()));
    fs::copy(&source, &target)?;
    db.upsert_game_asset(
        game_id,
        AssetInput {
            asset_type: input.asset_type,
            uri: target.to_string_lossy().to_string(),
            source: Some("user".to_string()),
            is_primary: input.is_primary,
        },
    )
}

pub fn download_game_asset(
    app: &AppHandle,
    db: &Database,
    game_id: String,
    input: AssetDownloadInput,
) -> DbResult<GameAsset> {
    let paths = AppPaths::from_app(app)?;
    let cached = images::cache_cover_image(paths.root(), "manual", &game_id, &input.url)?;
    db.upsert_game_asset(
        game_id,
        AssetInput {
            asset_type: input.asset_type,
            uri: cached,
            source: Some("download".to_string()),
            is_primary: input.is_primary,
        },
    )
}

pub fn cleanup_asset_cache(app: &AppHandle, db: &Database) -> DbResult<AssetCacheCleanupResult> {
    let paths = AppPaths::from_app(app)?;
    cleanup_asset_cache_with_paths(&paths, db, false)
}

pub fn preview_asset_cache_cleanup(
    app: &AppHandle,
    db: &Database,
) -> DbResult<AssetCacheCleanupResult> {
    let paths = AppPaths::from_app(app)?;
    cleanup_asset_cache_with_paths(&paths, db, true)
}

fn cleanup_asset_cache_with_paths(
    paths: &AppPaths,
    db: &Database,
    dry_run: bool,
) -> DbResult<AssetCacheCleanupResult> {
    let mut referenced = HashSet::new();
    for game in db.list_games(GameFilter::default())? {
        add_optional_image_reference(paths, &mut referenced, game.cover_image.as_deref());
        add_optional_image_reference(paths, &mut referenced, game.banner_image.as_deref());
        add_optional_image_reference(paths, &mut referenced, game.background_image.as_deref());
        if let Some(description) = game.description.as_deref() {
            for source in description_image_sources(description) {
                add_image_reference(paths, &mut referenced, &source);
            }
        }
        for asset in db.list_game_assets(game.id.clone())? {
            add_image_reference(paths, &mut referenced, &asset.uri);
        }
    }

    let mut result = AssetCacheCleanupResult {
        scanned_files: 0,
        removed_files: 0,
        kept_files: 0,
        removed_bytes: 0,
        kept_bytes: 0,
    };
    cleanup_dir(&paths.images(), &referenced, &mut result, dry_run)?;
    Ok(result)
}

pub fn list_tags(db: &Database, kind: Option<String>) -> DbResult<Vec<TagRecord>> {
    db.list_tags(kind)
}

pub fn rename_tag(db: &Database, id: String, name: String) -> DbResult<TagRecord> {
    db.rename_tag(id, name)
}

pub fn merge_tags(
    db: &Database,
    source_ids: Vec<String>,
    target_id: String,
) -> DbResult<TagRecord> {
    db.merge_tags(source_ids, target_id)
}

pub fn delete_tag(db: &Database, id: String) -> DbResult<()> {
    db.delete_tag(id)
}

fn supported_image_extension(path: &Path) -> DbResult<String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "jpg" | "jpeg" => Ok("jpg".to_string()),
        "png" | "webp" | "gif" => Ok(extension),
        _ => Err(DbError::asset_download_failed(
            "unsupported image file type",
        )),
    }
}

fn cleanup_dir(
    path: &Path,
    referenced: &HashSet<String>,
    result: &mut AssetCacheCleanupResult,
    dry_run: bool,
) -> DbResult<()> {
    if !path.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            cleanup_dir(&path, referenced, result, dry_run)?;
        } else if path.is_file() {
            let bytes = entry.metadata()?.len();
            result.scanned_files += 1;
            if referenced.contains(&normalize_path_key(&path.to_string_lossy())) {
                result.kept_files += 1;
                result.kept_bytes += bytes;
            } else {
                if !dry_run {
                    fs::remove_file(path)?;
                }
                result.removed_files += 1;
                result.removed_bytes += bytes;
            }
        }
    }
    Ok(())
}

fn add_optional_image_reference(
    paths: &AppPaths,
    referenced: &mut HashSet<String>,
    value: Option<&str>,
) {
    if let Some(value) = value {
        add_image_reference(paths, referenced, value);
    }
}

fn add_image_reference(paths: &AppPaths, referenced: &mut HashSet<String>, value: &str) {
    let clean = value.trim().trim_matches(['\'', '"']);
    if clean.is_empty() || images::is_remote_url(clean) || clean.starts_with("data:") {
        return;
    }
    let path = PathBuf::from(clean);
    if path.is_absolute() {
        referenced.insert(normalize_path_key(clean));
        return;
    }
    referenced.insert(normalize_path_key(clean));
    referenced.insert(normalize_path_key(
        &paths.root().join(clean).to_string_lossy(),
    ));
    referenced.insert(normalize_path_key(
        &paths.images().join(clean).to_string_lossy(),
    ));
    let lower = clean.replace('/', "\\").to_lowercase();
    if let Some(rest) = lower.strip_prefix("images\\") {
        referenced.insert(normalize_path_key(
            &paths.images().join(rest).to_string_lossy(),
        ));
    }
}

fn description_image_sources(value: &str) -> Vec<String> {
    static IMAGE_RE: OnceLock<Regex> = OnceLock::new();
    let re = IMAGE_RE.get_or_init(|| {
        Regex::new(r#"(?is)!\[[^\]]*\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[/img\]|https?://[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?"#)
            .expect("valid asset cache image regex")
    });
    re.captures_iter(value)
        .filter_map(|captures| {
            if let Some(source) = captures.get(1) {
                return clean_description_image_source(source.as_str(), false);
            }
            let token = captures.get(0)?.as_str();
            if token.trim_start().to_lowercase().starts_with("<img") {
                return read_img_src(token)
                    .and_then(|source| clean_description_image_source(&source, false));
            }
            if let Some(source) = captures.get(2) {
                return clean_description_image_source(source.as_str(), false);
            }
            clean_description_image_source(token, true)
        })
        .collect()
}

fn read_img_src(tag: &str) -> Option<String> {
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
            .map(|value| decode_description_html(value.as_str().trim()))
    })
}

fn clean_description_image_source(value: &str, trim_trailing_punctuation: bool) -> Option<String> {
    let mut clean = decode_description_html(value)
        .trim()
        .trim_matches(['\'', '"'])
        .to_string();
    if trim_trailing_punctuation {
        clean = clean
            .trim_end_matches([')', ',', '，', '。', '.', ';', '；'])
            .to_string();
    }
    if clean.starts_with("//") {
        clean = format!("https:{clean}");
    }
    if clean.is_empty() {
        None
    } else {
        Some(clean)
    }
}

fn decode_description_html(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn normalize_path_key(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::AddGameInput;

    #[test]
    fn rejects_unsupported_import_extension() {
        let path = PathBuf::from("cover.txt");
        let error = supported_image_extension(&path).unwrap_err();
        assert_eq!(error.code, "ASSET_DOWNLOAD_FAILED");
    }

    #[test]
    fn cleanup_removes_unreferenced_files_but_keeps_referenced_files() {
        let root = std::env::temp_dir().join(format!("mikavn-asset-cleanup-{}", Uuid::new_v4()));
        fs::create_dir_all(root.join("nested")).unwrap();
        let kept = root.join("keep.png");
        let removed = root.join("nested").join("remove.png");
        fs::write(&kept, "keep").unwrap();
        fs::write(&removed, "remove").unwrap();

        let mut referenced = HashSet::new();
        referenced.insert(normalize_path_key(&kept.to_string_lossy()));
        let mut result = AssetCacheCleanupResult {
            scanned_files: 0,
            removed_files: 0,
            kept_files: 0,
            removed_bytes: 0,
            kept_bytes: 0,
        };
        cleanup_dir(&root, &referenced, &mut result, false).unwrap();

        assert!(kept.exists());
        assert!(!removed.exists());
        assert_eq!(result.scanned_files, 2);
        assert_eq!(result.kept_files, 1);
        assert_eq!(result.removed_files, 1);
        assert_eq!(result.kept_bytes, 4);
        assert_eq!(result.removed_bytes, 6);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_preview_counts_unreferenced_files_without_deleting() {
        let root =
            std::env::temp_dir().join(format!("mikavn-asset-cleanup-preview-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let removed = root.join("remove.png");
        fs::write(&removed, "remove").unwrap();

        let referenced = HashSet::new();
        let mut result = AssetCacheCleanupResult {
            scanned_files: 0,
            removed_files: 0,
            kept_files: 0,
            removed_bytes: 0,
            kept_bytes: 0,
        };
        cleanup_dir(&root, &referenced, &mut result, true).unwrap();

        assert!(removed.exists());
        assert_eq!(result.scanned_files, 1);
        assert_eq!(result.kept_files, 0);
        assert_eq!(result.removed_files, 1);
        assert_eq!(result.removed_bytes, 6);
        assert_eq!(result.kept_bytes, 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_asset_cache_uses_database_asset_references() {
        let root =
            std::env::temp_dir().join(format!("mikavn-asset-cache-entry-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.join("app-data")).unwrap();
        fs::create_dir_all(paths.images().join("nested")).unwrap();
        let kept = paths.images().join("keep.png");
        let removed = paths.images().join("nested").join("remove.png");
        fs::write(&kept, "keep").unwrap();
        fs::write(&removed, "remove").unwrap();

        let db = Database::new_from_path(paths.database()).unwrap();
        let game = db
            .add_game(AddGameInput {
                title: "Asset Cleanup VN".to_string(),
                install_path: root.join("game").to_string_lossy().to_string(),
                original_title: None,
                aliases: None,
                developer: None,
                publisher: None,
                brand: None,
                release_date: None,
                description: None,
                notes: None,
                tags: None,
                genres: None,
                rating: None,
                age_rating: None,
                play_status: None,
                favorite: None,
                hidden: None,
                executable_path: None,
                working_directory: None,
                launch_args: None,
                cover_image: None,
                banner_image: None,
                background_image: None,
                vndb_id: None,
                bangumi_id: None,
                dlsite_id: None,
                fanza_id: None,
                ymgal_id: None,
            })
            .unwrap();
        db.upsert_game_asset(
            game.id,
            AssetInput {
                asset_type: "cover".to_string(),
                uri: kept.to_string_lossy().to_string(),
                source: Some("user".to_string()),
                is_primary: Some(true),
            },
        )
        .unwrap();

        let result = cleanup_asset_cache_with_paths(&paths, &db, false).unwrap();

        assert!(kept.exists());
        assert!(!removed.exists());
        assert_eq!(result.scanned_files, 2);
        assert_eq!(result.kept_files, 1);
        assert_eq!(result.removed_files, 1);
        assert_eq!(result.kept_bytes, 4);
        assert_eq!(result.removed_bytes, 6);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_asset_cache_keeps_game_field_and_description_image_references() {
        let root =
            std::env::temp_dir().join(format!("mikavn-asset-cache-fields-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.join("app-data")).unwrap();
        fs::create_dir_all(paths.images().join("nested")).unwrap();
        let cover = paths.images().join("cover.webp");
        let markdown = paths.images().join("markdown.png");
        let relative = paths.images().join("relative.jpg");
        let html = paths.images().join("nested").join("html.webp");
        let bbcode = paths.images().join("bbcode.gif");
        let removed = paths.images().join("remove.png");
        fs::write(&cover, "cover").unwrap();
        fs::write(&markdown, "markdown").unwrap();
        fs::write(&relative, "relative").unwrap();
        fs::write(&html, "html").unwrap();
        fs::write(&bbcode, "bbcode").unwrap();
        fs::write(&removed, "remove").unwrap();

        let db = Database::new_from_path(paths.database()).unwrap();
        db.add_game(AddGameInput {
            title: "Referenced Images VN".to_string(),
            install_path: root.join("game").to_string_lossy().to_string(),
            original_title: None,
            aliases: None,
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: Some(format!(
                "![shot]({})\n<img data-src=\"images/nested/html.webp\">\n[img]bbcode.gif[/img]\n![relative](relative.jpg)",
                markdown.to_string_lossy()
            )),
            notes: None,
            tags: None,
            genres: None,
            rating: None,
            age_rating: None,
            play_status: None,
            favorite: None,
            hidden: None,
            executable_path: None,
            working_directory: None,
            launch_args: None,
            cover_image: Some(cover.to_string_lossy().to_string()),
            banner_image: None,
            background_image: None,
            vndb_id: None,
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
        })
        .unwrap();

        let result = cleanup_asset_cache_with_paths(&paths, &db, false).unwrap();

        assert!(cover.exists());
        assert!(markdown.exists());
        assert!(relative.exists());
        assert!(html.exists());
        assert!(bbcode.exists());
        assert!(!removed.exists());
        assert_eq!(result.scanned_files, 6);
        assert_eq!(result.kept_files, 5);
        assert_eq!(result.removed_files, 1);
        let _ = fs::remove_dir_all(root);
    }
}
