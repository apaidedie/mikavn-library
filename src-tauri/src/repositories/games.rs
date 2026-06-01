use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::collections::HashSet;
use uuid::Uuid;

use crate::db::models::{AddGameInput, Game, GameFilter, UpdateGameInput};
use crate::db::{DbError, DbResult};

pub struct GameRepository<'a> {
    conn: &'a Connection,
}

impl<'a> GameRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get(&self, id: String) -> DbResult<Game> {
        self.conn
            .query_row(
                "SELECT * FROM games WHERE id = ?1",
                params![id],
                game_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::new("VALIDATION_ERROR", "game not found"))
    }

    fn list_all(&self) -> DbResult<Vec<Game>> {
        let mut stmt = self.conn.prepare("SELECT * FROM games")?;
        let rows = stmt.query_map([], game_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list(
        &self,
        filter: GameFilter,
        collection_game_ids: Option<&[String]>,
    ) -> DbResult<Vec<Game>> {
        let mut games = self.list_all()?;

        if let Some(query) = trim_optional(filter.query) {
            let needle = query.to_lowercase();
            games.retain(|game| {
                let haystack = format!(
                    "{} {} {} {} {} {}",
                    game.title,
                    game.original_title.clone().unwrap_or_default(),
                    game.developer.clone().unwrap_or_default(),
                    game.brand.clone().unwrap_or_default(),
                    game.aliases.join(" "),
                    game.tags.join(" ")
                )
                .to_lowercase();
                haystack.contains(&needle)
            });
        }

        if let Some(status) = filter.status.filter(|value| value != "all") {
            games.retain(|game| game.play_status == status);
        }

        if let Some(tag) = trim_optional(filter.tag) {
            let needle = tag.to_lowercase();
            games.retain(|game| {
                game.tags
                    .iter()
                    .chain(game.genres.iter())
                    .any(|item| item.to_lowercase() == needle)
            });
        }

        if let Some(developer) = trim_optional(filter.developer) {
            let needle = developer.to_lowercase();
            games.retain(|game| {
                game.developer.as_deref().unwrap_or_default().to_lowercase() == needle
                    || game.brand.as_deref().unwrap_or_default().to_lowercase() == needle
                    || game.publisher.as_deref().unwrap_or_default().to_lowercase() == needle
            });
        }

        if let Some(favorite) = filter.favorite {
            games.retain(|game| game.favorite == favorite);
        }

        if let Some(hidden) = filter.hidden {
            games.retain(|game| game.hidden == hidden);
        }

        if let Some(metadata_status) = trim_optional(filter.metadata_status) {
            games.retain(|game| metadata_status_matches(game, &metadata_status));
        }

        if let Some(path_status) = trim_optional(filter.path_status).filter(|value| value != "all")
        {
            games.retain(|game| game.path_status == path_status);
        }

        if let Some(ids) = collection_game_ids {
            let ids = ids.iter().map(String::as_str).collect::<HashSet<_>>();
            games.retain(|game| ids.contains(game.id.as_str()));
        }

        let sort_by = filter.sort_by.unwrap_or_else(|| "updated_at".to_string());
        let desc = filter.sort_direction.unwrap_or_else(|| "desc".to_string()) != "asc";
        games.sort_by(|a, b| sort_key(a, &sort_by).cmp(&sort_key(b, &sort_by)));
        if desc {
            games.reverse();
        }

        Ok(games)
    }

    pub fn add(&self, input: AddGameInput) -> DbResult<Game> {
        let now = now();
        let id = Uuid::new_v4().to_string();
        let aliases = json_list(input.aliases.unwrap_or_default())?;
        let tags = json_list(input.tags.unwrap_or_default())?;
        let genres = json_list(input.genres.unwrap_or_default())?;
        let working_directory = input
            .working_directory
            .or_else(|| Some(input.install_path.clone()));

        self.conn.execute(
            r#"
            INSERT INTO games (
              id, title, original_title, aliases, developer, publisher, brand, release_date, description,
              notes, tags, genres, rating, age_rating, play_status, favorite, hidden, install_path, executable_path,
              working_directory, launch_args, path_status, last_path_checked_at, cover_image, banner_image, background_image, vndb_id, bangumi_id,
              dlsite_id, fanza_id, ymgal_id, total_play_seconds, last_played_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 'unknown', NULL, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, 0, NULL, ?30, ?31)
            "#,
            params![
                id,
                trimmed_required(input.title, "title")?,
                trim_optional(input.original_title),
                aliases,
                trim_optional(input.developer),
                trim_optional(input.publisher),
                trim_optional(input.brand),
                trim_optional(input.release_date),
                trim_optional(input.description),
                trim_optional(input.notes),
                tags,
                genres,
                input.rating,
                trim_optional(input.age_rating),
                input.play_status.unwrap_or_else(|| "planned".to_string()),
                bool_int(input.favorite.unwrap_or(false)),
                bool_int(input.hidden.unwrap_or(false)),
                trimmed_required(input.install_path, "installPath")?,
                trim_optional(input.executable_path),
                trim_optional(working_directory),
                trim_optional(input.launch_args),
                trim_optional(input.cover_image),
                trim_optional(input.banner_image),
                trim_optional(input.background_image),
                trim_optional(input.vndb_id),
                trim_optional(input.bangumi_id),
                trim_optional(input.dlsite_id),
                trim_optional(input.fanza_id),
                trim_optional(input.ymgal_id),
                now,
                now,
            ],
        )?;

        self.get(id)
    }

    pub fn insert_imported(&self, mut game: Game) -> DbResult<Game> {
        game.title = trimmed_required(game.title, "title")?;
        game.install_path = trimmed_required(game.install_path, "installPath")?;
        if game.created_at.trim().is_empty() {
            game.created_at = now();
        }
        game.updated_at = now();

        self.conn.execute(
            r#"
            INSERT INTO games (
              id, title, original_title, aliases, developer, publisher, brand, release_date, description,
              notes, tags, genres, rating, age_rating, play_status, favorite, hidden, install_path, executable_path,
              working_directory, launch_args, path_status, last_path_checked_at, cover_image, banner_image, background_image, vndb_id, bangumi_id,
              dlsite_id, fanza_id, ymgal_id, total_play_seconds, last_played_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35)
            "#,
            params![
                game.id,
                game.title,
                game.original_title,
                json_list(game.aliases)?,
                game.developer,
                game.publisher,
                game.brand,
                game.release_date,
                game.description,
                game.notes,
                json_list(game.tags)?,
                json_list(game.genres)?,
                game.rating,
                game.age_rating,
                game.play_status,
                bool_int(game.favorite),
                bool_int(game.hidden),
                game.install_path,
                game.executable_path,
                game.working_directory,
                game.launch_args,
                game.path_status,
                game.last_path_checked_at,
                game.cover_image,
                game.banner_image,
                game.background_image,
                game.vndb_id,
                game.bangumi_id,
                game.dlsite_id,
                game.fanza_id,
                game.ymgal_id,
                game.total_play_seconds,
                game.last_played_at,
                game.created_at,
                game.updated_at,
            ],
        )?;

        self.get(game.id)
    }

    pub fn update(&self, id: String, input: UpdateGameInput) -> DbResult<Game> {
        let mut game = self.get(id.clone())?;

        if let Some(value) = input.title {
            game.title = trimmed_required(value, "title")?;
        }
        if input.original_title.is_some() {
            game.original_title = trim_optional(input.original_title);
        }
        if let Some(value) = input.aliases {
            game.aliases = clean_list(value);
        }
        if input.developer.is_some() {
            game.developer = trim_optional(input.developer);
        }
        if input.publisher.is_some() {
            game.publisher = trim_optional(input.publisher);
        }
        if input.brand.is_some() {
            game.brand = trim_optional(input.brand);
        }
        if input.release_date.is_some() {
            game.release_date = trim_optional(input.release_date);
        }
        if input.description.is_some() {
            game.description = trim_optional(input.description);
        }
        if input.notes.is_some() {
            game.notes = trim_optional(input.notes);
        }
        if let Some(value) = input.tags {
            game.tags = clean_list(value);
        }
        if let Some(value) = input.genres {
            game.genres = clean_list(value);
        }
        if input.rating.is_some() {
            game.rating = input.rating;
        }
        if input.age_rating.is_some() {
            game.age_rating = trim_optional(input.age_rating);
        }
        if let Some(value) = input.play_status {
            game.play_status = value;
        }
        if let Some(value) = input.favorite {
            game.favorite = value;
        }
        if let Some(value) = input.hidden {
            game.hidden = value;
        }
        if let Some(value) = input.install_path {
            game.install_path = trimmed_required(value, "installPath")?;
        }
        if input.executable_path.is_some() {
            game.executable_path = trim_optional(input.executable_path);
        }
        if input.working_directory.is_some() {
            game.working_directory = trim_optional(input.working_directory);
        }
        if input.launch_args.is_some() {
            game.launch_args = trim_optional(input.launch_args);
        }
        if let Some(value) = input.path_status {
            game.path_status = value;
        }
        if input.last_path_checked_at.is_some() {
            game.last_path_checked_at = trim_optional(input.last_path_checked_at);
        }
        if input.cover_image.is_some() {
            game.cover_image = trim_optional(input.cover_image);
        }
        if input.banner_image.is_some() {
            game.banner_image = trim_optional(input.banner_image);
        }
        if input.background_image.is_some() {
            game.background_image = trim_optional(input.background_image);
        }
        if input.vndb_id.is_some() {
            game.vndb_id = trim_optional(input.vndb_id);
        }
        if input.bangumi_id.is_some() {
            game.bangumi_id = trim_optional(input.bangumi_id);
        }
        if input.dlsite_id.is_some() {
            game.dlsite_id = trim_optional(input.dlsite_id);
        }
        if input.fanza_id.is_some() {
            game.fanza_id = trim_optional(input.fanza_id);
        }
        if input.ymgal_id.is_some() {
            game.ymgal_id = trim_optional(input.ymgal_id);
        }

        game.updated_at = now();

        self.update_row(&game)?;
        self.get(id)
    }

    pub fn delete_record(&self, id: String) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM games WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn set_path_health(&self, game_id: &str, status: &str, checked_at: &str) -> DbResult<()> {
        self.conn.execute(
            "UPDATE games SET path_status = ?2, last_path_checked_at = ?3, updated_at = ?3 WHERE id = ?1",
            params![game_id, status, checked_at],
        )?;
        Ok(())
    }

    pub fn update_relocated_paths(&self, game: &Game) -> DbResult<()> {
        self.conn.execute(
            r#"
            UPDATE games SET install_path = ?2, executable_path = ?3, working_directory = ?4,
              path_status = ?5, last_path_checked_at = NULL, updated_at = ?6
            WHERE id = ?1
            "#,
            params![
                game.id,
                game.install_path,
                game.executable_path,
                game.working_directory,
                game.path_status,
                game.updated_at
            ],
        )?;
        Ok(())
    }

    fn update_row(&self, game: &Game) -> DbResult<()> {
        self.conn.execute(
            r#"
            UPDATE games SET
              title = ?2, original_title = ?3, aliases = ?4, developer = ?5, publisher = ?6, brand = ?7,
              release_date = ?8, description = ?9, notes = ?10, tags = ?11, genres = ?12, rating = ?13, age_rating = ?14,
              play_status = ?15, favorite = ?16, hidden = ?17, install_path = ?18, executable_path = ?19,
              working_directory = ?20, launch_args = ?21, path_status = ?22, last_path_checked_at = ?23,
              cover_image = ?24, banner_image = ?25, background_image = ?26, vndb_id = ?27, bangumi_id = ?28,
              dlsite_id = ?29, fanza_id = ?30, ymgal_id = ?31, updated_at = ?32
            WHERE id = ?1
            "#,
            params![
                game.id,
                game.title,
                game.original_title,
                json_list(game.aliases.clone())?,
                game.developer,
                game.publisher,
                game.brand,
                game.release_date,
                game.description,
                game.notes,
                json_list(game.tags.clone())?,
                json_list(game.genres.clone())?,
                game.rating,
                game.age_rating,
                game.play_status,
                bool_int(game.favorite),
                bool_int(game.hidden),
                game.install_path,
                game.executable_path,
                game.working_directory,
                game.launch_args,
                game.path_status,
                game.last_path_checked_at,
                game.cover_image,
                game.banner_image,
                game.background_image,
                game.vndb_id,
                game.bangumi_id,
                game.dlsite_id,
                game.fanza_id,
                game.ymgal_id,
                game.updated_at,
            ],
        )?;
        Ok(())
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn bool_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn clean_list(values: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    for value in values {
        let trimmed = value.trim().to_string();
        if !trimmed.is_empty() && !result.contains(&trimmed) {
            result.push(trimmed);
        }
    }
    result
}

fn json_list(values: Vec<String>) -> DbResult<String> {
    Ok(serde_json::to_string(&clean_list(values))?)
}

fn sort_key(game: &Game, sort_by: &str) -> String {
    match sort_by {
        "title" => game.title.clone(),
        "created_at" => game.created_at.clone(),
        "last_played_at" => game.last_played_at.clone().unwrap_or_default(),
        "release_date" => game.release_date.clone().unwrap_or_default(),
        "rating" => format!("{:03}", game.rating.unwrap_or(-1)),
        _ => game.updated_at.clone(),
    }
}

fn metadata_status_matches(game: &Game, status: &str) -> bool {
    match status {
        "complete" => {
            trim_optional(game.description.clone()).is_some()
                && trim_optional(game.release_date.clone()).is_some()
                && (trim_optional(game.developer.clone()).is_some()
                    || trim_optional(game.brand.clone()).is_some())
                && trim_optional(game.cover_image.clone()).is_some()
                && external_id_count(game) > 0
        }
        "missing_cover" => trim_optional(game.cover_image.clone()).is_none(),
        "missing_external_id" => external_id_count(game) == 0,
        "needs_metadata" => {
            trim_optional(game.description.clone()).is_none()
                || trim_optional(game.release_date.clone()).is_none()
                || (trim_optional(game.developer.clone()).is_none()
                    && trim_optional(game.brand.clone()).is_none())
                || trim_optional(game.cover_image.clone()).is_none()
                || external_id_count(game) == 0
        }
        _ => true,
    }
}

fn external_id_count(game: &Game) -> usize {
    [
        game.vndb_id.as_deref(),
        game.bangumi_id.as_deref(),
        game.dlsite_id.as_deref(),
        game.fanza_id.as_deref(),
        game.ymgal_id.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|value| !value.trim().is_empty())
    .count()
}

pub(crate) fn game_from_row(row: &Row<'_>) -> rusqlite::Result<Game> {
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
        notes: row.get("notes")?,
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
