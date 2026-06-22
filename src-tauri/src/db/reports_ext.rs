use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use crate::db::models::{
    ReportCompleteness, ReportCountItem, ReportGapExample, ReportGapExamples, ReportGaps,
    ReportPlaytimeItem, ReportSummary,
};
use crate::db::{Database, DbResult};

impl Database {
    pub fn report_summary(&self) -> DbResult<ReportSummary> {
        let include_private =
            self.get_setting("privacy_filter_reports")?.as_deref() == Some("false");
        report_summary(&self.conn, include_private)
    }
}

fn report_summary(conn: &Connection, include_private: bool) -> DbResult<ReportSummary> {
    let filter = report_filter(include_private);
    let now = Utc::now();
    let week_since = (now - Duration::days(7)).to_rfc3339();
    let month_since = (now - Duration::days(30)).to_rfc3339();
    let totals = report_totals(conn, filter)?;
    let missing_cover_condition = "TRIM(COALESCE(cover_image, '')) = ''";
    let missing_description_image_condition = "(TRIM(COALESCE(dlsite_id, '')) <> '' OR TRIM(COALESCE(fanza_id, '')) <> '') AND COALESCE(description, '') NOT LIKE '%![%](%' AND LOWER(COALESCE(description, '')) NOT LIKE '%<img%'";
    let missing_external_ids_condition = "TRIM(COALESCE(vndb_id, '')) = '' AND TRIM(COALESCE(bangumi_id, '')) = '' AND TRIM(COALESCE(dlsite_id, '')) = '' AND TRIM(COALESCE(fanza_id, '')) = '' AND TRIM(COALESCE(ymgal_id, '')) = ''";
    let broken_path_condition = "path_status = 'broken'";

    Ok(ReportSummary {
        total_games: totals.total_games,
        total_play_seconds: totals.total_play_seconds,
        week_play_seconds: play_seconds_since(conn, filter, &week_since)?,
        month_play_seconds: play_seconds_since(conn, filter, &month_since)?,
        status: status_counts(conn, filter)?,
        tags: tag_counts(conn, filter)?,
        developers: developer_counts(conn, filter)?,
        playtime: playtime_top(conn, filter)?,
        completeness: ReportCompleteness {
            cover: totals.cover,
            description: totals.description,
            release_date: totals.release_date,
            external_ids: totals.external_ids,
        },
        gaps: ReportGaps {
            missing_cover: count_gap(conn, filter, missing_cover_condition)?,
            missing_description_image: count_gap(
                conn,
                filter,
                missing_description_image_condition,
            )?,
            missing_external_ids: count_gap(conn, filter, missing_external_ids_condition)?,
            broken_path: count_gap(conn, filter, broken_path_condition)?,
            examples: ReportGapExamples {
                missing_cover: gap_examples(conn, filter, missing_cover_condition)?,
                missing_description_image: gap_examples(
                    conn,
                    filter,
                    missing_description_image_condition,
                )?,
                missing_external_ids: gap_examples(conn, filter, missing_external_ids_condition)?,
                broken_path: gap_examples(conn, filter, broken_path_condition)?,
            },
        },
    })
}

fn report_filter(include_private: bool) -> &'static str {
    if include_private {
        "1 = 1"
    } else {
        "hidden = 0 AND COALESCE(age_rating, '') <> 'R18'"
    }
}

struct ReportTotals {
    total_games: i64,
    total_play_seconds: i64,
    cover: i64,
    description: i64,
    release_date: i64,
    external_ids: i64,
}

fn report_totals(conn: &Connection, filter: &str) -> DbResult<ReportTotals> {
    let sql = format!(
        r#"
        SELECT
          COUNT(*),
          COALESCE(SUM(total_play_seconds), 0),
          COALESCE(SUM(CASE WHEN TRIM(COALESCE(cover_image, '')) <> '' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN TRIM(COALESCE(description, '')) <> '' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN TRIM(COALESCE(release_date, '')) <> '' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN TRIM(COALESCE(vndb_id, '')) <> ''
            OR TRIM(COALESCE(bangumi_id, '')) <> ''
            OR TRIM(COALESCE(dlsite_id, '')) <> ''
            OR TRIM(COALESCE(fanza_id, '')) <> ''
            OR TRIM(COALESCE(ymgal_id, '')) <> '' THEN 1 ELSE 0 END), 0)
        FROM games
        WHERE {filter}
        "#
    );
    Ok(conn.query_row(&sql, [], |row| {
        Ok(ReportTotals {
            total_games: row.get(0)?,
            total_play_seconds: row.get(1)?,
            cover: row.get(2)?,
            description: row.get(3)?,
            release_date: row.get(4)?,
            external_ids: row.get(5)?,
        })
    })?)
}

fn play_seconds_since(conn: &Connection, filter: &str, since: &str) -> DbResult<i64> {
    let sql = format!(
        "SELECT COALESCE(SUM(total_play_seconds), 0) FROM games WHERE {filter} AND last_played_at IS NOT NULL AND last_played_at >= ?1"
    );
    Ok(conn.query_row(&sql, params![since], |row| row.get(0))?)
}

fn status_counts(conn: &Connection, filter: &str) -> DbResult<Vec<ReportCountItem>> {
    let sql = format!(
        "SELECT play_status, COUNT(*) FROM games WHERE {filter} GROUP BY play_status ORDER BY COUNT(*) DESC, play_status ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        let status: String = row.get(0)?;
        Ok(ReportCountItem {
            label: play_status_label(&status).to_string(),
            value: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn tag_counts(conn: &Connection, filter: &str) -> DbResult<Vec<ReportCountItem>> {
    let sql = format!(
        r#"
        SELECT json_each.value, COUNT(*)
        FROM games, json_each(games.tags)
        WHERE {filter} AND TRIM(json_each.value) <> ''
        GROUP BY json_each.value
        ORDER BY COUNT(*) DESC, json_each.value ASC
        LIMIT 8
        "#
    );
    count_items(conn, &sql)
}

fn developer_counts(conn: &Connection, filter: &str) -> DbResult<Vec<ReportCountItem>> {
    let sql = format!(
        r#"
        SELECT COALESCE(NULLIF(TRIM(developer), ''), NULLIF(TRIM(brand), ''), '未填写') AS label, COUNT(*)
        FROM games
        WHERE {filter}
        GROUP BY label
        ORDER BY COUNT(*) DESC, label ASC
        LIMIT 8
        "#
    );
    count_items(conn, &sql)
}

fn count_items(conn: &Connection, sql: &str) -> DbResult<Vec<ReportCountItem>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(ReportCountItem {
            label: row.get(0)?,
            value: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn playtime_top(conn: &Connection, filter: &str) -> DbResult<Vec<ReportPlaytimeItem>> {
    let sql = format!(
        "SELECT title, total_play_seconds FROM games WHERE {filter} ORDER BY total_play_seconds DESC, title ASC LIMIT 8"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(ReportPlaytimeItem {
            label: row.get(0)?,
            seconds: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn count_gap(conn: &Connection, filter: &str, condition: &str) -> DbResult<i64> {
    let sql = format!("SELECT COUNT(*) FROM games WHERE {filter} AND ({condition})");
    Ok(conn.query_row(&sql, [], |row| row.get(0))?)
}

fn gap_examples(
    conn: &Connection,
    filter: &str,
    condition: &str,
) -> DbResult<Vec<ReportGapExample>> {
    let sql = format!(
        "SELECT id, title FROM games WHERE {filter} AND ({condition}) ORDER BY updated_at DESC LIMIT 3"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        Ok(ReportGapExample {
            id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn play_status_label(value: &str) -> &str {
    match value {
        "planned" => "想玩",
        "playing" => "游玩中",
        "completed" => "已通关",
        "paused" => "已搁置",
        "archived" => "封存",
        _ => value,
    }
}
