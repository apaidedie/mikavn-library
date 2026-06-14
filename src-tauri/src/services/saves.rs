use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use uuid::Uuid;

use crate::db::models::{SaveBackup, SavePath, SavePathCandidate, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

pub fn add_save_path(
    db: &Database,
    game_id: String,
    label: String,
    path: String,
) -> DbResult<SavePath> {
    db.get_game(game_id.clone())?;
    let path = trimmed_required(path, "savePath")?;
    validate_existing_dir(Path::new(&path))?;
    db.add_save_path(game_id, label, path)
}

pub fn list_save_paths(db: &Database, game_id: String) -> DbResult<Vec<SavePath>> {
    db.list_save_paths(game_id)
}

pub fn remove_save_path(db: &Database, id: String) -> DbResult<()> {
    db.remove_save_path(id)
}

pub fn list_save_backups(db: &Database, game_id: String) -> DbResult<Vec<SaveBackup>> {
    db.list_save_backups(game_id)
}

pub fn delete_save_backup_record(db: &Database, id: String) -> DbResult<()> {
    db.delete_save_backup_record(id)
}

pub fn create_save_backup(
    app: &AppHandle,
    db: &Database,
    save_path_id: String,
    label: String,
) -> DbResult<SaveBackup> {
    let save_path = db.get_save_path(&save_path_id)?;
    let backup = create_backup_for_path(app, &save_path, label, false)?;
    db.insert_save_backup(&backup)
}

pub fn restore_save_backup(
    app: &AppHandle,
    db: &Database,
    backup_id: String,
) -> DbResult<SaveBackup> {
    let (backup, save_path) = {
        let backup = db.get_save_backup(&backup_id)?;
        let save_path = db.get_save_path(&backup.save_path_id)?;
        (backup, save_path)
    };

    let paths =
        AppPaths::from_app(app).map_err(|error| DbError::backup_failed(error.to_string()))?;
    restore_save_backup_with_paths(&paths, db, &backup, &save_path, "merge")
}

pub fn preview_save_restore(
    db: &Database,
    backup_id: String,
    mode: String,
) -> DbResult<SaveRestorePreview> {
    validate_restore_mode(&mode)?;
    let backup = db.get_save_backup(&backup_id)?;
    let save_path = db.get_save_path(&backup.save_path_id)?;
    preview_restore_files(
        Path::new(&backup.backup_path),
        Path::new(&save_path.path),
        &mode,
    )
}

fn restore_save_backup_with_paths(
    paths: &AppPaths,
    db: &Database,
    backup: &SaveBackup,
    save_path: &SavePath,
    mode: &str,
) -> DbResult<SaveBackup> {
    validate_restore_mode(mode)?;
    let protection =
        create_backup_for_path_with_paths(paths, save_path, "恢复前保护备份".to_string(), true)?;
    let _ = restore_files_from_backup(
        Path::new(&backup.backup_path),
        Path::new(&save_path.path),
        mode,
    )?;
    db.insert_save_backup(&protection)
}

pub fn suggest_save_paths(db: &Database, game_id: String) -> DbResult<Vec<SavePathCandidate>> {
    let game = db.get_game(game_id.clone())?;
    let existing_paths = db
        .list_save_paths(game_id)?
        .into_iter()
        .map(|item| normalize_path_key(&item.path))
        .collect::<HashSet<_>>();
    Ok(suggest_save_path_candidates(
        &game.title,
        &game.install_path,
        game.working_directory.as_deref(),
        &existing_paths,
    ))
}

pub fn suggest_save_path_candidates(
    title: &str,
    install_path: &str,
    working_directory: Option<&str>,
    existing_paths: &HashSet<String>,
) -> Vec<SavePathCandidate> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    let install = PathBuf::from(install_path);
    let workdir = working_directory
        .filter(|item| !item.trim().is_empty())
        .map(PathBuf::from);

    for dirname in [
        "save", "saves", "savedata", "SaveData", "Save", "SAVE", "UserData", "userdata",
    ] {
        push_candidate(
            &mut candidates,
            &mut seen,
            existing_paths,
            "游戏目录存档",
            install.join(dirname),
            "安装目录下的常见存档文件夹",
        );
        if let Some(workdir) = &workdir {
            push_candidate(
                &mut candidates,
                &mut seen,
                existing_paths,
                "工作目录存档",
                workdir.join(dirname),
                "工作目录下的常见存档文件夹",
            );
        }
    }

    for (env_name, label, reason) in [
        ("APPDATA", "AppData Roaming", "%APPDATA% 下的游戏存档候选"),
        (
            "LOCALAPPDATA",
            "AppData Local",
            "%LOCALAPPDATA% 下的游戏存档候选",
        ),
        (
            "USERPROFILE",
            "用户文档",
            "Documents / Saved Games 下的候选",
        ),
    ] {
        let Ok(root) = std::env::var(env_name) else {
            continue;
        };
        let root = PathBuf::from(root);
        for name in save_name_variants(title, install_path) {
            match env_name {
                "USERPROFILE" => {
                    push_candidate(
                        &mut candidates,
                        &mut seen,
                        existing_paths,
                        label,
                        root.join("Documents").join(&name),
                        reason,
                    );
                    push_candidate(
                        &mut candidates,
                        &mut seen,
                        existing_paths,
                        label,
                        root.join("Saved Games").join(&name),
                        reason,
                    );
                }
                _ => push_candidate(
                    &mut candidates,
                    &mut seen,
                    existing_paths,
                    label,
                    root.join(&name),
                    reason,
                ),
            }
        }
    }

    candidates
        .into_iter()
        .filter(|item| item.exists || item.already_added)
        .collect()
}

pub fn normalize_path_key(path: &str) -> String {
    path.trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
        .to_lowercase()
}

pub fn enqueue_save_backup_task(
    app: AppHandle,
    db: &Database,
    save_path_id: String,
    label: String,
) -> DbResult<TaskRecord> {
    let save_path = db.get_save_path(&save_path_id)?;
    let payload = serde_json::json!({ "savePathId": save_path_id, "label": label }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "save.backup",
        Some(format!("正在备份 {}", save_path.label)),
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

        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.2,
            Some("正在复制存档文件".to_string()),
            None,
        );
        match create_backup_for_path(&app_handle, &save_path, label, false)
            .and_then(|backup| db.insert_save_backup(&backup))
        {
            Ok(backup) => {
                logger::log_info(
                    &paths,
                    "save.backup",
                    format!(
                        "save backup created: {}",
                        logger::display_path(Path::new(&backup.backup_path))
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!("存档备份已创建：{}", backup.label)),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "save.backup", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("存档备份失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub fn enqueue_save_restore_task(
    app: AppHandle,
    db: &Database,
    backup_id: String,
    mode: String,
) -> DbResult<TaskRecord> {
    let (backup, save_path) = {
        let backup = db.get_save_backup(&backup_id)?;
        let save_path = db.get_save_path(&backup.save_path_id)?;
        (backup, save_path)
    };
    validate_restore_mode(&mode)?;
    let payload = serde_json::json!({ "backupId": backup_id, "mode": mode }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "save.restore",
        Some(format!("正在恢复 {}", backup.label)),
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

        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.15,
            Some("正在创建恢复前保护备份".to_string()),
            None,
        );
        let result = (|| -> DbResult<SaveRestoreReport> {
            let protection = create_backup_for_path(
                &app_handle,
                &save_path,
                "恢复前保护备份".to_string(),
                true,
            )?;
            db.append_task_log(
                &task_id,
                "info",
                &format!("存档恢复保护备份：{}", protection.backup_path),
            )?;
            let preview = preview_restore_files(
                Path::new(&backup.backup_path),
                Path::new(&save_path.path),
                &mode,
            )?;
            for line in restore_preview_log_lines(&preview, &protection.backup_path) {
                db.append_task_log(&task_id, "info", &line)?;
            }
            let _ = tasks::update_task(
                &app_handle,
                &db,
                &task_id,
                "running",
                0.55,
                Some("正在恢复存档文件".to_string()),
                None,
            );
            let report = restore_files_from_backup(
                Path::new(&backup.backup_path),
                Path::new(&save_path.path),
                &mode,
            )?;
            db.append_task_log(
                &task_id,
                "info",
                &format!(
                    "存档恢复报告：模式 {}，复制 {} 个文件，清理 {} 个文件。",
                    restore_mode_label(&report.mode),
                    report.copied_files,
                    report.removed_files
                ),
            )?;
            let protection = db.insert_save_backup(&protection)?;
            Ok(SaveRestoreReport {
                copied_files: report.copied_files,
                removed_files: report.removed_files,
                protection,
            })
        })();

        match result {
            Ok(report) => {
                logger::log_info(
                    &paths,
                    "save.restore",
                    format!(
                        "save restored with protection backup: {}, copied {}, removed {}",
                        logger::display_path(Path::new(&report.protection.backup_path)),
                        report.copied_files,
                        report.removed_files
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "存档已恢复：复制 {} 个文件，清理 {} 个文件，并已创建保护备份",
                        report.copied_files, report.removed_files
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "save.restore", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("存档恢复失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

struct SaveRestoreReport {
    copied_files: i64,
    removed_files: i64,
    protection: SaveBackup,
}

fn restore_mode_label(mode: &str) -> &'static str {
    match mode {
        "mirror" => "镜像",
        _ => "合并",
    }
}

fn restore_preview_log_lines(preview: &SaveRestorePreview, protection_path: &str) -> Vec<String> {
    let mut lines = vec![
        format!("存档恢复模式：{}", restore_mode_label(&preview.mode)),
        format!("备份来源：{}", preview.backup_path),
        format!("恢复目标：{}", preview.save_path),
        format!(
            "存档恢复差异：备份 {}，当前 {}，新增 {}，覆盖 {}，保留 {}，清理 {}。",
            preview.backup_file_count,
            preview.current_file_count,
            preview.new_files,
            preview.overwritten_files,
            preview.kept_files,
            preview.removed_files
        ),
    ];
    push_sample_line(&mut lines, "新增样例", &preview.sample_new_files);
    push_sample_line(&mut lines, "覆盖样例", &preview.sample_overwritten_files);
    push_sample_line(&mut lines, "保留样例", &preview.sample_kept_files);
    push_sample_line(&mut lines, "清理样例", &preview.sample_removed_files);
    lines.push(format!("保护备份：{protection_path}"));
    lines
}

fn push_sample_line(lines: &mut Vec<String>, label: &str, samples: &[String]) {
    if !samples.is_empty() {
        lines.push(format!("{label}：{}", samples.join("，")));
    }
}

pub fn restore_mode(mode: Option<String>) -> String {
    mode.unwrap_or_else(|| "merge".to_string())
}

pub fn create_auto_save_backups(
    app: &AppHandle,
    db: &Database,
    game_id: &str,
    stage: &str,
) -> DbResult<Option<TaskRecord>> {
    let save_paths = db.list_save_paths(game_id.to_string())?;
    if save_paths.is_empty() {
        return Ok(None);
    }

    let task = tasks::create_task(
        app,
        db,
        "save.auto_backup",
        Some(format!("自动存档备份：{stage}")),
    )?;
    let task_id = task.id.clone();
    let _ = tasks::update_task(
        app,
        db,
        &task_id,
        "running",
        0.1,
        Some(format!("正在备份 {} 个存档路径", save_paths.len())),
        None,
    )?;

    let mut completed = 0_i64;
    let mut errors = Vec::new();
    let total = save_paths.len() as f64;
    for (index, save_path) in save_paths.iter().enumerate() {
        let label = format!("自动备份-{stage}-{}", save_path.label);
        match create_backup_for_path(app, save_path, label, false)
            .and_then(|backup| db.insert_save_backup(&backup))
        {
            Ok(backup) => {
                completed += 1;
                let _ = db.append_task_log(
                    &task_id,
                    "info",
                    &format!(
                        "已备份 {} -> {}",
                        save_path.label,
                        logger::display_path(Path::new(&backup.backup_path))
                    ),
                );
            }
            Err(error) => {
                let message = format!("{}: {error}", save_path.label);
                let _ = db.append_task_log(&task_id, "warn", &message);
                errors.push(message);
            }
        }
        let progress = 0.1 + ((index + 1) as f64 / total) * 0.85;
        let _ = tasks::update_task(
            app,
            db,
            &task_id,
            "running",
            progress.min(0.95),
            Some(format!("自动备份进度：{completed}/{}", save_paths.len())),
            None,
        );
    }

    if errors.is_empty() {
        Ok(Some(tasks::update_task(
            app,
            db,
            &task_id,
            "completed",
            1.0,
            Some(format!(
                "自动存档备份完成：{completed}/{}",
                save_paths.len()
            )),
            None,
        )?))
    } else if completed > 0 {
        Ok(Some(tasks::update_task(
            app,
            db,
            &task_id,
            "completed",
            1.0,
            Some(format!(
                "自动存档备份部分完成：{completed}/{}，失败 {}",
                save_paths.len(),
                errors.len()
            )),
            None,
        )?))
    } else {
        Ok(Some(tasks::update_task(
            app,
            db,
            &task_id,
            "failed",
            1.0,
            Some("自动存档备份失败".to_string()),
            Some(errors.join("; ")),
        )?))
    }
}

pub fn create_backup_for_path(
    app: &AppHandle,
    save_path: &SavePath,
    label: String,
    protection: bool,
) -> DbResult<SaveBackup> {
    let paths =
        AppPaths::from_app(app).map_err(|error| DbError::backup_failed(error.to_string()))?;
    create_backup_for_path_with_paths(&paths, save_path, label, protection)
}

fn create_backup_for_path_with_paths(
    paths: &AppPaths,
    save_path: &SavePath,
    label: String,
    protection: bool,
) -> DbResult<SaveBackup> {
    let source = PathBuf::from(&save_path.path);
    validate_existing_dir(&source)?;

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let clean_label = safe_part(if label.trim().is_empty() {
        "backup"
    } else {
        label.trim()
    });
    let target = paths
        .save_backups()
        .join(&save_path.game_id)
        .join(format!("{timestamp}-{clean_label}"));
    fs::create_dir_all(&target)?;
    let _ = copy_dir_contents(&source, &target)?;

    Ok(SaveBackup {
        id: Uuid::new_v4().to_string(),
        game_id: save_path.game_id.clone(),
        save_path_id: save_path.id.clone(),
        label: if label.trim().is_empty() {
            save_path.label.clone()
        } else {
            label.trim().to_string()
        },
        source_path: save_path.path.clone(),
        backup_path: target.to_string_lossy().to_string(),
        protection,
        created_at: Utc::now().to_rfc3339(),
    })
}

fn validate_restore_mode(mode: &str) -> DbResult<()> {
    match mode {
        "merge" | "mirror" => Ok(()),
        _ => Err(DbError::validation("unsupported save restore mode")),
    }
}

fn validate_existing_dir(path: &Path) -> DbResult<()> {
    if path.as_os_str().is_empty() {
        return Err(DbError::validation("path is required"));
    }
    let metadata = fs::metadata(path)?;
    if !metadata.is_dir() {
        return Err(DbError::path_not_found(
            "path must be an existing directory",
        ));
    }
    Ok(())
}

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn copy_dir_contents(source: &Path, target: &Path) -> DbResult<i64> {
    validate_existing_dir(source)?;
    fs::create_dir_all(target)?;
    let mut copied = 0;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copied += copy_dir_contents(&source_path, &target_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_path, &target_path)?;
            copied += 1;
        }
    }
    Ok(copied)
}

fn clear_dir_contents(target: &Path) -> DbResult<i64> {
    validate_existing_dir(target)?;
    let mut removed = 0;
    for entry in fs::read_dir(target)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            removed += count_files_recursive(&path)?;
            fs::remove_dir_all(path)?;
        } else if file_type.is_file() {
            fs::remove_file(path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn restore_files_from_backup(
    backup_path: &Path,
    save_path: &Path,
    mode: &str,
) -> DbResult<RestoreFileReport> {
    validate_restore_mode(mode)?;
    let removed_files = if mode == "mirror" {
        clear_dir_contents(save_path)?
    } else {
        0
    };
    let copied_files = copy_dir_contents(backup_path, save_path)?;
    Ok(RestoreFileReport {
        mode: mode.to_string(),
        copied_files,
        removed_files,
    })
}

pub struct RestoreFileReport {
    pub mode: String,
    pub copied_files: i64,
    pub removed_files: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestorePreview {
    pub mode: String,
    pub backup_path: String,
    pub save_path: String,
    pub backup_file_count: i64,
    pub current_file_count: i64,
    pub new_files: i64,
    pub overwritten_files: i64,
    pub kept_files: i64,
    pub removed_files: i64,
    pub sample_new_files: Vec<String>,
    pub sample_overwritten_files: Vec<String>,
    pub sample_kept_files: Vec<String>,
    pub sample_removed_files: Vec<String>,
}

pub fn preview_restore_files(
    backup_path: &Path,
    save_path: &Path,
    mode: &str,
) -> DbResult<SaveRestorePreview> {
    validate_restore_mode(mode)?;
    let backup_files = collect_relative_files(backup_path)?;
    let current_files = collect_relative_files(save_path)?;
    let backup_keys = backup_files.keys().cloned().collect::<HashSet<_>>();
    let current_keys = current_files.keys().cloned().collect::<HashSet<_>>();

    let new_files = backup_files
        .iter()
        .filter(|(key, _)| !current_keys.contains(*key))
        .map(|(_, value)| value.clone())
        .collect::<Vec<_>>();
    let overwritten_files = backup_files
        .iter()
        .filter(|(key, _)| current_keys.contains(*key))
        .map(|(_, value)| value.clone())
        .collect::<Vec<_>>();
    let current_only_files = current_files
        .iter()
        .filter(|(key, _)| !backup_keys.contains(*key))
        .map(|(_, value)| value.clone())
        .collect::<Vec<_>>();
    let removed_files = if mode == "mirror" {
        current_files.values().cloned().collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    Ok(SaveRestorePreview {
        mode: mode.to_string(),
        backup_path: backup_path.to_string_lossy().to_string(),
        save_path: save_path.to_string_lossy().to_string(),
        backup_file_count: backup_files.len() as i64,
        current_file_count: current_files.len() as i64,
        new_files: new_files.len() as i64,
        overwritten_files: overwritten_files.len() as i64,
        kept_files: if mode == "merge" {
            current_only_files.len() as i64
        } else {
            0
        },
        removed_files: removed_files.len() as i64,
        sample_new_files: sample_paths(&new_files),
        sample_overwritten_files: sample_paths(&overwritten_files),
        sample_kept_files: if mode == "merge" {
            sample_paths(&current_only_files)
        } else {
            Vec::new()
        },
        sample_removed_files: sample_paths(&removed_files),
    })
}

fn collect_relative_files(root: &Path) -> DbResult<BTreeMap<String, String>> {
    validate_existing_dir(root)?;
    let mut files = BTreeMap::new();
    collect_relative_files_inner(root, root, &mut files)?;
    Ok(files)
}

fn collect_relative_files_inner(
    root: &Path,
    current: &Path,
    files: &mut BTreeMap<String, String>,
) -> DbResult<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            collect_relative_files_inner(root, &path, files)?;
        } else if file_type.is_file() {
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            files.insert(relative.to_lowercase(), relative);
        }
    }
    Ok(())
}

fn sample_paths(paths: &[String]) -> Vec<String> {
    paths.iter().take(5).cloned().collect()
}

fn count_files_recursive(path: &Path) -> DbResult<i64> {
    validate_existing_dir(path)?;
    let mut count = 0;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            count += count_files_recursive(&entry.path())?;
        } else if file_type.is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn safe_part(value: &str) -> String {
    let part = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = part.trim_matches('-');
    if trimmed.is_empty() {
        "backup".to_string()
    } else {
        trimmed.to_string()
    }
}

fn push_candidate(
    candidates: &mut Vec<SavePathCandidate>,
    seen: &mut HashSet<String>,
    existing_paths: &HashSet<String>,
    label: &str,
    path: PathBuf,
    reason: &str,
) {
    let key = normalize_path_key(&path.to_string_lossy());
    if key.is_empty() || !seen.insert(key.clone()) {
        return;
    }

    let exists = path.is_dir();
    let already_added = existing_paths.contains(&key);
    candidates.push(SavePathCandidate {
        label: label.to_string(),
        path: path.to_string_lossy().to_string(),
        reason: reason.to_string(),
        exists,
        already_added,
    });
}

fn save_name_variants(title: &str, install_path: &str) -> Vec<String> {
    let mut variants = Vec::new();
    for value in [
        title,
        Path::new(install_path)
            .file_name()
            .and_then(|item| item.to_str())
            .unwrap_or_default(),
    ] {
        let trimmed = value.trim();
        if !trimmed.is_empty() && !variants.iter().any(|item| item == trimmed) {
            variants.push(trimmed.to_string());
        }
        let ascii = trimmed
            .chars()
            .map(|ch| {
                if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                    ch
                } else {
                    '_'
                }
            })
            .collect::<String>();
        let ascii = ascii.trim_matches('_');
        if !ascii.is_empty() && !variants.iter().any(|item| item == ascii) {
            variants.push(ascii.to_string());
        }
    }
    variants
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::AddGameInput;

    #[test]
    fn rejects_missing_save_path() {
        let path = PathBuf::from("Z:\\this-path-should-not-exist\\mikavn");
        assert!(validate_existing_dir(&path).is_err());
    }

    #[test]
    fn suggests_existing_save_folder_under_install_dir() {
        let root = std::env::temp_dir().join(format!("mikavn-save-candidate-{}", Uuid::new_v4()));
        fs::create_dir_all(root.join("SaveData")).unwrap();

        let candidates = suggest_save_path_candidates(
            "星之终途",
            &root.to_string_lossy(),
            None,
            &HashSet::new(),
        );

        assert!(candidates
            .iter()
            .any(|item| item.path.to_lowercase().ends_with("savedata") && item.exists));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn marks_existing_save_path_candidate_as_added() {
        let root = std::env::temp_dir().join(format!("mikavn-save-candidate-{}", Uuid::new_v4()));
        let save_dir = root.join("save");
        fs::create_dir_all(&save_dir).unwrap();
        let mut existing = HashSet::new();
        existing.insert(normalize_path_key(&save_dir.to_string_lossy()));

        let candidates =
            suggest_save_path_candidates("星之终途", &root.to_string_lossy(), None, &existing);

        assert!(candidates
            .iter()
            .any(|item| item.path.ends_with("save") && item.already_added));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn clear_dir_contents_removes_nested_files_but_keeps_root() {
        let root = std::env::temp_dir().join(format!("mikavn-save-clear-{}", Uuid::new_v4()));
        fs::create_dir_all(root.join("nested")).unwrap();
        fs::write(root.join("keep-root.txt"), "old").unwrap();
        fs::write(root.join("nested").join("old.dat"), "old").unwrap();

        let removed = clear_dir_contents(&root).unwrap();

        assert_eq!(removed, 2);
        assert!(root.is_dir());
        assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn merge_restore_preserves_unrelated_current_files() {
        let root = std::env::temp_dir().join(format!("mikavn-save-merge-{}", Uuid::new_v4()));
        let backup = root.join("backup");
        let save = root.join("save");
        fs::create_dir_all(backup.join("nested")).unwrap();
        fs::create_dir_all(&save).unwrap();
        fs::write(backup.join("slot1.dat"), "backup").unwrap();
        fs::write(backup.join("nested").join("slot2.dat"), "backup nested").unwrap();
        fs::write(save.join("local-only.dat"), "current").unwrap();

        let report = restore_files_from_backup(&backup, &save, "merge").unwrap();

        assert_eq!(report.mode, "merge");
        assert_eq!(report.copied_files, 2);
        assert_eq!(report.removed_files, 0);
        assert_eq!(
            fs::read_to_string(save.join("slot1.dat")).unwrap(),
            "backup"
        );
        assert_eq!(
            fs::read_to_string(save.join("nested").join("slot2.dat")).unwrap(),
            "backup nested"
        );
        assert_eq!(
            fs::read_to_string(save.join("local-only.dat")).unwrap(),
            "current"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn mirror_restore_removes_unrelated_current_files() {
        let root = std::env::temp_dir().join(format!("mikavn-save-mirror-{}", Uuid::new_v4()));
        let backup = root.join("backup");
        let save = root.join("save");
        fs::create_dir_all(&backup).unwrap();
        fs::create_dir_all(save.join("old-nested")).unwrap();
        fs::write(backup.join("slot1.dat"), "backup").unwrap();
        fs::write(save.join("local-only.dat"), "current").unwrap();
        fs::write(save.join("old-nested").join("stale.dat"), "stale").unwrap();

        let report = restore_files_from_backup(&backup, &save, "mirror").unwrap();

        assert_eq!(report.mode, "mirror");
        assert_eq!(report.copied_files, 1);
        assert_eq!(report.removed_files, 2);
        assert_eq!(
            fs::read_to_string(save.join("slot1.dat")).unwrap(),
            "backup"
        );
        assert!(!save.join("local-only.dat").exists());
        assert!(!save.join("old-nested").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restore_preview_reports_differences_without_modifying_files() {
        let root = std::env::temp_dir().join(format!("mikavn-save-preview-{}", Uuid::new_v4()));
        let backup = root.join("backup");
        let save = root.join("save");
        fs::create_dir_all(backup.join("nested")).unwrap();
        fs::create_dir_all(&save).unwrap();
        fs::write(backup.join("slot1.dat"), "backup").unwrap();
        fs::write(backup.join("nested").join("slot2.dat"), "backup nested").unwrap();
        fs::write(save.join("slot1.dat"), "current").unwrap();
        fs::write(save.join("local-only.dat"), "current only").unwrap();

        let merge = preview_restore_files(&backup, &save, "merge").unwrap();
        let mirror = preview_restore_files(&backup, &save, "mirror").unwrap();

        assert_eq!(merge.backup_file_count, 2);
        assert_eq!(merge.current_file_count, 2);
        assert_eq!(merge.new_files, 1);
        assert_eq!(merge.overwritten_files, 1);
        assert_eq!(merge.kept_files, 1);
        assert_eq!(merge.removed_files, 0);
        assert_eq!(mirror.removed_files, 2);
        assert_eq!(mirror.kept_files, 0);
        assert_eq!(
            fs::read_to_string(save.join("slot1.dat")).unwrap(),
            "current"
        );
        assert!(save.join("local-only.dat").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restore_preview_log_lines_include_counts_samples_and_paths() {
        let preview = SaveRestorePreview {
            mode: "mirror".to_string(),
            backup_path: "D:\\Backups\\slot".to_string(),
            save_path: "D:\\Games\\VN\\save".to_string(),
            backup_file_count: 3,
            current_file_count: 2,
            new_files: 1,
            overwritten_files: 1,
            kept_files: 0,
            removed_files: 2,
            sample_new_files: vec!["new.dat".to_string()],
            sample_overwritten_files: vec!["slot1.dat".to_string()],
            sample_kept_files: Vec::new(),
            sample_removed_files: vec!["old.dat".to_string()],
        };

        let lines = restore_preview_log_lines(&preview, "D:\\Protection\\before-restore");

        assert!(lines.iter().any(|line| line.contains("存档恢复模式：镜像")));
        assert!(lines
            .iter()
            .any(|line| line.contains("新增 1，覆盖 1，保留 0，清理 2")));
        assert!(lines.iter().any(|line| line.contains("新增样例：new.dat")));
        assert!(lines
            .iter()
            .any(|line| line.contains("覆盖样例：slot1.dat")));
        assert!(lines.iter().any(|line| line.contains("清理样例：old.dat")));
        assert!(lines
            .iter()
            .any(|line| line.contains("保护备份：D:\\Protection\\before-restore")));
    }

    #[test]
    fn restore_entry_creates_protection_backup_record_before_copying_files() {
        let root = std::env::temp_dir().join(format!("mikavn-save-protection-{}", Uuid::new_v4()));
        let app_root = root.join("app-data");
        let save = root.join("save");
        let backup_dir = root.join("backup");
        fs::create_dir_all(&save).unwrap();
        fs::create_dir_all(&backup_dir).unwrap();
        fs::write(save.join("slot.dat"), "current").unwrap();
        fs::write(backup_dir.join("slot.dat"), "backup").unwrap();

        let paths = AppPaths::from_root(app_root.clone()).unwrap();
        let db = Database::new_from_path(paths.database()).unwrap();
        let game = db
            .add_game(AddGameInput {
                title: "Protection VN".to_string(),
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
        let save_path = db
            .add_save_path(
                game.id.clone(),
                "main".to_string(),
                save.to_string_lossy().to_string(),
            )
            .unwrap();
        let backup = db
            .insert_save_backup(&SaveBackup {
                id: Uuid::new_v4().to_string(),
                game_id: game.id.clone(),
                save_path_id: save_path.id.clone(),
                label: "manual".to_string(),
                source_path: save_path.path.clone(),
                backup_path: backup_dir.to_string_lossy().to_string(),
                protection: false,
                created_at: Utc::now().to_rfc3339(),
            })
            .unwrap();

        let protection =
            restore_save_backup_with_paths(&paths, &db, &backup, &save_path, "merge").unwrap();

        assert!(protection.protection);
        assert_eq!(protection.label, "恢复前保护备份");
        assert_eq!(fs::read_to_string(save.join("slot.dat")).unwrap(), "backup");
        assert_eq!(
            fs::read_to_string(Path::new(&protection.backup_path).join("slot.dat")).unwrap(),
            "current"
        );
        let records = db.list_save_backups(game.id).unwrap();
        assert_eq!(records.len(), 2);
        assert!(records
            .iter()
            .any(|item| item.id == protection.id && item.protection));

        let _ = fs::remove_dir_all(root);
    }
}
