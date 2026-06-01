use chrono::{Duration, Utc};

use crate::db::models::{DashboardData, Game, GameFilter};
use crate::db::{Database, DbResult};

pub fn dashboard(db: &Database) -> DbResult<DashboardData> {
    let games = db.list_games(GameFilter::default())?;
    let total_games = games.len() as i64;
    let planned_games = games
        .iter()
        .filter(|game| game.play_status == "planned")
        .count() as i64;
    let playing_games = games
        .iter()
        .filter(|game| game.play_status == "playing")
        .count() as i64;
    let completed_games = games
        .iter()
        .filter(|game| game.play_status == "completed")
        .count() as i64;
    let total_play_seconds = games.iter().map(|game| game.total_play_seconds).sum();
    let week_play_seconds = db.play_seconds_since(Utc::now() - Duration::days(7))?;
    let month_play_seconds = db.play_seconds_since(Utc::now() - Duration::days(30))?;
    let mut recent_games: Vec<Game> = games
        .iter()
        .filter(|game| game.last_played_at.is_some())
        .cloned()
        .collect();
    recent_games.sort_by(|a, b| b.last_played_at.cmp(&a.last_played_at));
    recent_games.truncate(5);

    let mut recently_added = games;
    recently_added.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    recently_added.truncate(5);

    Ok(DashboardData {
        total_games,
        planned_games,
        playing_games,
        completed_games,
        total_play_seconds,
        week_play_seconds,
        month_play_seconds,
        recent_games,
        recently_added,
    })
}
