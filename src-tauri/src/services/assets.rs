use std::fs;
use std::path::{Path, PathBuf};

use tauri::AppHandle;
use uuid::Uuid;

use crate::db::models::{
    AssetDownloadInput, AssetImportInput, AssetInput, Game, GameAsset, TagRecord,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_import_extension() {
        let path = PathBuf::from("cover.txt");
        let error = supported_image_extension(&path).unwrap_err();
        assert_eq!(error.code, "ASSET_DOWNLOAD_FAILED");
    }
}
