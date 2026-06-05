use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use chrono::{DateTime, Utc};
use regex::Regex;
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

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataCoverageHealth {
    pub complete_game_count: i64,
    pub needs_metadata_count: i64,
    pub missing_cover_count: i64,
    pub missing_banner_count: i64,
    pub missing_background_count: i64,
    pub missing_description_count: i64,
    pub missing_external_id_count: i64,
    pub provider_linked_game_count: i64,
    pub vndb_game_count: i64,
    pub dlsite_game_count: i64,
    pub fanza_game_count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptionImageHealth {
    pub provider_games_count: i64,
    pub provider_games_with_images_count: i64,
    pub provider_games_without_images_count: i64,
    pub provider_games_empty_description_count: i64,
    pub all_games_with_images_count: i64,
    pub image_refs_count: i64,
    pub local_image_refs_count: i64,
    pub missing_local_image_refs_count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalIdHealth {
    pub total_external_id_count: i64,
    pub vndb_id_count: i64,
    pub dlsite_id_count: i64,
    pub fanza_id_count: i64,
    pub duplicate_external_id_groups_count: i64,
    pub duplicate_external_id_games_count: i64,
    pub duplicate_vndb_id_groups_count: i64,
    pub duplicate_dlsite_id_groups_count: i64,
    pub duplicate_fanza_id_groups_count: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathStatusHealth {
    pub ok_count: i64,
    pub broken_count: i64,
    pub incomplete_count: i64,
    pub unchecked_count: i64,
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
    pub metadata_coverage: MetadataCoverageHealth,
    pub description_images: DescriptionImageHealth,
    pub external_ids: ExternalIdHealth,
    pub path_status: PathStatusHealth,
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
    if database.description_images.missing_local_image_refs_count > 0 {
        warnings.push(format!(
            "有 {} 条简介本地图片引用找不到文件。",
            database.description_images.missing_local_image_refs_count
        ));
    }
    let description_image_gaps = database
        .description_images
        .provider_games_without_images_count
        + database
            .description_images
            .provider_games_empty_description_count;
    if description_image_gaps > 0 {
        warnings.push(format!(
            "有 {} 个 DLsite/FANZA 条目还没有简介图片。",
            description_image_gaps
        ));
    }
    if database.external_ids.duplicate_external_id_groups_count > 0 {
        warnings.push(format!(
            "发现 {} 组重复外部 ID，涉及 {} 条游戏记录。",
            database.external_ids.duplicate_external_id_groups_count,
            database.external_ids.duplicate_external_id_games_count
        ));
    }
    if database.path_status.broken_count > 0 {
        warnings.push(format!(
            "有 {} 条游戏路径标记为异常。",
            database.path_status.broken_count
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
        metadata_coverage: MetadataCoverageHealth::default(),
        description_images: DescriptionImageHealth::default(),
        external_ids: ExternalIdHealth::default(),
        path_status: PathStatusHealth::default(),
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
    health.metadata_coverage = metadata_coverage_health(&conn)?;
    health.description_images = description_image_health(&conn)?;
    health.external_ids = external_id_health(&conn)?;
    health.path_status = path_status_health(&conn)?;

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

fn table_count_where(conn: &Connection, table: &str, condition: &str) -> DbResult<i64> {
    if !table_exists(conn, table)? {
        return Ok(0);
    }
    let sql = format!("SELECT COUNT(*) FROM {table} WHERE {condition}");
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

fn metadata_coverage_health(conn: &Connection) -> DbResult<MetadataCoverageHealth> {
    if !table_exists(conn, "games")? {
        return Ok(MetadataCoverageHealth::default());
    }

    let description = nonempty_games_column_expr(conn, "description")?;
    let release_date = nonempty_games_column_expr(conn, "release_date")?;
    let developer = nonempty_games_column_expr(conn, "developer")?;
    let brand = nonempty_games_column_expr(conn, "brand")?;
    let cover = nonempty_games_column_expr(conn, "cover_image")?;
    let banner = nonempty_games_column_expr(conn, "banner_image")?;
    let background = nonempty_games_column_expr(conn, "background_image")?;
    let external = any_external_id_expr(conn)?;
    let complete = format!(
        "({description}) AND ({release_date}) AND (({developer}) OR ({brand})) AND ({cover}) AND ({external})"
    );
    let vndb = provider_linked_expr(conn, "vndb", Some("vndb_id"))?;
    let dlsite = provider_linked_expr(conn, "dlsite", Some("dlsite_id"))?;
    let fanza = provider_linked_expr(conn, "fanza", Some("fanza_id"))?;
    let provider_linked = format!("({vndb}) OR ({dlsite}) OR ({fanza})");

    Ok(MetadataCoverageHealth {
        complete_game_count: table_count_where(conn, "games", &complete)?,
        needs_metadata_count: table_count_where(conn, "games", &format!("NOT ({complete})"))?,
        missing_cover_count: table_count_where(conn, "games", &format!("NOT ({cover})"))?,
        missing_banner_count: table_count_where(conn, "games", &format!("NOT ({banner})"))?,
        missing_background_count: table_count_where(conn, "games", &format!("NOT ({background})"))?,
        missing_description_count: table_count_where(
            conn,
            "games",
            &format!("NOT ({description})"),
        )?,
        missing_external_id_count: table_count_where(conn, "games", &format!("NOT ({external})"))?,
        provider_linked_game_count: table_count_where(conn, "games", &provider_linked)?,
        vndb_game_count: table_count_where(conn, "games", &vndb)?,
        dlsite_game_count: table_count_where(conn, "games", &dlsite)?,
        fanza_game_count: table_count_where(conn, "games", &fanza)?,
    })
}

fn description_image_health(conn: &Connection) -> DbResult<DescriptionImageHealth> {
    if !table_exists(conn, "games")? || !column_exists(conn, "games", "description")? {
        return Ok(DescriptionImageHealth::default());
    }

    let provider_expr = format!(
        "({}) OR ({})",
        provider_linked_expr(conn, "dlsite", Some("dlsite_id"))?,
        provider_linked_expr(conn, "fanza", Some("fanza_id"))?
    );
    let sql = format!("SELECT description, ({provider_expr}) AS provider_linked FROM games");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, Option<String>>(0)?, row.get::<_, i64>(1)? != 0))
    })?;
    let mut health = DescriptionImageHealth::default();

    for row in rows {
        let (description, provider_linked) = row?;
        let description = description.unwrap_or_default();
        let has_description = !description.trim().is_empty();
        let image_sources = description_image_sources(&description);

        if provider_linked {
            health.provider_games_count += 1;
            if !has_description {
                health.provider_games_empty_description_count += 1;
            } else if image_sources.is_empty() {
                health.provider_games_without_images_count += 1;
            } else {
                health.provider_games_with_images_count += 1;
            }
        }

        if !image_sources.is_empty() {
            health.all_games_with_images_count += 1;
        }
        health.image_refs_count += image_sources.len() as i64;
        for source in image_sources {
            if is_local_file_ref(&source) {
                health.local_image_refs_count += 1;
                if !PathBuf::from(source.trim()).is_file() {
                    health.missing_local_image_refs_count += 1;
                }
            }
        }
    }

    Ok(health)
}

fn external_id_health(conn: &Connection) -> DbResult<ExternalIdHealth> {
    let Some(cte) = external_id_union_cte(conn)? else {
        return Ok(ExternalIdHealth::default());
    };

    Ok(ExternalIdHealth {
        total_external_id_count: external_id_query_count(conn, &cte, "SELECT COUNT(*) FROM ids")?,
        vndb_id_count: external_id_query_count(
            conn,
            &cte,
            "SELECT COUNT(*) FROM ids WHERE provider = 'vndb'",
        )?,
        dlsite_id_count: external_id_query_count(
            conn,
            &cte,
            "SELECT COUNT(*) FROM ids WHERE provider = 'dlsite'",
        )?,
        fanza_id_count: external_id_query_count(
            conn,
            &cte,
            "SELECT COUNT(*) FROM ids WHERE provider = 'fanza'",
        )?,
        duplicate_external_id_groups_count: external_id_query_count(
            conn,
            &cte,
            "SELECT COUNT(*) FROM (SELECT provider, external_id FROM ids GROUP BY provider, external_id HAVING COUNT(DISTINCT game_id) > 1)",
        )?,
        duplicate_external_id_games_count: external_id_query_count(
            conn,
            &cte,
            r#"
            SELECT COUNT(DISTINCT ids.game_id)
            FROM ids
            INNER JOIN (
              SELECT provider, external_id
              FROM ids
              GROUP BY provider, external_id
              HAVING COUNT(DISTINCT game_id) > 1
            ) dupes ON dupes.provider = ids.provider AND dupes.external_id = ids.external_id
            "#,
        )?,
        duplicate_vndb_id_groups_count: duplicate_external_id_group_count(conn, &cte, "vndb")?,
        duplicate_dlsite_id_groups_count: duplicate_external_id_group_count(conn, &cte, "dlsite")?,
        duplicate_fanza_id_groups_count: duplicate_external_id_group_count(conn, &cte, "fanza")?,
    })
}

fn path_status_health(conn: &Connection) -> DbResult<PathStatusHealth> {
    if !table_exists(conn, "games")? || !column_exists(conn, "games", "path_status")? {
        return Ok(PathStatusHealth::default());
    }

    Ok(PathStatusHealth {
        ok_count: table_count_where(conn, "games", "path_status = 'ok'")?,
        broken_count: table_count_where(conn, "games", "path_status = 'broken'")?,
        incomplete_count: table_count_where(conn, "games", "path_status = 'incomplete'")?,
        unchecked_count: table_count_where(
            conn,
            "games",
            "path_status IS NULL OR TRIM(path_status) = '' OR path_status = 'unknown'",
        )?,
    })
}

fn nonempty_games_column_expr(conn: &Connection, column: &str) -> DbResult<String> {
    if column_exists(conn, "games", column)? {
        Ok(format!(
            "games.{column} IS NOT NULL AND TRIM(games.{column}) <> ''"
        ))
    } else {
        Ok("0".to_string())
    }
}

fn provider_linked_expr(
    conn: &Connection,
    provider: &str,
    game_column: Option<&str>,
) -> DbResult<String> {
    let mut clauses = Vec::new();
    if let Some(column) = game_column {
        if column_exists(conn, "games", column)? {
            clauses.push(format!(
                "games.{column} IS NOT NULL AND TRIM(games.{column}) <> ''"
            ));
        }
    }
    if external_ids_available(conn)? {
        clauses.push(format!(
            "EXISTS(SELECT 1 FROM external_ids e WHERE e.game_id = games.id AND e.provider = '{provider}' AND e.external_id IS NOT NULL AND TRIM(e.external_id) <> '')"
        ));
    }
    Ok(if clauses.is_empty() {
        "0".to_string()
    } else {
        clauses.join(" OR ")
    })
}

fn any_external_id_expr(conn: &Connection) -> DbResult<String> {
    let mut clauses = Vec::new();
    for column in ["vndb_id", "bangumi_id", "dlsite_id", "fanza_id", "ymgal_id"] {
        if column_exists(conn, "games", column)? {
            clauses.push(format!(
                "games.{column} IS NOT NULL AND TRIM(games.{column}) <> ''"
            ));
        }
    }
    if external_ids_available(conn)? {
        clauses.push(
            "EXISTS(SELECT 1 FROM external_ids e WHERE e.game_id = games.id AND e.external_id IS NOT NULL AND TRIM(e.external_id) <> '')".to_string(),
        );
    }
    Ok(if clauses.is_empty() {
        "0".to_string()
    } else {
        clauses.join(" OR ")
    })
}

fn external_ids_available(conn: &Connection) -> DbResult<bool> {
    Ok(table_exists(conn, "external_ids")?
        && column_exists(conn, "external_ids", "game_id")?
        && column_exists(conn, "external_ids", "provider")?
        && column_exists(conn, "external_ids", "external_id")?)
}

fn external_id_union_cte(conn: &Connection) -> DbResult<Option<String>> {
    let mut selects = Vec::new();
    if external_ids_available(conn)? {
        selects.push(
            "SELECT game_id, LOWER(TRIM(provider)) AS provider, LOWER(TRIM(external_id)) AS external_id FROM external_ids WHERE external_id IS NOT NULL AND TRIM(external_id) <> '' AND provider IS NOT NULL AND TRIM(provider) <> ''".to_string(),
        );
    }
    if table_exists(conn, "games")? && column_exists(conn, "games", "id")? {
        for (provider, column) in [
            ("vndb", "vndb_id"),
            ("bangumi", "bangumi_id"),
            ("dlsite", "dlsite_id"),
            ("fanza", "fanza_id"),
            ("ymgal", "ymgal_id"),
        ] {
            if column_exists(conn, "games", column)? {
                selects.push(format!(
                    "SELECT id AS game_id, '{provider}' AS provider, LOWER(TRIM({column})) AS external_id FROM games WHERE {column} IS NOT NULL AND TRIM({column}) <> ''"
                ));
            }
        }
    }
    if selects.is_empty() {
        Ok(None)
    } else {
        Ok(Some(format!("WITH ids AS ({})", selects.join(" UNION "))))
    }
}

fn external_id_query_count(conn: &Connection, cte: &str, query: &str) -> DbResult<i64> {
    let sql = format!("{cte} {query}");
    Ok(conn.query_row(&sql, [], |row| row.get::<_, i64>(0))?)
}

fn duplicate_external_id_group_count(
    conn: &Connection,
    cte: &str,
    provider: &str,
) -> DbResult<i64> {
    external_id_query_count(
        conn,
        cte,
        &format!(
            "SELECT COUNT(*) FROM (SELECT external_id FROM ids WHERE provider = '{provider}' GROUP BY external_id HAVING COUNT(DISTINCT game_id) > 1)"
        ),
    )
}

fn description_image_sources(value: &str) -> Vec<String> {
    static DESCRIPTION_IMAGE_RE: OnceLock<Regex> = OnceLock::new();
    let pattern = DESCRIPTION_IMAGE_RE.get_or_init(|| {
        Regex::new(r#"(?is)!\[[^\]]*\]\(([^)]*?)\)|<img\b[^>]*>|\[img\]([\s\S]*?)\[/img\]|https?://[^\s<>"']+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s<>"']*)?"#)
            .expect("valid description image regex")
    });

    pattern
        .captures_iter(value)
        .filter_map(|captures| description_image_source_from_match(&captures))
        .collect()
}

fn description_image_source_from_match(captures: &regex::Captures<'_>) -> Option<String> {
    if let Some(source) = captures.get(1) {
        return clean_description_image_source(source.as_str(), false);
    }
    let token = captures.get(0)?.as_str();
    if token.trim_start().to_lowercase().starts_with("<img") {
        return read_description_image_attr(token)
            .and_then(|source| clean_description_image_source(&source, false));
    }
    if let Some(source) = captures.get(2) {
        return clean_description_image_source(source.as_str(), false);
    }
    clean_description_image_source(token, true)
}

fn read_description_image_attr(tag: &str) -> Option<String> {
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
    use rusqlite::{params, Connection};
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

    #[test]
    fn diagnostics_counts_maintenance_metrics() {
        let root = std::env::temp_dir().join(format!("mikavn-diagnostics-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.join("app-data")).unwrap();
        fs::create_dir_all(paths.images()).unwrap();
        let description_image = paths.images().join("desc.webp");
        fs::write(&description_image, b"image").unwrap();
        let description_image = description_image.to_string_lossy().to_string();

        let conn = Connection::open(paths.database()).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE games (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT,
              release_date TEXT,
              developer TEXT,
              brand TEXT,
              cover_image TEXT,
              banner_image TEXT,
              background_image TEXT,
              vndb_id TEXT,
              dlsite_id TEXT,
              fanza_id TEXT,
              path_status TEXT
            );
            "#,
        )
        .unwrap();
        conn.execute(
            r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, dlsite_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                "g1",
                "Image VN",
                format!("Story ![scene]({description_image})"),
                "2026-01-01",
                "Studio",
                "https://example.com/cover.jpg",
                "RJ01000000",
                "ok"
            ],
        )
        .unwrap();
        conn.execute(
            r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, dlsite_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                "g2",
                "Plain VN",
                "Plain description",
                "2026-01-02",
                "Studio",
                "https://example.com/plain.jpg",
                "RJ01000000",
                "broken"
            ],
        )
        .unwrap();
        conn.execute(
            r#"
            INSERT INTO games (id, title, description, release_date, developer, cover_image, fanza_id, path_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params!["g3", "Empty VN", "", "", "", Option::<String>::None, "abc_1234", "incomplete"],
        )
        .unwrap();

        let diagnostics = get_app_data_diagnostics_with_paths(&paths, "test".to_string()).unwrap();

        assert_eq!(
            diagnostics.database.metadata_coverage.complete_game_count,
            2
        );
        assert_eq!(
            diagnostics.database.metadata_coverage.needs_metadata_count,
            1
        );
        assert_eq!(
            diagnostics.database.metadata_coverage.missing_cover_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .metadata_coverage
                .missing_description_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .metadata_coverage
                .provider_linked_game_count,
            3
        );
        assert_eq!(diagnostics.database.metadata_coverage.dlsite_game_count, 2);
        assert_eq!(diagnostics.database.metadata_coverage.fanza_game_count, 1);
        assert_eq!(
            diagnostics.database.description_images.provider_games_count,
            3
        );
        assert_eq!(
            diagnostics
                .database
                .description_images
                .provider_games_with_images_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .description_images
                .provider_games_without_images_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .description_images
                .provider_games_empty_description_count,
            1
        );
        assert_eq!(diagnostics.database.description_images.image_refs_count, 1);
        assert_eq!(
            diagnostics
                .database
                .description_images
                .local_image_refs_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .description_images
                .missing_local_image_refs_count,
            0
        );
        assert_eq!(
            diagnostics
                .database
                .external_ids
                .duplicate_external_id_groups_count,
            1
        );
        assert_eq!(
            diagnostics
                .database
                .external_ids
                .duplicate_external_id_games_count,
            2
        );
        assert_eq!(
            diagnostics
                .database
                .external_ids
                .duplicate_dlsite_id_groups_count,
            1
        );
        assert_eq!(diagnostics.database.path_status.ok_count, 1);
        assert_eq!(diagnostics.database.path_status.broken_count, 1);
        assert_eq!(diagnostics.database.path_status.incomplete_count, 1);
        assert!(diagnostics
            .warnings
            .iter()
            .any(|warning| warning.contains("重复外部 ID")));
        assert!(diagnostics
            .warnings
            .iter()
            .any(|warning| warning.contains("简介图片")));
        let _ = fs::remove_dir_all(root);
    }
}
