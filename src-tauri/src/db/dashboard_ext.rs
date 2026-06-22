use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use crate::db::models::{DashboardData, Game};
use crate::db::{Database, DbResult};
use crate::repositories::games::game_from_row;

struct DashboardTotals {
    total_games: i64,
    planned_games: i64,
    playing_games: i64,
    completed_games: i64,
    total_play_seconds: i64,
}

impl Database {
    pub fn dashboard(&self) -> DbResult<DashboardData> {
        let totals = dashboard_totals(&self.conn)?;
        Ok(DashboardData {
            total_games: totals.total_games,
            planned_games: totals.planned_games,
            playing_games: totals.playing_games,
            completed_games: totals.completed_games,
            total_play_seconds: totals.total_play_seconds,
            week_play_seconds: self.play_seconds_since(Utc::now() - Duration::days(7))?,
            month_play_seconds: self.play_seconds_since(Utc::now() - Duration::days(30))?,
            recent_games: dashboard_recent_games(&self.conn)?,
            recently_added: dashboard_recently_added(&self.conn)?,
        })
    }
}

fn dashboard_totals(conn: &Connection) -> DbResult<DashboardTotals> {
    Ok(conn.query_row(
        r#"
        SELECT
          COUNT(*),
          COALESCE(SUM(CASE WHEN play_status = 'planned' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN play_status = 'playing' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN play_status = 'completed' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(total_play_seconds), 0)
        FROM games
        "#,
        [],
        |row| {
            Ok(DashboardTotals {
                total_games: row.get(0)?,
                planned_games: row.get(1)?,
                playing_games: row.get(2)?,
                completed_games: row.get(3)?,
                total_play_seconds: row.get(4)?,
            })
        },
    )?)
}

fn dashboard_recent_games(conn: &Connection) -> DbResult<Vec<Game>> {
    query_dashboard_games(
        conn,
        "SELECT * FROM games WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?1",
        5,
    )
}

fn dashboard_recently_added(conn: &Connection) -> DbResult<Vec<Game>> {
    query_dashboard_games(
        conn,
        "SELECT * FROM games ORDER BY created_at DESC LIMIT ?1",
        5,
    )
}

fn query_dashboard_games(conn: &Connection, sql: &str, limit: i64) -> DbResult<Vec<Game>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![limit], game_from_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::AddGameInput;
    use rusqlite::Connection;

    #[test]
    fn dashboard_totals_are_aggregated_without_loading_games() {
        let db = test_db();
        let planned = add_game(&db, "Planned VN", "planned");
        let playing = add_game(&db, "Playing VN", "playing");
        let completed = add_game(&db, "Completed VN", "completed");
        let paused = add_game(&db, "Paused VN", "paused");

        set_game_times(&db, &planned, 900, None, "2026-01-01T00:00:00Z");
        set_game_times(
            &db,
            &playing,
            1800,
            Some("2026-01-04T00:00:00Z"),
            "2026-01-02T00:00:00Z",
        );
        set_game_times(
            &db,
            &completed,
            2700,
            Some("2026-01-03T00:00:00Z"),
            "2026-01-03T00:00:00Z",
        );
        set_game_times(&db, &paused, 3600, None, "2026-01-04T00:00:00Z");

        let totals = dashboard_totals(&db.conn).unwrap();

        assert_eq!(totals.total_games, 4);
        assert_eq!(totals.planned_games, 1);
        assert_eq!(totals.playing_games, 1);
        assert_eq!(totals.completed_games, 1);
        assert_eq!(totals.total_play_seconds, 9000);
    }

    #[test]
    fn dashboard_recent_lists_are_limited_and_ordered() {
        let db = test_db();
        for index in 0..7 {
            let id = add_game(&db, &format!("Recent {index}"), "playing");
            set_game_times(
                &db,
                &id,
                index * 60,
                Some(&format!("2026-01-0{}T00:00:00Z", index + 1)),
                &format!("2026-02-0{}T00:00:00Z", index + 1),
            );
        }

        let recent_games = dashboard_recent_games(&db.conn).unwrap();
        let recently_added = dashboard_recently_added(&db.conn).unwrap();

        assert_eq!(recent_games.len(), 5);
        assert_eq!(recent_games[0].title, "Recent 6");
        assert_eq!(recent_games[4].title, "Recent 2");
        assert_eq!(recently_added.len(), 5);
        assert_eq!(recently_added[0].title, "Recent 6");
        assert_eq!(recently_added[4].title, "Recent 2");
    }

    fn test_db() -> Database {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database { conn };
        db.migrate().unwrap();
        db
    }

    fn add_game(db: &Database, title: &str, status: &str) -> String {
        db.add_game(AddGameInput {
            title: title.to_string(),
            install_path: format!("D:\\Games\\{title}"),
            play_status: Some(status.to_string()),
            ..empty_game_input()
        })
        .unwrap()
        .id
    }

    fn set_game_times(
        db: &Database,
        id: &str,
        total_play_seconds: i64,
        last_played_at: Option<&str>,
        created_at: &str,
    ) {
        db.conn
            .execute(
                "UPDATE games SET total_play_seconds = ?2, last_played_at = ?3, created_at = ?4, updated_at = ?4 WHERE id = ?1",
                params![id, total_play_seconds, last_played_at, created_at],
            )
            .unwrap();
    }

    fn empty_game_input() -> AddGameInput {
        AddGameInput {
            title: String::new(),
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
            install_path: String::new(),
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
}
