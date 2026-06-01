use std::path::Path;
use std::thread;

use chrono::Utc;
use tauri::AppHandle;

use crate::db::models::{Game, GamePathHealth, PathCheckItem, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

pub fn check_game_paths(db: &Database, id: String) -> DbResult<GamePathHealth> {
    run_path_check(db, &id)
}

pub(crate) fn enqueue_path_check_task(
    app: AppHandle,
    db: &Database,
    id: String,
) -> DbResult<TaskRecord> {
    let game_id = id.trim().to_string();
    if game_id.is_empty() {
        return Err(DbError::validation("game id is required"));
    }

    let game = db.get_game(game_id.clone())?;
    let payload = serde_json::json!({ "gameId": game_id }).to_string();
    let task = tasks::create_task_with_payload(
        &app,
        db,
        "game.path_check",
        Some(format!("正在检查路径：{}", game.title)),
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
            0.25,
            Some("正在验证安装目录与启动程序".to_string()),
            None,
        );
        match run_path_check(&db, &game_id) {
            Ok(health) => {
                for item in &health.items {
                    let level = if item.status == "ok" { "info" } else { "warn" };
                    let path = item.path.as_deref().unwrap_or("未配置");
                    let _ = db.append_task_log(
                        &task_id,
                        level,
                        &format!(
                            "{}：{}（{}）",
                            item.label,
                            path_status_label(&item.status),
                            path
                        ),
                    );
                }
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(path_health_message(&health.status).to_string()),
                    None,
                );
            }
            Err(error) => {
                let _ = db.append_task_log(&task_id, "error", &error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("路径检查失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

pub fn relocate_game_paths(db: &Database, id: String, install_path: String) -> DbResult<Game> {
    let game_id = id;
    let mut game = db.get_game(game_id.clone())?;
    let install_path = trimmed_required(install_path, "installPath")?;
    let meta = std::fs::metadata(&install_path)?;
    if !meta.is_dir() {
        return Err(DbError::path_not_found(
            "install path must be an existing directory",
        ));
    }

    let old_install = game.install_path.clone();
    let new_install = install_path.clone();
    let replace_prefix = |value: Option<String>| -> Option<String> {
        value.map(|item| {
            if item.starts_with(&old_install) {
                item.replacen(&old_install, &new_install, 1)
            } else {
                item
            }
        })
    };

    game.install_path = install_path;
    game.executable_path = replace_prefix(game.executable_path);
    game.working_directory =
        replace_prefix(game.working_directory).or_else(|| Some(game.install_path.clone()));
    game.path_status = "unknown".to_string();
    game.last_path_checked_at = None;
    game.updated_at = Utc::now().to_rfc3339();

    db.update_relocated_game_paths(&game)?;
    db.update_relocated_launch_profile_paths(
        &game_id,
        &old_install,
        &game.install_path,
        &game.updated_at,
    )?;

    db.get_game(game_id)
}

fn check_path(kind: &str, label: &str, path: Option<String>, should_be_dir: bool) -> PathCheckItem {
    let Some(path) = path.filter(|item| !item.trim().is_empty()) else {
        return PathCheckItem {
            kind: kind.to_string(),
            label: label.to_string(),
            path: None,
            status: "not_configured".to_string(),
            message: Some("未配置".to_string()),
        };
    };

    let fs_path = Path::new(&path);
    let exists = fs_path.exists();
    let valid_kind = if should_be_dir {
        fs_path.is_dir()
    } else {
        fs_path.is_file()
    };
    if exists && valid_kind {
        PathCheckItem {
            kind: kind.to_string(),
            label: label.to_string(),
            path: Some(path),
            status: "ok".to_string(),
            message: None,
        }
    } else if exists {
        PathCheckItem {
            kind: kind.to_string(),
            label: label.to_string(),
            path: Some(path),
            status: "wrong_type".to_string(),
            message: Some("路径类型不符合预期".to_string()),
        }
    } else {
        PathCheckItem {
            kind: kind.to_string(),
            label: label.to_string(),
            path: Some(path),
            status: "missing".to_string(),
            message: Some("路径不存在".to_string()),
        }
    }
}

fn run_path_check(db: &Database, id: &str) -> DbResult<GamePathHealth> {
    let game = db.get_game(id.to_string())?;
    let health = build_path_health(&game);
    db.set_game_path_health(id, &health.status, &health.checked_at)?;
    Ok(health)
}

fn build_path_health(game: &Game) -> GamePathHealth {
    let checked_at = Utc::now().to_rfc3339();
    let items = vec![
        check_path("install", "安装目录", Some(game.install_path.clone()), true),
        check_path(
            "executable",
            "启动程序",
            game.executable_path.clone(),
            false,
        ),
        check_path(
            "workingDirectory",
            "工作目录",
            game.working_directory.clone(),
            true,
        ),
    ];

    let status = if items
        .iter()
        .any(|item| item.status == "missing" || item.status == "wrong_type")
    {
        "broken"
    } else if items.iter().any(|item| item.status == "not_configured") {
        "incomplete"
    } else {
        "ok"
    }
    .to_string();

    GamePathHealth {
        game_id: game.id.clone(),
        status,
        checked_at,
        items,
    }
}

fn path_health_message(status: &str) -> &'static str {
    match status {
        "ok" => "路径检查完成，所有关键路径可用。",
        "incomplete" => "路径检查完成，有部分路径尚未配置。",
        "broken" => "路径检查完成，发现不可用路径。",
        _ => "路径检查完成。",
    }
}

fn path_status_label(status: &str) -> &'static str {
    match status {
        "ok" => "正常",
        "missing" => "不存在",
        "wrong_type" => "类型不符",
        "not_configured" => "未配置",
        _ => "未知",
    }
}

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    fn test_game(
        install_path: String,
        executable_path: Option<String>,
        working_directory: Option<String>,
    ) -> Game {
        Game {
            id: "game-1".to_string(),
            title: "Path Test".to_string(),
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
            install_path,
            executable_path,
            working_directory,
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

    #[test]
    fn path_health_marks_wrong_type_as_broken() {
        let root = std::env::temp_dir().join(format!("mikavn-path-health-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let exe = root.join("game.exe");
        fs::write(&exe, b"mock").unwrap();

        let game = test_game(
            exe.to_string_lossy().to_string(),
            Some(root.to_string_lossy().to_string()),
            Some(root.to_string_lossy().to_string()),
        );
        let health = build_path_health(&game);

        assert_eq!(health.status, "broken");
        assert!(health
            .items
            .iter()
            .any(|item| item.kind == "install" && item.status == "wrong_type"));
        assert!(health
            .items
            .iter()
            .any(|item| item.kind == "executable" && item.status == "wrong_type"));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn path_health_marks_missing_optional_paths_as_incomplete() {
        let root = std::env::temp_dir().join(format!("mikavn-path-health-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();

        let game = test_game(root.to_string_lossy().to_string(), None, None);
        let health = build_path_health(&game);

        assert_eq!(health.status, "incomplete");
        assert!(health
            .items
            .iter()
            .any(|item| item.kind == "executable" && item.status == "not_configured"));

        let _ = fs::remove_dir_all(&root);
    }
}
