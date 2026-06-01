use std::fs::{self, File};
use std::io::{self, Read, Seek, Write};
use std::path::{Path, PathBuf};
use std::thread;

use chrono::Utc;
use rusqlite::{Connection, OpenFlags, Row};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::db::models::{Game, GameFilter, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::games as game_service;
use crate::services::tasks;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryArchiveExportOptions {
    pub target_dir: String,
    pub include_images: Option<bool>,
    pub include_save_backups: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryArchiveImportOptions {
    pub archive_dir: String,
    pub include_images: Option<bool>,
    pub include_save_backups: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryArchiveManifest {
    pub app: String,
    pub archive_version: i64,
    pub exported_at: String,
    pub database_file: String,
    pub include_images: bool,
    pub include_save_backups: bool,
    pub images_count: i64,
    pub save_backups_count: i64,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryArchivePreview {
    pub archive_dir: String,
    pub manifest: LibraryArchiveManifest,
    pub database_present: bool,
    pub images_count: i64,
    pub save_backups_count: i64,
    pub warnings: Vec<String>,
}

pub(crate) fn enqueue_library_archive_export_task(
    app: AppHandle,
    db: &Database,
    options: LibraryArchiveExportOptions,
) -> DbResult<TaskRecord> {
    let target_parent = archive_parent(&options.target_dir)?;
    let include_images = options.include_images.unwrap_or(true);
    let include_save_backups = options.include_save_backups.unwrap_or(false);
    let payload = serde_json::to_string(&LibraryArchiveExportOptions {
        target_dir: target_parent.to_string_lossy().to_string(),
        include_images: Some(include_images),
        include_save_backups: Some(include_save_backups),
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "library.archive_export",
        Some("正在导出库归档".to_string()),
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

        let result = (|| -> DbResult<PathBuf> {
            let archive_dir = archive_dir(&target_parent);
            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.08,
                Some("正在创建归档目录".to_string()),
                None,
            )?;
            fs::create_dir_all(&archive_dir)?;

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.28,
                Some("正在创建数据库一致性备份".to_string()),
                None,
            )?;
            db.backup_to_path(&archive_dir.join("mikavn.db"))?;

            let mut images_count = 0;
            if include_images {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.52,
                    Some("正在复制封面缓存".to_string()),
                    None,
                )?;
                images_count = copy_dir_recursive(&paths.images(), &archive_dir.join("images"))?;
            }

            let mut save_backups_count = 0;
            if include_save_backups {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.74,
                    Some("正在复制存档备份".to_string()),
                    None,
                )?;
                save_backups_count =
                    copy_dir_recursive(&paths.save_backups(), &archive_dir.join("save-backups"))?;
            }

            let manifest = LibraryArchiveManifest {
                app: "MikaVN Library".to_string(),
                archive_version: 1,
                exported_at: Utc::now().to_rfc3339(),
                database_file: "mikavn.db".to_string(),
                include_images,
                include_save_backups,
                images_count,
                save_backups_count,
                notes: vec![
                    "This archive contains MikaVN database records and optional local cache copies only.".to_string(),
                    "It never contains or deletes real game installation directories.".to_string(),
                ],
            };
            fs::write(
                archive_dir.join("manifest.json"),
                serde_json::to_string_pretty(&manifest)?,
            )?;
            Ok(archive_dir)
        })();

        match result {
            Ok(archive_dir) => {
                logger::log_info(
                    &paths,
                    "library.archive_export",
                    format!("archive exported to {}", logger::display_path(&archive_dir)),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "库归档已导出到 {}",
                        logger::display_path(&archive_dir)
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "library.archive_export", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("库归档导出失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub(crate) fn enqueue_library_archive_export_zip_task(
    app: AppHandle,
    db: &Database,
    options: LibraryArchiveExportOptions,
) -> DbResult<TaskRecord> {
    let target_parent = archive_parent(&options.target_dir)?;
    let include_images = options.include_images.unwrap_or(true);
    let include_save_backups = options.include_save_backups.unwrap_or(false);
    let payload = serde_json::to_string(&LibraryArchiveExportOptions {
        target_dir: target_parent.to_string_lossy().to_string(),
        include_images: Some(include_images),
        include_save_backups: Some(include_save_backups),
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "library.archive_export_zip",
        Some("正在导出 ZIP 库归档".to_string()),
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

        let result = (|| -> DbResult<PathBuf> {
            let staging_dir = paths
                .cache()
                .join("archive-export-staging")
                .join(Uuid::new_v4().to_string());
            let archive_path = archive_zip_path(&target_parent);
            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.06,
                Some("正在创建临时归档目录".to_string()),
                None,
            )?;
            fs::create_dir_all(&staging_dir)?;

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.22,
                Some("正在创建数据库一致性备份".to_string()),
                None,
            )?;
            db.backup_to_path(&staging_dir.join("mikavn.db"))?;

            let mut images_count = 0;
            if include_images {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.44,
                    Some("正在复制封面缓存".to_string()),
                    None,
                )?;
                images_count = copy_dir_recursive(&paths.images(), &staging_dir.join("images"))?;
            }

            let mut save_backups_count = 0;
            if include_save_backups {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.62,
                    Some("正在复制存档备份".to_string()),
                    None,
                )?;
                save_backups_count =
                    copy_dir_recursive(&paths.save_backups(), &staging_dir.join("save-backups"))?;
            }

            let manifest = LibraryArchiveManifest {
                app: "MikaVN Library".to_string(),
                archive_version: 1,
                exported_at: Utc::now().to_rfc3339(),
                database_file: "mikavn.db".to_string(),
                include_images,
                include_save_backups,
                images_count,
                save_backups_count,
                notes: vec![
                    "This ZIP archive contains MikaVN database records and optional local cache copies only.".to_string(),
                    "It never contains or deletes real game installation directories.".to_string(),
                ],
            };
            fs::write(
                staging_dir.join("manifest.json"),
                serde_json::to_string_pretty(&manifest)?,
            )?;

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.84,
                Some("正在写入 ZIP 文件".to_string()),
                None,
            )?;
            zip_dir(&staging_dir, &archive_path)?;
            let _ = fs::remove_dir_all(&staging_dir);
            Ok(archive_path)
        })();

        match result {
            Ok(archive_path) => {
                logger::log_info(
                    &paths,
                    "library.archive_export_zip",
                    format!(
                        "zip archive exported to {}",
                        logger::display_path(&archive_path)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "ZIP 库归档已导出到 {}",
                        logger::display_path(&archive_path)
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "library.archive_export_zip", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("ZIP 库归档导出失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub(crate) fn preview_library_archive(path: String) -> DbResult<LibraryArchivePreview> {
    let source = archive_existing_source(&path)?;
    preview_archive_source(&source)
}

pub(crate) fn enqueue_library_archive_import_task(
    app: AppHandle,
    db: &Database,
    options: LibraryArchiveImportOptions,
) -> DbResult<TaskRecord> {
    let source = archive_existing_source(&options.archive_dir)?;
    let preview = preview_archive_source(&source)?;
    if !preview.database_present {
        return Err(DbError::validation("archive database is missing"));
    }
    let include_images = options
        .include_images
        .unwrap_or(preview.manifest.include_images);
    let include_save_backups = options.include_save_backups.unwrap_or(false);
    let payload = serde_json::to_string(&LibraryArchiveImportOptions {
        archive_dir: preview.archive_dir.clone(),
        include_images: Some(include_images),
        include_save_backups: Some(include_save_backups),
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "library.archive_import",
        Some("正在导入库归档".to_string()),
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

        let result = (|| -> DbResult<ImportSummary> {
            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.08,
                Some("正在备份当前数据库".to_string()),
                None,
            )?;
            let restore_backup_dir = paths.archive_import_protection();
            fs::create_dir_all(&restore_backup_dir)?;
            let protection_path = restore_backup_dir.join(format!(
                "before-import-{}.db",
                Utc::now().format("%Y%m%d-%H%M%S")
            ));
            db.backup_to_path(&protection_path)?;

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.22,
                Some("正在读取归档数据库".to_string()),
                None,
            )?;
            let (archive_dir, cleanup_dir) = materialize_archive_source(&source, &paths)?;
            let preview = preview_archive_dir(&archive_dir)?;
            let archive_games =
                read_archive_games(&archive_dir.join(&preview.manifest.database_file))?;
            let current_games = db.list_games(GameFilter::default())?;
            let total = archive_games.len().max(1) as f64;
            let mut summary = ImportSummary {
                imported: 0,
                skipped: 0,
                images: 0,
                save_backups: 0,
                protection_path,
            };

            for (index, game) in archive_games.into_iter().enumerate() {
                if has_game_conflict(&current_games, &game)
                    || has_game_conflict(&db.list_games(GameFilter::default())?, &game)
                {
                    summary.skipped += 1;
                    let _ = db.append_task_log(
                        &task_id,
                        "warn",
                        &format!("跳过冲突条目：{}", game.title),
                    );
                } else {
                    game_service::insert_imported_game(&db, game)?;
                    summary.imported += 1;
                }
                let progress = 0.24 + ((index + 1) as f64 / total) * 0.46;
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    progress,
                    Some(format!(
                        "已导入 {} 个，跳过 {} 个",
                        summary.imported, summary.skipped
                    )),
                    None,
                )?;
            }

            if include_images {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.78,
                    Some("正在复制图片缓存".to_string()),
                    None,
                )?;
                summary.images = copy_dir_recursive(&archive_dir.join("images"), &paths.images())?;
            }
            if include_save_backups {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.9,
                    Some("正在复制存档备份缓存".to_string()),
                    None,
                )?;
                summary.save_backups =
                    copy_dir_recursive(&archive_dir.join("save-backups"), &paths.save_backups())?;
            }
            if let Some(cleanup_dir) = cleanup_dir {
                let _ = fs::remove_dir_all(cleanup_dir);
            }
            Ok(summary)
        })();

        match result {
            Ok(summary) => {
                logger::log_info(
                    &paths,
                    "library.archive_import",
                    format!(
                        "archive import completed: imported {}, skipped {}, protection {}",
                        summary.imported,
                        summary.skipped,
                        logger::display_path(&summary.protection_path)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "归档导入完成：导入 {} 个，跳过 {} 个。保护备份：{}",
                        summary.imported,
                        summary.skipped,
                        logger::display_path(&summary.protection_path)
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "library.archive_import", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("库归档导入失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

struct ImportSummary {
    imported: i64,
    skipped: i64,
    images: i64,
    save_backups: i64,
    protection_path: PathBuf,
}

#[derive(Debug, Clone)]
enum LibraryArchiveSource {
    Directory(PathBuf),
    Zip(PathBuf),
}

fn preview_archive_source(source: &LibraryArchiveSource) -> DbResult<LibraryArchivePreview> {
    match source {
        LibraryArchiveSource::Directory(path) => preview_archive_dir(path),
        LibraryArchiveSource::Zip(path) => preview_archive_zip(path),
    }
}

fn materialize_archive_source(
    source: &LibraryArchiveSource,
    paths: &AppPaths,
) -> DbResult<(PathBuf, Option<PathBuf>)> {
    match source {
        LibraryArchiveSource::Directory(path) => Ok((path.clone(), None)),
        LibraryArchiveSource::Zip(path) => {
            let target = paths
                .cache()
                .join("archive-import-staging")
                .join(Uuid::new_v4().to_string());
            fs::create_dir_all(&target)?;
            extract_archive_zip(path, &target)?;
            Ok((target.clone(), Some(target)))
        }
    }
}

fn preview_archive_dir(archive_dir: &Path) -> DbResult<LibraryArchivePreview> {
    let manifest_path = archive_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err(DbError::validation("archive manifest.json was not found"));
    }

    let manifest: LibraryArchiveManifest =
        serde_json::from_str(&fs::read_to_string(&manifest_path)?)?;
    let database_present = archive_dir.join(&manifest.database_file).is_file();
    let images_count = count_files(&archive_dir.join("images"))?;
    let save_backups_count = count_files(&archive_dir.join("save-backups"))?;
    let mut warnings = Vec::new();
    if manifest.app != "MikaVN Library" {
        warnings.push("归档来源不是 MikaVN Library。".to_string());
    }
    if manifest.archive_version != 1 {
        warnings.push(format!(
            "归档版本 {} 可能不兼容当前导入预览。",
            manifest.archive_version
        ));
    }
    if !database_present {
        warnings.push("归档内缺少 mikavn.db，不能用于数据库恢复。".to_string());
    }

    Ok(LibraryArchivePreview {
        archive_dir: archive_dir.to_string_lossy().to_string(),
        manifest,
        database_present,
        images_count,
        save_backups_count,
        warnings,
    })
}

fn preview_archive_zip(path: &Path) -> DbResult<LibraryArchivePreview> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;
    let mut manifest_json = None;
    let mut names = Vec::new();

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.is_dir() {
            continue;
        }
        let name = normalize_zip_entry_name(entry.name());
        if name == "manifest.json" {
            let mut content = String::new();
            entry.read_to_string(&mut content)?;
            manifest_json = Some(content);
        }
        names.push(name);
    }

    let manifest_json =
        manifest_json.ok_or_else(|| DbError::validation("archive manifest.json was not found"))?;
    let manifest: LibraryArchiveManifest = serde_json::from_str(&manifest_json)?;
    let database_present = names.iter().any(|name| name == &manifest.database_file);
    let images_count = names
        .iter()
        .filter(|name| name.starts_with("images/"))
        .count() as i64;
    let save_backups_count = names
        .iter()
        .filter(|name| name.starts_with("save-backups/"))
        .count() as i64;
    let mut warnings = Vec::new();
    if manifest.app != "MikaVN Library" {
        warnings.push("归档来源不是 MikaVN Library。".to_string());
    }
    if manifest.archive_version != 1 {
        warnings.push(format!(
            "归档版本 {} 可能不兼容当前导入预览。",
            manifest.archive_version
        ));
    }
    if !database_present {
        warnings.push("归档内缺少 mikavn.db，不能用于数据库恢复。".to_string());
    }

    Ok(LibraryArchivePreview {
        archive_dir: path.to_string_lossy().to_string(),
        manifest,
        database_present,
        images_count,
        save_backups_count,
        warnings,
    })
}

fn read_archive_games(db_path: &Path) -> DbResult<Vec<Game>> {
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let mut stmt = conn.prepare("SELECT * FROM games")?;
    let rows = stmt.query_map([], game_from_archive_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn has_game_conflict(existing: &[Game], incoming: &Game) -> bool {
    existing.iter().any(|game| {
        game.id == incoming.id
            || normalize_title(&game.title) == normalize_title(&incoming.title)
            || normalize_path(&game.install_path) == normalize_path(&incoming.install_path)
    })
}

fn normalize_title(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace([' ', '　', '-', '_'], "")
}

fn normalize_path(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
        .to_lowercase()
}

fn game_from_archive_row(row: &Row<'_>) -> rusqlite::Result<Game> {
    let aliases: String = row.get("aliases")?;
    let tags: String = row.get("tags")?;
    let genres: String = row.get("genres")?;
    Ok(Game {
        id: row.get("id")?,
        title: row.get("title")?,
        original_title: row.get("original_title")?,
        aliases: serde_json::from_str(&aliases).unwrap_or_default(),
        developer: row.get("developer")?,
        publisher: row.get("publisher")?,
        brand: row.get("brand")?,
        release_date: row.get("release_date")?,
        description: row.get("description")?,
        notes: row.get("notes").unwrap_or(None),
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        genres: serde_json::from_str(&genres).unwrap_or_default(),
        rating: row.get("rating")?,
        age_rating: row.get("age_rating")?,
        play_status: row.get("play_status")?,
        favorite: row.get::<_, i64>("favorite")? != 0,
        hidden: row.get::<_, i64>("hidden")? != 0,
        install_path: row.get("install_path")?,
        executable_path: row.get("executable_path")?,
        working_directory: row.get("working_directory")?,
        launch_args: row.get("launch_args")?,
        path_status: row.get("path_status")?,
        last_path_checked_at: row.get("last_path_checked_at")?,
        cover_image: row.get("cover_image")?,
        banner_image: row.get("banner_image")?,
        background_image: row.get("background_image")?,
        vndb_id: row.get("vndb_id")?,
        bangumi_id: row.get("bangumi_id")?,
        dlsite_id: row.get("dlsite_id")?,
        fanza_id: row.get("fanza_id")?,
        ymgal_id: row.get("ymgal_id")?,
        total_play_seconds: row.get("total_play_seconds")?,
        last_played_at: row.get("last_played_at")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn archive_parent(path: &str) -> DbResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(DbError::validation("archive target directory is required"));
    }
    let parent = PathBuf::from(trimmed);
    if parent.exists() && !parent.is_dir() {
        return Err(DbError::path_not_found(
            "archive target must be a directory",
        ));
    }
    fs::create_dir_all(&parent)?;
    Ok(parent)
}

fn archive_existing_source(path: &str) -> DbResult<LibraryArchiveSource> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(DbError::validation("archive path is required"));
    }
    let path = PathBuf::from(trimmed);
    if path.is_dir() {
        return Ok(LibraryArchiveSource::Directory(path));
    }
    if path.is_file()
        && path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"))
    {
        return Ok(LibraryArchiveSource::Zip(path));
    }
    Err(DbError::path_not_found(
        "archive path must be an existing directory or .zip file",
    ))
}

fn archive_dir(parent: &Path) -> PathBuf {
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let suffix = Uuid::new_v4().to_string();
    parent.join(format!(
        "mikavn-library-archive-{timestamp}-{}",
        &suffix[..8]
    ))
}

fn archive_zip_path(parent: &Path) -> PathBuf {
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let suffix = Uuid::new_v4().to_string();
    parent.join(format!(
        "mikavn-library-archive-{timestamp}-{}.zip",
        &suffix[..8]
    ))
}

fn copy_dir_recursive(source: &Path, target: &Path) -> DbResult<i64> {
    if !source.exists() {
        return Ok(0);
    }
    if !source.is_dir() {
        return Err(DbError::path_not_found(
            "archive source must be a directory",
        ));
    }
    fs::create_dir_all(target)?;
    let mut count = 0;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            count += copy_dir_recursive(&source_path, &target_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_path, &target_path)?;
            count += 1;
        }
    }
    Ok(count)
}

fn count_files(path: &Path) -> DbResult<i64> {
    if !path.exists() {
        return Ok(0);
    }
    if !path.is_dir() {
        return Ok(0);
    }
    let mut count = 0;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            count += count_files(&entry.path())?;
        } else if file_type.is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn zip_dir(source: &Path, target: &Path) -> DbResult<i64> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = File::create(target)?;
    let mut writer = ZipWriter::new(file);
    let count = zip_dir_recursive(&mut writer, source, source)?;
    writer.finish()?;
    Ok(count)
}

fn zip_dir_recursive<W: Write + Seek>(
    writer: &mut ZipWriter<W>,
    base: &Path,
    current: &Path,
) -> DbResult<i64> {
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    let mut count = 0;
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let relative = path.strip_prefix(base).map_err(|error| {
            DbError::new(
                "ARCHIVE_ERROR",
                format!("failed to build archive path: {error}"),
            )
        })?;
        let name = zip_path_name(relative)?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            writer.add_directory(format!("{name}/"), options)?;
            count += zip_dir_recursive(writer, base, &path)?;
        } else if file_type.is_file() {
            writer.start_file(name, options)?;
            let mut file = File::open(&path)?;
            io::copy(&mut file, writer)?;
            count += 1;
        }
    }
    Ok(count)
}

fn extract_archive_zip(source: &Path, target: &Path) -> DbResult<()> {
    let file = File::open(source)?;
    let mut archive = ZipArchive::new(file)?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| DbError::validation("archive contains an unsafe path"))?
            .to_path_buf();
        if enclosed.as_os_str().is_empty() {
            continue;
        }
        let output_path = target.join(enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&output_path)?;
        } else {
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let mut output = File::create(&output_path)?;
            io::copy(&mut entry, &mut output)?;
        }
    }
    Ok(())
}

fn zip_path_name(path: &Path) -> DbResult<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        let value = component.as_os_str().to_string_lossy();
        if value.is_empty() || value == "." {
            continue;
        }
        parts.push(value.replace('\\', "/"));
    }
    let name = parts.join("/");
    if name.is_empty() || name.starts_with('/') || name.contains("..") {
        return Err(DbError::new(
            "ARCHIVE_ERROR",
            "failed to build safe archive path",
        ));
    }
    Ok(name)
}

fn normalize_zip_entry_name(name: &str) -> String {
    name.trim_start_matches('/').replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_dir_recursive_counts_files() {
        let root =
            std::env::temp_dir().join(format!("mikavn-archive-copy-test-{}", Uuid::new_v4()));
        let source = root.join("source");
        let target = root.join("target");
        fs::create_dir_all(source.join("nested")).unwrap();
        fs::write(source.join("a.txt"), "a").unwrap();
        fs::write(source.join("nested").join("b.txt"), "b").unwrap();

        let count = copy_dir_recursive(&source, &target).unwrap();

        assert_eq!(count, 2);
        assert!(target.join("a.txt").is_file());
        assert!(target.join("nested").join("b.txt").is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn count_files_ignores_missing_directory() {
        let missing = std::env::temp_dir().join(format!("mikavn-missing-{}", Uuid::new_v4()));
        assert_eq!(count_files(&missing).unwrap(), 0);
    }

    #[test]
    fn zip_archive_preview_and_extract_are_safe() {
        let root = std::env::temp_dir().join(format!("mikavn-archive-zip-test-{}", Uuid::new_v4()));
        let source = root.join("source");
        let target = root.join("target");
        let archive = root.join("archive.zip");
        fs::create_dir_all(source.join("images")).unwrap();
        fs::create_dir_all(source.join("save-backups")).unwrap();
        fs::write(source.join("mikavn.db"), "not-a-real-db").unwrap();
        fs::write(source.join("images").join("cover.png"), "image").unwrap();
        fs::write(source.join("save-backups").join("save.dat"), "save").unwrap();
        let manifest = LibraryArchiveManifest {
            app: "MikaVN Library".to_string(),
            archive_version: 1,
            exported_at: Utc::now().to_rfc3339(),
            database_file: "mikavn.db".to_string(),
            include_images: true,
            include_save_backups: true,
            images_count: 1,
            save_backups_count: 1,
            notes: Vec::new(),
        };
        fs::write(
            source.join("manifest.json"),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();

        let count = zip_dir(&source, &archive).unwrap();
        let preview = preview_archive_zip(&archive).unwrap();
        extract_archive_zip(&archive, &target).unwrap();

        assert_eq!(count, 4);
        assert!(preview.database_present);
        assert_eq!(preview.images_count, 1);
        assert_eq!(preview.save_backups_count, 1);
        assert!(target.join("manifest.json").is_file());
        assert!(target.join("images").join("cover.png").is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn detects_archive_game_conflicts() {
        let existing = Game {
            id: "game-1".to_string(),
            title: "星之终途".to_string(),
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
            install_path: "D:\\Games\\星之终途".to_string(),
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
        };
        let same_title = Game {
            id: "game-2".to_string(),
            install_path: "D:\\Other".to_string(),
            ..existing.clone()
        };
        let same_path = Game {
            id: "game-3".to_string(),
            title: "Other".to_string(),
            ..existing.clone()
        };
        let new_game = Game {
            id: "game-4".to_string(),
            title: "New".to_string(),
            install_path: "D:\\Games\\New".to_string(),
            ..existing.clone()
        };

        assert!(has_game_conflict(&[existing.clone()], &same_title));
        assert!(has_game_conflict(&[existing.clone()], &same_path));
        assert!(!has_game_conflict(&[existing], &new_game));
    }
}
