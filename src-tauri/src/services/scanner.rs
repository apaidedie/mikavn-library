use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

use tauri::AppHandle;
use uuid::Uuid;

use crate::db::models::{
    AddGameInput, Game, GameFilter, ImportCandidate, ImportScanReport, ImportScanReportItem,
    LibraryRoot, ScanCandidate, ScanConflict, ScanExecutable, ScanTaskStatus, TaskRecord,
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
    let games = db.list_games(GameFilter::default())?;
    for candidate in candidates {
        candidate.conflict = find_candidate_conflict(&games, candidate);
    }
    Ok(())
}

fn find_import_conflict(
    db: &Database,
    candidate: &ImportCandidate,
) -> DbResult<Option<ScanConflict>> {
    let games = db.list_games(GameFilter::default())?;
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
    Ok(find_candidate_conflict(&games, &probe))
}

fn find_candidate_conflict(games: &[Game], candidate: &ScanCandidate) -> Option<ScanConflict> {
    let candidate_install = normalize_path(&candidate.install_path);
    let candidate_exe = candidate.selected_executable.as_deref().map(normalize_path);
    let candidate_title = normalize_title(&candidate.suggested_title);

    for game in games {
        if normalize_path(&game.install_path) == candidate_install {
            return Some(conflict(game, "安装目录已存在"));
        }
        if let (Some(game_exe), Some(candidate_exe)) = (
            game.executable_path.as_deref().map(normalize_path),
            candidate_exe.as_ref(),
        ) {
            if &game_exe == candidate_exe {
                return Some(conflict(game, "启动程序已存在"));
            }
        }
        if !candidate_title.is_empty() && normalize_title(&game.title) == candidate_title {
            return Some(conflict(game, "标题相同"));
        }
    }

    None
}

fn conflict(game: &Game, reason: &str) -> ScanConflict {
    ScanConflict {
        game_id: game.id.clone(),
        title: game.title.clone(),
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
mod tests {
    use super::*;

    fn game(id: &str, title: &str, install_path: &str, executable_path: Option<&str>) -> Game {
        Game {
            id: id.to_string(),
            title: title.to_string(),
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
            install_path: install_path.to_string(),
            executable_path: executable_path.map(ToString::to_string),
            working_directory: Some(install_path.to_string()),
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

    fn candidate(title: &str, install_path: &str, executable_path: Option<&str>) -> ScanCandidate {
        ScanCandidate {
            id: "candidate".to_string(),
            root_path: "D:\\Games".to_string(),
            install_path: install_path.to_string(),
            folder_name: title.to_string(),
            suggested_title: title.to_string(),
            aliases: vec![title.to_string()],
            executables: Vec::new(),
            selected_executable: executable_path.map(ToString::to_string),
            conflict: None,
        }
    }

    #[test]
    fn detects_install_path_conflict() {
        let games = vec![game("game-1", "星之终途", "D:\\Games\\星之终途", None)];
        let conflict = find_candidate_conflict(
            &games,
            &candidate("星之终途 汉化版", "D:/Games/星之终途/", None),
        )
        .unwrap();
        assert_eq!(conflict.reason, "安装目录已存在");
    }

    #[test]
    fn detects_title_conflict() {
        let games = vec![game(
            "game-1",
            "天使☆騒々 RE-BOOT!",
            "D:\\Games\\Yuzu\\Tenshi",
            None,
        )];
        let conflict = find_candidate_conflict(
            &games,
            &candidate("天使☆騒々 RE-BOOT!", "D:\\Games\\Other", None),
        )
        .unwrap();
        assert_eq!(conflict.reason, "标题相同");
    }

    fn import_candidate(
        title: &str,
        install_path: &str,
        action: Option<&str>,
        conflict_game_id: Option<String>,
    ) -> ImportCandidate {
        ImportCandidate {
            title: title.to_string(),
            install_path: install_path.to_string(),
            executable_path: Some(format!("{}\\game.exe", install_path)),
            aliases: Some(vec![format!("{title} folder")]),
            allow_duplicate: Some(action == Some("duplicate")),
            conflict_action: action.map(ToString::to_string),
            conflict_game_id,
        }
    }

    fn test_db(name: &str) -> Database {
        let path =
            std::env::temp_dir().join(format!("mikavn-scanner-test-{name}-{}.db", Uuid::new_v4()));
        Database::new_from_path(path).unwrap()
    }

    fn add_game_input(title: &str, install_path: &str) -> AddGameInput {
        AddGameInput {
            title: title.to_string(),
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
            install_path: install_path.to_string(),
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
        }
    }

    #[test]
    fn merge_import_candidate_updates_existing_record_paths() {
        let db = test_db("merge");
        let existing = db
            .add_game(AddGameInput {
                executable_path: Some("D:\\Old\\星之终途\\old.exe".to_string()),
                aliases: Some(vec!["終のステラ".to_string()]),
                ..add_game_input("星之终途", "D:\\Old\\星之终途")
            })
            .unwrap();

        let updated = merge_import_candidate(
            &db,
            &import_candidate(
                "星之终途",
                "D:\\New\\星之终途",
                Some("merge"),
                Some(existing.id.clone()),
            ),
            &existing.id,
        )
        .unwrap();

        assert_eq!(updated.install_path, "D:\\New\\星之终途");
        assert_eq!(
            updated.executable_path.as_deref(),
            Some("D:\\New\\星之终途\\game.exe")
        );
        assert!(updated.aliases.contains(&"終のステラ".to_string()));
        assert!(updated.aliases.contains(&"星之终途 folder".to_string()));
    }

    #[test]
    fn merge_rejects_stale_conflict_target() {
        let db = test_db("stale-target");

        let err = merge_import_candidate(
            &db,
            &import_candidate(
                "星之终途",
                "D:\\New\\星之终途",
                Some("merge"),
                Some("other-game".to_string()),
            ),
            "game-1",
        )
        .unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[test]
    fn replace_import_candidate_overwrites_database_record_only() {
        let db = test_db("replace");
        let existing = db
            .add_game(AddGameInput {
                executable_path: Some("D:\\Old\\old.exe".to_string()),
                aliases: Some(vec!["old alias".to_string()]),
                ..add_game_input("旧标题", "D:\\Old")
            })
            .unwrap();

        let updated = replace_import_candidate(
            &db,
            &import_candidate(
                "新标题",
                "D:\\New",
                Some("replace"),
                Some(existing.id.clone()),
            ),
            &existing.id,
        )
        .unwrap();

        assert_eq!(updated.id, existing.id);
        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.install_path, "D:\\New");
        assert_eq!(
            updated.executable_path.as_deref(),
            Some("D:\\New\\game.exe")
        );
        assert!(!updated.aliases.contains(&"old alias".to_string()));
    }

    #[test]
    fn replace_rejects_stale_conflict_target() {
        let db = test_db("replace-stale-target");
        let existing = db.add_game(add_game_input("旧标题", "D:\\Old")).unwrap();

        let err = replace_import_candidate(
            &db,
            &import_candidate(
                "新标题",
                "D:\\New",
                Some("replace"),
                Some("other-game".to_string()),
            ),
            &existing.id,
        )
        .unwrap_err();

        assert_eq!(err.code, "VALIDATION_ERROR");
    }

    #[test]
    fn import_scan_candidates_handles_mixed_conflict_actions() {
        let db = test_db("mixed-actions");
        let skip_existing = db
            .add_game(add_game_input("Skip Existing", "D:\\Games\\Skip"))
            .unwrap();
        let merge_existing = db
            .add_game(AddGameInput {
                aliases: Some(vec!["merge old".to_string()]),
                executable_path: Some("D:\\Games\\MergeOld\\old.exe".to_string()),
                ..add_game_input("Merge Existing", "D:\\Games\\MergeOld")
            })
            .unwrap();
        let replace_existing = db
            .add_game(AddGameInput {
                aliases: Some(vec!["replace old".to_string()]),
                executable_path: Some("D:\\Games\\ReplaceOld\\game.exe".to_string()),
                ..add_game_input("Replace Existing", "D:\\Games\\ReplaceOld")
            })
            .unwrap();
        let duplicate_existing = db
            .add_game(add_game_input("Duplicate Existing", "D:\\Games\\Duplicate"))
            .unwrap();

        let report = import_scan_candidates(
            &db,
            vec![
                import_candidate(
                    "Skip Existing",
                    "D:\\Games\\Skip",
                    Some("skip"),
                    Some(skip_existing.id.clone()),
                ),
                import_candidate(
                    "Merge Existing",
                    "D:\\Games\\MergeNew",
                    Some("merge"),
                    Some(merge_existing.id.clone()),
                ),
                ImportCandidate {
                    title: "Replace New Title".to_string(),
                    install_path: "D:\\Games\\ReplaceNew".to_string(),
                    executable_path: Some("D:\\Games\\ReplaceOld\\game.exe".to_string()),
                    aliases: Some(vec!["Replace New Title folder".to_string()]),
                    allow_duplicate: Some(false),
                    conflict_action: Some("replace".to_string()),
                    conflict_game_id: Some(replace_existing.id.clone()),
                },
                import_candidate(
                    "Duplicate Existing",
                    "D:\\Games\\Duplicate",
                    Some("duplicate"),
                    Some(duplicate_existing.id.clone()),
                ),
                import_candidate("Fresh Import", "D:\\Games\\Fresh", None, None),
            ],
        )
        .unwrap();

        assert_eq!(report.requested, 5);
        assert_eq!(report.imported_count, 4);
        assert_eq!(report.added, 1);
        assert_eq!(report.merged, 1);
        assert_eq!(report.replaced, 1);
        assert_eq!(report.duplicated, 1);
        assert_eq!(report.skipped, 1);
        assert_eq!(report.items.len(), 5);
        assert!(report
            .items
            .iter()
            .any(|item| item.action == "skip"
                && item.target_title.as_deref() == Some("Skip Existing")));
        assert!(report
            .items
            .iter()
            .any(|item| item.action == "merge"
                && item.conflict_reason.as_deref() == Some("标题相同")));
        assert!(report
            .items
            .iter()
            .any(|item| item.action == "add" && item.candidate_title == "Fresh Import"));
        assert!(!report
            .imported
            .iter()
            .any(|game| game.id == skip_existing.id));

        let merged = db.get_game(merge_existing.id.clone()).unwrap();
        assert_eq!(merged.install_path, "D:\\Games\\MergeNew");
        assert!(merged.aliases.contains(&"merge old".to_string()));
        assert!(merged
            .aliases
            .contains(&"Merge Existing folder".to_string()));

        let replaced = db.get_game(replace_existing.id.clone()).unwrap();
        assert_eq!(replaced.title, "Replace New Title");
        assert_eq!(replaced.install_path, "D:\\Games\\ReplaceNew");
        assert!(!replaced.aliases.contains(&"replace old".to_string()));

        let all = db.list_games(GameFilter::default()).unwrap();
        assert_eq!(all.len(), 6);
        assert_eq!(
            all.iter()
                .filter(|game| game.install_path == "D:\\Games\\Duplicate")
                .count(),
            2
        );
        assert!(all.iter().any(|game| game.title == "Fresh Import"));
    }

    #[test]
    fn import_scan_report_includes_auditable_item_details() {
        let db = test_db("auditable-report-details");
        let existing = db
            .add_game(add_game_input("Audit Existing", "D:\\Games\\AuditOld"))
            .unwrap();

        let report = import_scan_candidates(
            &db,
            vec![
                import_candidate(
                    "Audit Existing",
                    "D:\\Games\\AuditNew",
                    Some("merge"),
                    Some(existing.id.clone()),
                ),
                import_candidate("Fresh Audit", "D:\\Games\\FreshAudit", None, None),
            ],
        )
        .unwrap();

        let merged = report
            .items
            .iter()
            .find(|item| item.action == "merge")
            .expect("merge audit item");
        assert_eq!(merged.candidate_title, "Audit Existing");
        assert_eq!(merged.install_path, "D:\\Games\\AuditNew");
        assert_eq!(merged.game_id.as_deref(), Some(existing.id.as_str()));
        assert_eq!(merged.target_title.as_deref(), Some("Audit Existing"));
        assert_eq!(merged.conflict_reason.as_deref(), Some("标题相同"));
        assert_eq!(merged.message, "已合并到现有记录");

        let added = report
            .items
            .iter()
            .find(|item| item.action == "add")
            .expect("add audit item");
        assert_eq!(added.candidate_title, "Fresh Audit");
        assert_eq!(added.install_path, "D:\\Games\\FreshAudit");
        assert!(added.game_id.is_some());
        assert_eq!(added.target_title.as_deref(), Some("Fresh Audit"));
        assert!(added.conflict_reason.is_none());
        assert_eq!(added.message, "已新增游戏记录");
    }

    #[test]
    fn local_windows_workflow_scans_imports_backs_up_and_validates_paths() {
        let root = std::env::temp_dir().join(format!("mikavn-local-workflow-{}", Uuid::new_v4()));
        let library = root.join("library");
        let game_dir = library.join("[240101][QA Circle] Local Workflow VN");
        let exe = game_dir.join("LocalWorkflow.exe");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(&exe, b"fake exe for local workflow smoke").unwrap();

        let db_path = root.join("mikavn.db");
        let db = Database::new_from_path(db_path.clone()).unwrap();
        let candidates = scan_path_preview(&db, library.to_string_lossy().to_string(), true).unwrap();
        let candidate = candidates
            .iter()
            .find(|item| item.install_path == game_dir.to_string_lossy())
            .expect("scanned local workflow candidate");
        assert_eq!(candidate.suggested_title, "Local Workflow VN");
        assert_eq!(
            candidate.selected_executable.as_deref(),
            Some(exe.to_string_lossy().as_ref())
        );

        let report = import_scan_candidates(
            &db,
            vec![ImportCandidate {
                title: candidate.suggested_title.clone(),
                install_path: candidate.install_path.clone(),
                executable_path: candidate.selected_executable.clone(),
                aliases: Some(candidate.aliases.clone()),
                allow_duplicate: Some(false),
                conflict_action: None,
                conflict_game_id: None,
            }],
        )
        .unwrap();
        assert_eq!(report.imported_count, 1);
        assert_eq!(db.list_games(GameFilter::default()).unwrap().len(), 1);

        let backup = root.join("backups").join("manual.db");
        db.backup_to_path(&backup).unwrap();
        assert!(backup.is_file());
        assert!(backup.metadata().unwrap().len() > 0);

        assert!(validate_reveal_target(&game_dir).is_ok());
        assert_eq!(
            validate_reveal_target(&root.join("missing")).unwrap_err().code,
            "PATH_NOT_FOUND"
        );

        let _ = fs::remove_dir_all(root);
    }

    fn validate_reveal_target(path: &Path) -> DbResult<()> {
        if path.as_os_str().is_empty() {
            return Err(DbError::validation("path is required"));
        }
        if !path.exists() {
            return Err(DbError::path_not_found("path does not exist"));
        }
        Ok(())
    }
}
