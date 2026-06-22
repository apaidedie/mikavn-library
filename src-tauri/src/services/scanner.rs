use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use tauri::AppHandle;
use uuid::Uuid;

use crate::db::models::{
    AddGameInput, Game, ImportCandidate, ImportScanReport, ImportScanReportItem, LibraryRoot,
    ScanCandidate, ScanConflict, ScanConflictRow, ScanExecutable, ScanTaskStatus, TaskRecord,
};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::games as game_service;
use crate::services::tasks;

pub fn add_library_root(db: &Database, path: String) -> DbResult<LibraryRoot> {
    db.add_library_root(path)
}

pub fn list_library_roots(db: &Database) -> DbResult<Vec<LibraryRoot>> {
    db.list_library_roots()
}

pub fn update_library_root(
    db: &Database,
    id: String,
    recursive: Option<bool>,
    enabled: Option<bool>,
) -> DbResult<LibraryRoot> {
    db.update_library_root(id, recursive, enabled)
}

pub fn remove_library_root(db: &Database, id: String) -> DbResult<()> {
    db.remove_library_root(id)
}

pub fn get_scan_task_status(db: &Database, task_id: String) -> DbResult<ScanTaskStatus> {
    db.get_scan_task_status(&task_id)
}

pub fn scan_library_root(db: &Database, id: String) -> DbResult<Vec<ScanCandidate>> {
    let root = db.get_library_root(&id)?;
    if !root.enabled {
        return Err(DbError::validation("library root is disabled"));
    }
    let mut candidates = scan_path(PathBuf::from(root.path), root.recursive)?;
    mark_conflicts(db, &mut candidates)?;
    Ok(candidates)
}

pub fn scan_path_preview(
    db: &Database,
    path: String,
    recursive: bool,
) -> DbResult<Vec<ScanCandidate>> {
    let mut candidates = scan_path(PathBuf::from(path), recursive)?;
    mark_conflicts(db, &mut candidates)?;
    Ok(candidates)
}

pub fn enqueue_scan_task(
    app: AppHandle,
    db: &Database,
    path: String,
    recursive: bool,
) -> DbResult<TaskRecord> {
    let clean_path = path.trim().to_string();
    if clean_path.is_empty() {
        return Err(DbError::validation("scan path is required"));
    }

    let payload = serde_json::json!({ "path": clean_path, "recursive": recursive }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "library.scan",
        Some(format!("正在扫描 {clean_path}")),
        Some(payload),
        true,
    )?;
    db.upsert_scan_task_result(&task.id, &clean_path, recursive, &[])?;

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
            0.05,
            Some("正在读取目录".to_string()),
            None,
        );
        match scan_path_with_cancel(
            &app_handle,
            &db,
            &task_id,
            PathBuf::from(&clean_path),
            recursive,
        ) {
            Ok(Some(mut candidates)) => {
                let _ = mark_conflicts(&db, &mut candidates);
                let _ = db.upsert_scan_task_result(&task_id, &clean_path, recursive, &candidates);
                logger::log_info(
                    &paths,
                    "library.scan",
                    format!(
                        "scan completed: {} candidates under {}",
                        candidates.len(),
                        logger::redact_sensitive_text(&clean_path)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!("发现 {} 个候选游戏", candidates.len())),
                    None,
                );
            }
            Ok(None) => {
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "cancelled",
                    1.0,
                    Some("扫描已取消".to_string()),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "library.scan", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("扫描失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub fn import_scan_candidates(
    db: &Database,
    candidates: Vec<ImportCandidate>,
) -> DbResult<ImportScanReport> {
    let requested = candidates.len();
    let mut imported = Vec::new();
    let mut items = Vec::new();
    let mut added = 0usize;
    let mut merged = 0usize;
    let mut replaced = 0usize;
    let mut duplicated = 0usize;
    let mut skipped = 0usize;

    for candidate in candidates {
        let conflict = find_import_conflict(db, &candidate)?;
        let action = candidate
            .conflict_action
            .as_deref()
            .unwrap_or(if conflict.is_some() {
                "skip"
            } else {
                "duplicate"
            });

        match (conflict, action) {
            (Some(conflict), "skip") => {
                skipped += 1;
                items.push(import_item(
                    &candidate,
                    "skip",
                    None,
                    Some(&conflict),
                    "已跳过与现有记录冲突的候选",
                ));
                continue;
            }
            (Some(conflict), "merge") => {
                let game = merge_import_candidate(db, &candidate, &conflict.game_id)?;
                merged += 1;
                items.push(import_item(
                    &candidate,
                    "merge",
                    Some(&game),
                    Some(&conflict),
                    "已合并到现有记录",
                ));
                imported.push(game);
            }
            (Some(conflict), "replace") => {
                let game = replace_import_candidate(db, &candidate, &conflict.game_id)?;
                replaced += 1;
                items.push(import_item(
                    &candidate,
                    "replace",
                    Some(&game),
                    Some(&conflict),
                    "已替换现有数据库记录",
                ));
                imported.push(game);
            }
            (Some(conflict), "duplicate") => {
                if !candidate.allow_duplicate.unwrap_or(false) {
                    return Err(DbError::validation(format!(
                        "candidate conflicts with existing game: {} ({})",
                        conflict.title, conflict.reason
                    )));
                }
                let game = add_import_candidate(db, &candidate)?;
                duplicated += 1;
                items.push(import_item(
                    &candidate,
                    "duplicate",
                    Some(&game),
                    Some(&conflict),
                    "已作为副本导入",
                ));
                imported.push(game);
            }
            (Some(conflict), _) => {
                return Err(DbError::validation(format!(
                    "unsupported conflict action for {}: {action}",
                    conflict.title
                )));
            }
            (None, "skip") => {
                skipped += 1;
                items.push(import_item(
                    &candidate,
                    "skip",
                    None,
                    None,
                    "候选未冲突，仍被跳过",
                ));
                continue;
            }
            (None, _) => {
                let game = add_import_candidate(db, &candidate)?;
                added += 1;
                items.push(import_item(
                    &candidate,
                    "add",
                    Some(&game),
                    None,
                    "已新增游戏记录",
                ));
                imported.push(game);
            }
        }
    }

    Ok(ImportScanReport {
        requested,
        imported_count: imported.len(),
        added,
        merged,
        replaced,
        duplicated,
        skipped,
        imported,
        items,
    })
}

fn import_item(
    candidate: &ImportCandidate,
    action: &str,
    game: Option<&Game>,
    conflict: Option<&ScanConflict>,
    message: &str,
) -> ImportScanReportItem {
    ImportScanReportItem {
        candidate_title: candidate.title.clone(),
        install_path: candidate.install_path.clone(),
        action: action.to_string(),
        game_id: game.map(|item| item.id.clone()),
        target_title: game
            .map(|item| item.title.clone())
            .or_else(|| conflict.map(|item| item.title.clone())),
        conflict_reason: conflict.map(|item| item.reason.clone()),
        message: message.to_string(),
    }
}

fn add_import_candidate(db: &Database, candidate: &ImportCandidate) -> DbResult<Game> {
    game_service::add_game(
        db,
        AddGameInput {
            title: candidate.title.clone(),
            original_title: None,
            aliases: candidate.aliases.clone(),
            developer: None,
            publisher: None,
            brand: None,
            release_date: None,
            description: None,
            notes: None,
            tags: None,
            genres: Some(vec!["Visual Novel".to_string()]),
            rating: None,
            age_rating: None,
            play_status: Some("planned".to_string()),
            favorite: Some(false),
            hidden: Some(false),
            install_path: candidate.install_path.clone(),
            executable_path: candidate.executable_path.clone(),
            working_directory: Some(candidate.install_path.clone()),
            launch_args: None,
            cover_image: None,
            banner_image: None,
            background_image: None,
            vndb_id: None,
            bangumi_id: None,
            dlsite_id: None,
            fanza_id: None,
            ymgal_id: None,
        },
    )
}

fn merge_import_candidate(
    db: &Database,
    candidate: &ImportCandidate,
    conflict_game_id: &str,
) -> DbResult<Game> {
    if candidate
        .conflict_game_id
        .as_deref()
        .is_some_and(|expected| expected != conflict_game_id)
    {
        return Err(DbError::validation(
            "conflict target changed; rescan before merging",
        ));
    }

    let existing = db.get_game(conflict_game_id.to_string())?;
    let mut aliases = existing.aliases.clone();
    for alias in candidate
        .aliases
        .clone()
        .unwrap_or_default()
        .into_iter()
        .chain([existing.title.clone(), candidate.title.clone()])
    {
        let trimmed = alias.trim().to_string();
        if !trimmed.is_empty() && !aliases.iter().any(|item| item == &trimmed) {
            aliases.push(trimmed);
        }
    }

    game_service::update_game(
        db,
        conflict_game_id.to_string(),
        crate::db::models::UpdateGameInput {
            aliases: Some(aliases),
            install_path: Some(candidate.install_path.clone()),
            executable_path: candidate.executable_path.clone(),
            working_directory: Some(candidate.install_path.clone()),
            path_status: Some("unknown".to_string()),
            last_path_checked_at: Some(String::new()),
            ..Default::default()
        },
    )
}

fn replace_import_candidate(
    db: &Database,
    candidate: &ImportCandidate,
    conflict_game_id: &str,
) -> DbResult<Game> {
    if candidate
        .conflict_game_id
        .as_deref()
        .is_some_and(|expected| expected != conflict_game_id)
    {
        return Err(DbError::validation(
            "conflict target changed; rescan before replacing",
        ));
    }

    db.get_game(conflict_game_id.to_string())?;
    game_service::update_game(
        db,
        conflict_game_id.to_string(),
        crate::db::models::UpdateGameInput {
            title: Some(candidate.title.clone()),
            aliases: candidate.aliases.clone(),
            install_path: Some(candidate.install_path.clone()),
            executable_path: candidate.executable_path.clone(),
            working_directory: Some(candidate.install_path.clone()),
            path_status: Some("unknown".to_string()),
            last_path_checked_at: Some(String::new()),
            ..Default::default()
        },
    )
}

fn scan_path(root: PathBuf, recursive: bool) -> DbResult<Vec<ScanCandidate>> {
    if !root.exists() {
        return Err(DbError::path_not_found("scan path does not exist"));
    }

    let mut candidates = Vec::new();
    scan_dirs(&root, &root, recursive, 0, &mut candidates)?;
    Ok(candidates)
}

fn scan_path_with_cancel(
    app: &AppHandle,
    db: &Database,
    task_id: &str,
    root: PathBuf,
    recursive: bool,
) -> DbResult<Option<Vec<ScanCandidate>>> {
    if !root.exists() {
        return Err(DbError::path_not_found("scan path does not exist"));
    }

    let mut candidates = Vec::new();
    let context = ScanTaskContext {
        app,
        db,
        task_id,
        recursive,
    };
    scan_dirs_with_cancel(&context, &root, &root, 0, &mut candidates)?;
    if is_task_cancelled(db, task_id) {
        Ok(None)
    } else {
        Ok(Some(candidates))
    }
}

fn scan_dirs(
    root: &Path,
    current: &Path,
    recursive: bool,
    depth: usize,
    candidates: &mut Vec<ScanCandidate>,
) -> DbResult<()> {
    if depth > 3 {
        return Ok(());
    }

    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let executables = find_executables(&path)?;
        if !executables.is_empty() {
            let folder_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_string();
            candidates.push(ScanCandidate {
                id: Uuid::new_v4().to_string(),
                root_path: root.to_string_lossy().to_string(),
                install_path: path.to_string_lossy().to_string(),
                folder_name: folder_name.clone(),
                suggested_title: clean_title(&folder_name),
                aliases: vec![folder_name],
                selected_executable: executables.first().map(|item| item.path.clone()),
                executables,
                conflict: None,
            });
        } else if recursive {
            scan_dirs(root, &path, recursive, depth + 1, candidates)?;
        }
    }

    Ok(())
}

struct ScanTaskContext<'a> {
    app: &'a AppHandle,
    db: &'a Database,
    task_id: &'a str,
    recursive: bool,
}

fn scan_dirs_with_cancel(
    context: &ScanTaskContext<'_>,
    root: &Path,
    current: &Path,
    depth: usize,
    candidates: &mut Vec<ScanCandidate>,
) -> DbResult<()> {
    if depth > 3 || is_task_cancelled(context.db, context.task_id) {
        return Ok(());
    }

    for entry in fs::read_dir(current)? {
        if is_task_cancelled(context.db, context.task_id) {
            return Ok(());
        }

        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let executables = find_executables(&path)?;
        if !executables.is_empty() {
            let folder_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or_default()
                .to_string();
            candidates.push(ScanCandidate {
                id: Uuid::new_v4().to_string(),
                root_path: root.to_string_lossy().to_string(),
                install_path: path.to_string_lossy().to_string(),
                folder_name: folder_name.clone(),
                suggested_title: clean_title(&folder_name),
                aliases: vec![folder_name],
                selected_executable: executables.first().map(|item| item.path.clone()),
                executables,
                conflict: None,
            });
            let progress = (0.08 + (candidates.len() as f64 * 0.025)).min(0.92);
            let _ = tasks::update_task(
                context.app,
                context.db,
                context.task_id,
                "running",
                progress,
                Some(format!("已发现 {} 个候选游戏", candidates.len())),
                None,
            );
        } else if context.recursive {
            scan_dirs_with_cancel(context, root, &path, depth + 1, candidates)?;
        }
    }

    Ok(())
}

fn mark_conflicts(db: &Database, candidates: &mut [ScanCandidate]) -> DbResult<()> {
    let rows = db.list_scan_conflict_rows()?;
    for candidate in candidates {
        candidate.conflict = find_candidate_conflict(&rows, candidate);
    }
    Ok(())
}

fn find_import_conflict(
    db: &Database,
    candidate: &ImportCandidate,
) -> DbResult<Option<ScanConflict>> {
    let rows = db.list_scan_conflict_rows()?;
    let probe = ScanCandidate {
        id: String::new(),
        root_path: String::new(),
        install_path: candidate.install_path.clone(),
        folder_name: candidate.title.clone(),
        suggested_title: candidate.title.clone(),
        aliases: candidate.aliases.clone().unwrap_or_default(),
        selected_executable: candidate.executable_path.clone(),
        executables: Vec::new(),
        conflict: None,
    };
    Ok(find_candidate_conflict(&rows, &probe))
}

fn find_candidate_conflict(
    rows: &[ScanConflictRow],
    candidate: &ScanCandidate,
) -> Option<ScanConflict> {
    let candidate_install = normalize_path(&candidate.install_path);
    let candidate_exe = candidate.selected_executable.as_deref().map(normalize_path);
    let candidate_title = normalize_title(&candidate.suggested_title);

    for row in rows {
        if normalize_path(&row.install_path) == candidate_install {
            return Some(conflict(row, "安装目录已存在"));
        }
        if let (Some(game_exe), Some(candidate_exe)) = (
            row.executable_path.as_deref().map(normalize_path),
            candidate_exe.as_ref(),
        ) {
            if &game_exe == candidate_exe {
                return Some(conflict(row, "启动程序已存在"));
            }
        }
        if !candidate_title.is_empty() && normalize_title(&row.title) == candidate_title {
            return Some(conflict(row, "标题相同"));
        }
    }

    None
}

fn conflict(row: &ScanConflictRow, reason: &str) -> ScanConflict {
    ScanConflict {
        game_id: row.id.clone(),
        title: row.title.clone(),
        reason: reason.to_string(),
    }
}

fn normalize_path(path: &str) -> String {
    path.trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
        .to_lowercase()
}

fn normalize_title(title: &str) -> String {
    title
        .trim()
        .to_lowercase()
        .replace([' ', '　', '-', '_'], "")
}

fn is_task_cancelled(db: &Database, task_id: &str) -> bool {
    db.get_task(task_id)
        .map(|task| task.status == "cancelled")
        .unwrap_or(false)
}

fn find_executables(dir: &Path) -> DbResult<Vec<ScanExecutable>> {
    let mut result = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if matches!(extension.as_str(), "exe" | "bat" | "lnk") {
            result.push(ScanExecutable {
                name: path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default()
                    .to_string(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

fn clean_title(value: &str) -> String {
    let mut title = value.to_string();
    for token in [
        "汉化硬盘版",
        "汉化版",
        "硬盘版",
        "绿色版",
        "破解版",
        "中文版",
        "日本語版",
    ] {
        title = title.replace(token, "");
    }

    title = strip_bracket_prefixes(&title);
    title = title.replace("  ", " ");
    title.trim_matches([' ', '-', '_', '　']).to_string()
}

fn strip_bracket_prefixes(value: &str) -> String {
    let mut chars = value.chars().peekable();
    loop {
        while matches!(chars.peek(), Some(' ') | Some('　')) {
            chars.next();
        }

        let Some(open) = chars.peek().copied() else {
            break;
        };
        let close = match open {
            '[' => ']',
            '【' => '】',
            '(' => ')',
            '（' => '）',
            _ => break,
        };

        chars.next();
        for current in chars.by_ref() {
            if current == close {
                break;
            }
        }
    }
    chars.collect()
}

#[cfg(test)]
mod tests;
