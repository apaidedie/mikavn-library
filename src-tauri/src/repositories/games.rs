use chrono::Utc;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Row};
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

    pub fn list(
        &self,
        filter: GameFilter,
        collection_game_ids: Option<&[String]>,
    ) -> DbResult<Vec<Game>> {
        let query = trim_optional(filter.query);
        let tag = trim_optional(filter.tag);
        let developer = trim_optional(filter.developer);
        let metadata_status = trim_optional(filter.metadata_status);
        let metadata_status_key = metadata_status.as_deref().map(metadata_status_key);
        let external_provider =
            trim_optional(filter.external_provider).map(|value| value.to_lowercase());
        let external_id = trim_optional(filter.external_id).map(|value| value.to_lowercase());
        let sort_by = filter.sort_by.unwrap_or_else(|| "updated_at".to_string());
        let desc = filter.sort_direction.unwrap_or_else(|| "desc".to_string()) != "asc";
        let limit = filter.limit.map(|value| value.clamp(1, 500));
        let metadata_status_can_limit_in_sql = matches!(
            metadata_status_key.as_deref(),
            None | Some("missinganyexternalid")
        );
        let sql_limit = if tag.is_none() && metadata_status_can_limit_in_sql {
            limit
        } else {
            None
        };
        let mut query_clauses: Vec<String> = Vec::new();
        let mut query_params: Vec<Value> = Vec::new();

        if let Some(query) = query.as_ref() {
            let needle = query.to_lowercase();
            let pattern = contains_like_pattern(&needle);
            query_clauses.push(
                "(LOWER(COALESCE(title, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(original_title, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(developer, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(brand, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(aliases, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(tags, '')) LIKE ? ESCAPE '\\')"
                    .to_string(),
            );
            for _ in 0..6 {
                query_params.push(Value::Text(pattern.clone()));
            }
        }

        if let Some(status) = filter.status.filter(|value| value != "all") {
            query_clauses.push("play_status = ?".to_string());
            query_params.push(Value::Text(status));
        }

        if let Some(tag) = tag.as_ref() {
            let pattern = contains_like_pattern(&tag.to_lowercase());
            query_clauses.push(
                "(LOWER(COALESCE(tags, '')) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(genres, '')) LIKE ? ESCAPE '\\')"
                    .to_string(),
            );
            query_params.push(Value::Text(pattern.clone()));
            query_params.push(Value::Text(pattern));
        }

        if let Some(developer) = developer.as_ref() {
            let needle = developer.to_lowercase();
            query_clauses.push(
                "(LOWER(COALESCE(developer, '')) = ? OR LOWER(COALESCE(brand, '')) = ? OR LOWER(COALESCE(publisher, '')) = ?)"
                    .to_string(),
            );
            for _ in 0..3 {
                query_params.push(Value::Text(needle.clone()));
            }
        }

        if let Some(favorite) = filter.favorite {
            query_clauses.push("favorite = ?".to_string());
            query_params.push(Value::Integer(bool_int(favorite)));
        }

        if let Some(hidden) = filter.hidden {
            query_clauses.push("hidden = ?".to_string());
            query_params.push(Value::Integer(bool_int(hidden)));
        }

        if let Some(path_status) = trim_optional(filter.path_status).filter(|value| value != "all")
        {
            query_clauses.push("path_status = ?".to_string());
            query_params.push(Value::Text(path_status));
        }

        if matches!(metadata_status_key.as_deref(), Some("missinganyexternalid")) {
            query_clauses.push(
                "(TRIM(COALESCE(vndb_id, '')) = '' OR TRIM(COALESCE(bangumi_id, '')) = '' OR TRIM(COALESCE(dlsite_id, '')) = '' OR TRIM(COALESCE(fanza_id, '')) = '' OR TRIM(COALESCE(ymgal_id, '')) = '')"
                    .to_string(),
            );
        }

        if let (Some(external_provider), Some(external_id)) =
            (external_provider.as_ref(), external_id.as_ref())
        {
            query_clauses.push(
                "EXISTS(SELECT 1 FROM external_ids WHERE external_ids.game_id = games.id AND LOWER(external_ids.provider) = ? AND LOWER(TRIM(external_ids.external_id)) = ?)".to_string(),
            );
            query_params.push(Value::Text(external_provider.clone()));
            query_params.push(Value::Text(external_id.clone()));
        }

        if let Some(ids) = collection_game_ids {
            if ids.is_empty() {
                return Ok(Vec::new());
            }
            query_clauses.push(format!(
                "id IN ({})",
                std::iter::repeat_n("?", ids.len())
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
            for id in ids {
                query_params.push(Value::Text(id.clone()));
            }
        }

        let mut sql = "SELECT * FROM games".to_string();
        if !query_clauses.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&query_clauses.join(" AND "));
        }
        sql.push_str(" ORDER BY ");
        sql.push_str(sql_sort_column(&sort_by));
        sql.push(' ');
        sql.push_str(if desc { "DESC" } else { "ASC" });
        if let Some(limit) = sql_limit {
            sql.push_str(" LIMIT ?");
            query_params.push(Value::Integer(limit));
        }

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(query_params.iter()), game_from_row)?;
        let mut games = rows.collect::<Result<Vec<_>, _>>()?;

        if let Some(tag) = tag {
            let needle = tag.to_lowercase();
            games.retain(|game| {
                game.tags
                    .iter()
                    .chain(game.genres.iter())
                    .any(|item| item.to_lowercase() == needle)
            });
        }

        if let Some(metadata_status) = metadata_status {
            games.retain(|game| metadata_status_matches(game, &metadata_status));
        }

        if let Some(limit) = limit {
            games.truncate(limit as usize);
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

fn contains_like_pattern(value: &str) -> String {
    let mut pattern = String::with_capacity(value.len() + 2);
    pattern.push('%');
    for ch in value.chars() {
        if matches!(ch, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(ch);
    }
    pattern.push('%');
    pattern
}

fn sql_sort_column(sort_by: &str) -> &'static str {
    match sort_by {
        "title" => "title",
        "created_at" => "created_at",
        "last_played_at" => "COALESCE(last_played_at, '')",
        "release_date" => "COALESCE(release_date, '')",
        "rating" => "COALESCE(rating, -1)",
        _ => "updated_at",
    }
}

fn metadata_status_matches(game: &Game, status: &str) -> bool {
    match metadata_status_key(status).as_str() {
        "complete" => has_complete_metadata(game),
        "missingdescription" => !has_text(&game.description),
        "missingcover" => !has_text(&game.cover_image),
        "missingbanner" => !has_text(&game.banner_image),
        "missingbackground" => !has_text(&game.background_image),
        "missingartwork" => {
            !has_text(&game.cover_image)
                || !has_text(&game.banner_image)
                || !has_text(&game.background_image)
        }
        "missingdescriptionimage" => {
            has_provider_id(game) && !has_description_image(&game.description)
        }
        "missingexternalid" => external_id_count(game) == 0,
        "missinganyexternalid" => has_missing_any_external_id(game),
        "needsmetadata" | "missing" => !has_complete_metadata(game),
        _ => true,
    }
}

fn metadata_status_key(value: &str) -> String {
    value.to_lowercase().replace([' ', '　', '-', '_'], "")
}

fn has_complete_metadata(game: &Game) -> bool {
    has_text(&game.description)
        && has_text(&game.release_date)
        && (has_text(&game.developer) || has_text(&game.brand))
        && has_text(&game.cover_image)
        && external_id_count(game) > 0
}

fn has_provider_id(game: &Game) -> bool {
    has_text(&game.dlsite_id) || has_text(&game.fanza_id)
}

fn has_description_image(value: &Option<String>) -> bool {
    let Some(value) = value.as_deref() else {
        return false;
    };
    let lower = value.to_lowercase();
    lower.contains("![")
        || lower.contains("<img")
        || lower.contains("[img]")
        || [".jpg", ".jpeg", ".png", ".webp", ".gif"]
            .iter()
            .any(|extension| lower.contains(extension))
}

fn has_text(value: &Option<String>) -> bool {
    value
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
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

fn has_missing_any_external_id(game: &Game) -> bool {
    [
        game.vndb_id.as_deref(),
        game.bangumi_id.as_deref(),
        game.dlsite_id.as_deref(),
        game.fanza_id.as_deref(),
        game.ymgal_id.as_deref(),
    ]
    .into_iter()
    .any(|value| value.map(|item| item.trim().is_empty()).unwrap_or(true))
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
