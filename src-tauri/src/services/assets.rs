use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

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
    cleanup_asset_cache_with_paths(&paths, db)
}

fn cleanup_asset_cache_with_paths(
    paths: &AppPaths,
    db: &Database,
) -> DbResult<AssetCacheCleanupResult> {
    let mut referenced = HashSet::new();
    for game in db.list_games(GameFilter::default())? {
        for asset in db.list_game_assets(game.id)? {
            referenced.insert(normalize_path_key(&asset.uri));
        }
    }

    let mut result = AssetCacheCleanupResult {
        scanned_files: 0,
        removed_files: 0,
        kept_files: 0,
    };
    cleanup_dir(&paths.images(), &referenced, &mut result)?;
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
) -> DbResult<()> {
    if !path.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            cleanup_dir(&path, referenced, result)?;
        } else if path.is_file() {
            result.scanned_files += 1;
            if referenced.contains(&normalize_path_key(&path.to_string_lossy())) {
                result.kept_files += 1;
            } else {
                fs::remove_file(path)?;
                result.removed_files += 1;
            }
        }
    }
    Ok(())
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
        };
        cleanup_dir(&root, &referenced, &mut result).unwrap();

        assert!(kept.exists());
        assert!(!removed.exists());
        assert_eq!(result.scanned_files, 2);
        assert_eq!(result.kept_files, 1);
        assert_eq!(result.removed_files, 1);
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

        let result = cleanup_asset_cache_with_paths(&paths, &db).unwrap();

        assert!(kept.exists());
        assert!(!removed.exists());
        assert_eq!(result.scanned_files, 2);
        assert_eq!(result.kept_files, 1);
        assert_eq!(result.removed_files, 1);
        let _ = fs::remove_dir_all(root);
    }
}
