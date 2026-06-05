use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use tauri::AppHandle;

use crate::db::DbResult;
use crate::infrastructure::paths::AppPaths;
use crate::services::backups;
use crate::services::images;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryStats {
    pub path: String,
    pub exists: bool,
    pub file_count: i64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseHealth {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub user_version: Option<i64>,
    pub quick_check: Option<String>,
    pub quick_check_ok: bool,
    pub foreign_key_issues: i64,
    pub game_count: i64,
    pub asset_count: i64,
    pub image_refs_count: i64,
    pub local_image_refs_count: i64,
    pub missing_image_refs_count: i64,
    pub c_drive_image_refs_count: i64,
    pub playnite_image_refs_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataDiagnostics {
    pub app_data_dir: String,
    pub data_dir_source: String,
    pub database: DatabaseHealth,
    pub images: DirectoryStats,
    pub cache: DirectoryStats,
    pub logs: DirectoryStats,
    pub save_backups: DirectoryStats,
    pub database_backups: backups::DatabaseBackupSummary,
    pub warnings: Vec<String>,
}

pub fn get_app_data_diagnostics(app: &AppHandle) -> DbResult<AppDataDiagnostics> {
    let resolution = AppPaths::resolve_from_app(app)?;
    let data_dir_source = resolution.source.as_str().to_string();
    let paths = AppPaths::from_root(resolution.root)?;
    get_app_data_diagnostics_with_paths(&paths, data_dir_source)
}

fn get_app_data_diagnostics_with_paths(
    paths: &AppPaths,
    data_dir_source: String,
) -> DbResult<AppDataDiagnostics> {
    let database = database_health(paths)?;
    let images = directory_stats(&paths.images())?;
    let cache = directory_stats(&paths.cache())?;
    let logs = directory_stats(&paths.logs())?;
    let save_backups = directory_stats(&paths.save_backups())?;
    let database_backups = backups::database_backup_summary(paths)?;
    let mut warnings = Vec::new();

    let root_text = paths.root().to_string_lossy().to_string();
    if looks_like_c_drive_path(&root_text) {
        warnings.push("当前应用数据目录仍在 C 盘。".to_string());
    }
    if !database.exists {
        warnings.push("未找到 mikavn.db。".to_string());
    } else if !database.quick_check_ok {
        warnings.push(format!(
            "数据库 quick_check 异常：{}",
            database.quick_check.as_deref().unwrap_or("unknown")
        ));
    }
    if database.foreign_key_issues > 0 {
        warnings.push(format!(
            "数据库存在 {} 条外键检查问题。",
            database.foreign_key_issues
        ));
    }
    if database.missing_image_refs_count > 0 {
        warnings.push(format!(
            "有 {} 条本地图片引用找不到文件。",
            database.missing_image_refs_count
        ));
    }
    if database.c_drive_image_refs_count > 0 {
        warnings.push(format!(
            "有 {} 条图片引用仍指向 C 盘。",
            database.c_drive_image_refs_count
        ));
    }
    if database.playnite_image_refs_count > 0 {
        warnings.push(format!(
            "有 {} 条图片引用仍包含 Playnite 路径。",
            database.playnite_image_refs_count
        ));
    }

    Ok(AppDataDiagnostics {
        app_data_dir: root_text,
        data_dir_source,
        database,
        images,
        cache,
        logs,
        save_backups,
        database_backups,
        warnings,
    })
}

fn database_health(paths: &AppPaths) -> DbResult<DatabaseHealth> {
    let database_path = paths.database();
    let exists = database_path.is_file();
    let size_bytes = fs::metadata(&database_path)
        .map(|item| item.len())
        .unwrap_or(0);
    let mut health = DatabaseHealth {
        path: database_path.to_string_lossy().to_string(),
        exists,
        size_bytes,
        user_version: None,
        quick_check: None,
        quick_check_ok: false,
        foreign_key_issues: 0,
        game_count: 0,
        asset_count: 0,
        image_refs_count: 0,
        local_image_refs_count: 0,
        missing_image_refs_count: 0,
        c_drive_image_refs_count: 0,
        playnite_image_refs_count: 0,
    };
    if !exists {
        return Ok(health);
    }

    let conn = Connection::open_with_flags(&database_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    health.user_version = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .ok();
    let quick_check = conn.query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))?;
    health.quick_check_ok = quick_check == "ok";
    health.quick_check = Some(quick_check);
    health.foreign_key_issues = pragma_row_count(&conn, "PRAGMA foreign_key_check")?;
    health.game_count = table_count(&conn, "games")?;
    health.asset_count = table_count(&conn, "game_assets")?;

    let image_refs = image_references(&conn)?;
    health.image_refs_count = image_refs.len() as i64;
    for value in image_refs {
        if looks_like_c_drive_path(&value) {
            health.c_drive_image_refs_count += 1;
        }
        if looks_like_playnite_path(&value) {
            health.playnite_image_refs_count += 1;
        }
        if is_local_file_ref(&value) {
            health.local_image_refs_count += 1;
            if !PathBuf::from(value.trim()).is_file() {
                health.missing_image_refs_count += 1;
            }
        }
    }

    Ok(health)
}

fn directory_stats(path: &Path) -> DbResult<DirectoryStats> {
    let mut stats = DirectoryStats {
        path: path.to_string_lossy().to_string(),
        exists: path.exists(),
        file_count: 0,
        total_bytes: 0,
    };
    if stats.exists {
        scan_directory(path, &mut stats)?;
    }
    Ok(stats)
}

fn scan_directory(path: &Path, stats: &mut DirectoryStats) -> DbResult<()> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_dir() {
            scan_directory(&path, stats)?;
        } else if file_type.is_file() {
            stats.file_count += 1;
            stats.total_bytes += entry.metadata()?.len();
        }
    }
    Ok(())
}

fn pragma_row_count(conn: &Connection, sql: &str) -> DbResult<i64> {
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query([])?;
    let mut count = 0;
    while rows.next()?.is_some() {
        count += 1;
    }
    Ok(count)
}

fn table_count(conn: &Connection, table: &str) -> DbResult<i64> {
    if !table_exists(conn, table)? {
        return Ok(0);
    }
    let sql = format!("SELECT COUNT(*) FROM {table}");
    Ok(conn.query_row(&sql, [], |row| row.get::<_, i64>(0))?)
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

fn image_references(conn: &Connection) -> DbResult<Vec<String>> {
    let mut refs = Vec::new();
    if table_exists(conn, "games")? {
        for column in ["cover_image", "banner_image", "background_image"] {
            if column_exists(conn, "games", column)? {
                collect_string_column(conn, &format!("SELECT {column} FROM games"), &mut refs)?;
            }
        }
    }
    if table_exists(conn, "game_assets")? && column_exists(conn, "game_assets", "uri")? {
        collect_string_column(conn, "SELECT uri FROM game_assets", &mut refs)?;
    }
    Ok(refs)
}

fn collect_string_column(conn: &Connection, sql: &str, refs: &mut Vec<String>) -> DbResult<()> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, Option<String>>(0))?;
    for value in rows {
        if let Some(value) = value? {
            let value = value.trim().to_string();
            if !value.is_empty() {
                refs.push(value);
            }
        }
    }
    Ok(())
}

fn is_local_file_ref(value: &str) -> bool {
    let value = value.trim();
    !value.is_empty()
        && !images::is_remote_url(value)
        && !value.starts_with("data:")
        && !value.starts_with("asset:")
}

fn looks_like_c_drive_path(value: &str) -> bool {
    let lower = normalize_path(value);
    lower.starts_with("c:\\") || lower.starts_with("c:/")
}

fn looks_like_playnite_path(value: &str) -> bool {
    let lower = normalize_path(value);
    lower.contains("\\playnite\\")
        || lower.contains("/playnite/")
        || lower.starts_with("d:\\playnite")
        || lower.starts_with("d:/playnite")
}

fn normalize_path(value: &str) -> String {
    value.trim().to_lowercase()
}

#[allow(dead_code)]
fn _format_time(time: std::time::SystemTime) -> String {
    DateTime::<Utc>::from(time).to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use uuid::Uuid;

    #[test]
    fn diagnostics_counts_missing_and_legacy_image_refs() {
        let root = std::env::temp_dir().join(format!("mikavn-diagnostics-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.join("app-data")).unwrap();

        let conn = Connection::open(paths.database()).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT
            );
            CREATE TABLE game_assets (
              id TEXT PRIMARY KEY,
              game_id TEXT NOT NULL,
              uri TEXT NOT NULL
            );
            INSERT INTO games (id, title, cover_image, banner_image, background_image)
            VALUES ('game', 'VN', 'https://example.com/cover.png', 'C:\Users\tester\cover.png', 'D:\Playnite\bg.jpg');
            INSERT INTO game_assets (id, game_id, uri) VALUES ('asset', 'game', 'E:\missing.png');
            "#,
        )
        .unwrap();

        let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

        assert_eq!(diagnostics.database.game_count, 1);
        assert_eq!(diagnostics.database.asset_count, 1);
        assert_eq!(diagnostics.database.image_refs_count, 4);
        assert_eq!(diagnostics.database.c_drive_image_refs_count, 1);
        assert_eq!(diagnostics.database.playnite_image_refs_count, 1);
        assert_eq!(diagnostics.database.missing_image_refs_count, 3);
        assert!(!diagnostics.warnings.is_empty());
        let _ = fs::remove_dir_all(root);
    }
}
