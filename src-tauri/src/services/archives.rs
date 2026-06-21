use std::collections::HashMap;
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
pub struct LibraryArchiveRestoreOptions {
    pub archive_dir: String,
    pub restore_images: Option<bool>,
    pub restore_save_backups: Option<bool>,
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

#[derive(Debug, Clone)]
struct ArchiveRestoreSummary {
    pending_database_path: PathBuf,
    pending_database_bytes: u64,
    images_restored: i64,
    save_backups_restored: i64,
    protection_dir: PathBuf,
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
            for log in archive_export_audit_logs(
                "归档导出",
                &target_parent.to_string_lossy(),
                include_images,
                include_save_backups,
            ) {
                db.append_task_log(&task_id, "info", &log)?;
            }
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
            for log in archive_export_audit_logs(
                "ZIP 归档导出",
                &target_parent.to_string_lossy(),
                include_images,
                include_save_backups,
            ) {
                db.append_task_log(&task_id, "info", &log)?;
            }
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
            let mut summary = ImportSummary {
                imported: 0,
                skipped: 0,
                images: 0,
                save_backups: 0,
                protection_path,
            };
            import_archive_games_with_summary(
                &db,
                &task_id,
                archive_games,
                &mut summary,
                |progress, message| {
                    tasks::update_task(
                        &app_handle,
                        &db,
                        &task_id,
                        "running",
                        progress,
                        Some(message),
                        None,
                    )?;
                    Ok(())
                },
            )?;

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

pub(crate) fn enqueue_library_archive_restore_task(
    app: AppHandle,
    db: &Database,
    options: LibraryArchiveRestoreOptions,
) -> DbResult<TaskRecord> {
    let source = archive_existing_source(&options.archive_dir)?;
    let preview = preview_archive_source(&source)?;
    if !preview.database_present {
        return Err(DbError::validation("archive database is missing"));
    }
    let restore_images = options
        .restore_images
        .unwrap_or(preview.manifest.include_images);
    let restore_save_backups = options.restore_save_backups.unwrap_or(false);
    let payload = serde_json::to_string(&LibraryArchiveRestoreOptions {
        archive_dir: preview.archive_dir.clone(),
        restore_images: Some(restore_images),
        restore_save_backups: Some(restore_save_backups),
    })?;
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "library.archive_restore",
        Some("正在安排库归档完整恢复".to_string()),
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

        let mut cleanup_dir_for_result = None;
        let mut pending_staging_for_result = None;
        let result = (|| -> DbResult<ArchiveRestoreSummary> {
            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.08,
                Some("正在读取库归档".to_string()),
                None,
            )?;
            let (archive_dir, cleanup_dir) = materialize_archive_source(&source, &paths)?;
            cleanup_dir_for_result = cleanup_dir;
            let preview = preview_archive_dir(&archive_dir)?;
            let archive_database = archive_dir.join(&preview.manifest.database_file);
            validate_archive_restore_database(&archive_database)?;

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.24,
                Some("正在验证恢复数据库".to_string()),
                None,
            )?;
            fs::create_dir_all(paths.database_restore_pending())?;
            let pending_staging_path = paths
                .database_restore_pending()
                .join(format!("mikavn-restore-{}.tmp", Uuid::new_v4()));
            pending_staging_for_result = Some(pending_staging_path.clone());
            let pending_staging_bytes = fs::copy(&archive_database, &pending_staging_path)?;
            validate_archive_restore_database(&pending_staging_path)?;

            let protection_dir = paths.archive_restore_protection().join(format!(
                "before-archive-restore-{}",
                Utc::now().format("%Y%m%d-%H%M%S")
            ));
            fs::create_dir_all(&protection_dir)?;
            let mut images_restored = 0;
            let mut save_backups_restored = 0;

            if restore_images {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.48,
                    Some("正在镜像恢复图片缓存".to_string()),
                    None,
                )?;
                images_restored = restore_cache_directory(
                    &archive_dir.join("images"),
                    &paths.images(),
                    &protection_dir.join("images"),
                )?;
            }

            if restore_save_backups {
                tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "running",
                    0.7,
                    Some("正在镜像恢复存档备份缓存".to_string()),
                    None,
                )?;
                save_backups_restored = restore_cache_directory(
                    &archive_dir.join("save-backups"),
                    &paths.save_backups(),
                    &protection_dir.join("save-backups"),
                )?;
            }

            tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.88,
                Some("正在安排下次启动替换数据库".to_string()),
                None,
            )?;
            let pending_database_path = paths.database_restore_pending().join("mikavn.db");
            let pending_database_bytes = replace_pending_restore_database(
                &pending_staging_path,
                &pending_database_path,
                pending_staging_bytes,
            )?;

            let _ = db.append_task_log(
                &task_id,
                "warn",
                "完整恢复已安排：数据库将在下次启动前替换，当前数据库会先创建保护备份。",
            );
            let _ = db.append_task_log(
                &task_id,
                "info",
                &format!(
                    "归档恢复保护目录：{}",
                    logger::display_path(&protection_dir)
                ),
            );
            Ok(ArchiveRestoreSummary {
                pending_database_path,
                pending_database_bytes,
                images_restored,
                save_backups_restored,
                protection_dir,
            })
        })();

        if let Some(cleanup_dir) = cleanup_dir_for_result {
            let _ = fs::remove_dir_all(cleanup_dir);
        }
        if let Some(pending_staging) = pending_staging_for_result {
            let _ = fs::remove_file(pending_staging);
        }

        match result {
            Ok(summary) => {
                logger::log_warn(
                    &paths,
                    "library.archive_restore",
                    format!(
                        "archive restore scheduled: pending {}, images {}, save backups {}, protection {}",
                        logger::display_path(&summary.pending_database_path),
                        summary.images_restored,
                        summary.save_backups_restored,
                        logger::display_path(&summary.protection_dir)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "完整恢复已安排：下次启动替换数据库（{} bytes），图片 {} 个，存档备份 {} 个。",
                        summary.pending_database_bytes,
                        summary.images_restored,
                        summary.save_backups_restored
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "library.archive_restore", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("库归档完整恢复失败".to_string()),
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

fn import_archive_games_with_summary(
    db: &Database,
    task_id: &str,
    archive_games: Vec<Game>,
    summary: &mut ImportSummary,
    mut on_progress: impl FnMut(f64, String) -> DbResult<()>,
) -> DbResult<()> {
    let total = archive_games.len().max(1) as f64;
    let mut conflicts = ArchiveImportConflictIndex::new(db.list_games(GameFilter::default())?);
    for (index, game) in archive_games.into_iter().enumerate() {
        if let Some(reason) = conflicts.conflict_reason(&game) {
            summary.skipped += 1;
            db.append_task_log(
                task_id,
                "warn",
                &format!("归档导入跳过：{}（{}）", game.title, reason),
            )?;
        } else {
            let title = game.title.clone();
            let imported = game_service::insert_imported_game(db, game)?;
            conflicts.insert(&imported);
            summary.imported += 1;
            db.append_task_log(task_id, "info", &format!("归档导入新增：{title}"))?;
        }
        let progress = 0.24 + ((index + 1) as f64 / total) * 0.46;
        on_progress(
            progress,
            format!(
                "已导入 {} 个，跳过 {} 个",
                summary.imported, summary.skipped
            ),
        )?;
    }
    Ok(())
}

#[cfg(test)]
fn archive_import_conflict_reason(existing: &[Game], incoming: &Game) -> Option<String> {
    ArchiveImportConflictIndex::new(existing.to_vec()).conflict_reason(incoming)
}

struct ArchiveImportConflictIndex {
    ids: HashMap<String, String>,
    titles: HashMap<String, String>,
    install_paths: HashMap<String, String>,
}

impl ArchiveImportConflictIndex {
    fn new(existing: Vec<Game>) -> Self {
        let mut index = Self {
            ids: HashMap::new(),
            titles: HashMap::new(),
            install_paths: HashMap::new(),
        };
        for game in &existing {
            index.insert(game);
        }
        index
    }

    fn insert(&mut self, game: &Game) {
        self.ids.insert(game.id.clone(), game.title.clone());
        self.titles
            .insert(normalize_title(&game.title), game.title.clone());
        self.install_paths
            .insert(normalize_path(&game.install_path), game.title.clone());
    }

    fn conflict_reason(&self, incoming: &Game) -> Option<String> {
        if let Some(title) = self.ids.get(&incoming.id) {
            Some(format!("ID 已存在：{title}"))
        } else if let Some(title) = self.titles.get(&normalize_title(&incoming.title)) {
            Some(format!("标题已存在：{title}"))
        } else {
            self.install_paths
                .get(&normalize_path(&incoming.install_path))
                .map(|title| format!("安装目录已存在：{title}"))
        }
    }
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
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| DbError::validation("archive contains an unsafe path"))?
            .to_path_buf();
        let name = zip_path_name(&enclosed)?;
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

fn archive_export_audit_logs(
    prefix: &str,
    target: &str,
    include_images: bool,
    include_save_backups: bool,
) -> [String; 2] {
    [
        format!("{prefix}目标：{target}"),
        format!(
            "{prefix}包含：图片 {}，存档备份 {}",
            if include_images { "是" } else { "否" },
            if include_save_backups { "是" } else { "否" }
        ),
    ]
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

fn restore_cache_directory(source: &Path, target: &Path, protection: &Path) -> DbResult<i64> {
    if !source.exists() {
        return Ok(0);
    }
    if !source.is_dir() {
        return Err(DbError::path_not_found(
            "archive cache source must be a directory",
        ));
    }
    if target.exists() {
        copy_dir_recursive(target, protection)?;
        clear_dir_contents(target)?;
    }
    fs::create_dir_all(target)?;
    copy_dir_recursive(source, target)
}

fn replace_pending_restore_database(
    staging: &Path,
    pending: &Path,
    staging_bytes: u64,
) -> DbResult<u64> {
    if !staging.is_file() {
        return Err(DbError::path_not_found(
            "staged archive restore database is missing",
        ));
    }
    if let Some(parent) = pending.parent() {
        fs::create_dir_all(parent)?;
    }
    if pending.exists() && !pending.is_file() {
        return Err(DbError::path_not_found(
            "pending restore path must be a file",
        ));
    }

    let existing_backup =
        pending.with_file_name(format!("mikavn-restore-existing-{}.bak", Uuid::new_v4()));
    let had_existing = pending.exists();
    if had_existing {
        fs::rename(pending, &existing_backup)?;
    }

    let replacement = (|| -> DbResult<u64> {
        let pending_bytes = fs::copy(staging, pending)?;
        if pending_bytes != staging_bytes {
            return Err(DbError::backup_failed(
                "pending archive restore database size does not match staging file",
            ));
        }
        validate_archive_restore_database(pending)?;
        Ok(pending_bytes)
    })();

    match replacement {
        Ok(pending_bytes) => {
            if had_existing {
                let _ = fs::remove_file(existing_backup);
            }
            Ok(pending_bytes)
        }
        Err(error) => {
            let _ = fs::remove_file(pending);
            if had_existing {
                let _ = fs::rename(existing_backup, pending);
            }
            Err(error)
        }
    }
}

fn clear_dir_contents(target: &Path) -> DbResult<i64> {
    if !target.exists() {
        fs::create_dir_all(target)?;
        return Ok(0);
    }
    if !target.is_dir() {
        return Err(DbError::path_not_found(
            "target cache path must be a directory",
        ));
    }

    let mut removed = 0;
    for entry in fs::read_dir(target)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            removed += count_files(&path)?;
            fs::remove_dir_all(&path)?;
        } else if file_type.is_file() {
            fs::remove_file(&path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

fn validate_archive_restore_database(path: &Path) -> DbResult<()> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let check: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if check != "ok" {
        return Err(DbError::backup_failed(format!(
            "archive database failed quick_check: {check}"
        )));
    }
    let has_games_table: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'games')",
        [],
        |row| row.get::<_, i64>(0),
    )? != 0;
    if !has_games_table {
        return Err(DbError::backup_failed(
            "archive database does not look like a MikaVN database",
        ));
    }
    Ok(())
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

#[cfg(test)]
mod tests;
