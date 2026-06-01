use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{AssetInput, Game, GameAsset, TagRecord};
use crate::db::{DbError, DbResult};

pub struct AssetTagRepository<'a> {
    conn: &'a Connection,
}

impl<'a> AssetTagRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_game_assets(&self, game_id: String) -> DbResult<Vec<GameAsset>> {
        let mut stmt = self.conn.prepare("SELECT id, game_id, asset_type, uri, source, is_primary, created_at, updated_at FROM game_assets WHERE game_id = ?1 ORDER BY is_primary DESC, updated_at DESC")?;
        let rows = stmt.query_map(params![game_id], game_asset_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_game_asset(&self, game_id: String, input: AssetInput) -> DbResult<GameAsset> {
        let asset_type = normalize_asset_type(input.asset_type)?;
        let uri = trimmed_required(input.uri, "uri")?;
        let source = trim_optional(input.source).or_else(|| Some("manual".to_string()));
        let is_primary = input.is_primary.unwrap_or(true);
        let now = now();
        if is_primary {
            self.conn.execute("UPDATE game_assets SET is_primary = 0, updated_at = ?3 WHERE game_id = ?1 AND asset_type = ?2", params![game_id, asset_type, now])?;
        }
        self.conn.execute(
            r#"
            INSERT INTO game_assets (id, game_id, asset_type, uri, source, is_primary, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(game_id, asset_type, uri) DO UPDATE SET source = excluded.source, is_primary = excluded.is_primary, updated_at = excluded.updated_at
            "#,
            params![Uuid::new_v4().to_string(), game_id, asset_type, uri, source, bool_int(is_primary), now, now],
        )?;
        self.sync_primary_asset_to_game(&game_id, &asset_type, Some(&uri))?;
        self.conn.query_row(
            "SELECT id, game_id, asset_type, uri, source, is_primary, created_at, updated_at FROM game_assets WHERE game_id = ?1 AND asset_type = ?2 AND uri = ?3",
            params![game_id, asset_type, uri],
            game_asset_from_row,
        ).map_err(DbError::from)
    }

    pub fn remove_game_asset(&self, id: String) -> DbResult<String> {
        let asset = self.get_game_asset(&id)?;
        self.conn
            .execute("DELETE FROM game_assets WHERE id = ?1", params![asset.id])?;
        if asset.is_primary {
            self.sync_primary_asset_to_game(&asset.game_id, &asset.asset_type, None)?;
        }
        Ok(asset.game_id)
    }

    pub fn set_primary_asset(&self, id: String) -> DbResult<String> {
        let asset = self.get_game_asset(&id)?;
        let now = now();
        self.conn.execute("UPDATE game_assets SET is_primary = 0, updated_at = ?3 WHERE game_id = ?1 AND asset_type = ?2", params![asset.game_id, asset.asset_type, now])?;
        self.conn.execute(
            "UPDATE game_assets SET is_primary = 1, updated_at = ?2 WHERE id = ?1",
            params![asset.id, now],
        )?;
        self.sync_primary_asset_to_game(&asset.game_id, &asset.asset_type, Some(&asset.uri))?;
        Ok(asset.game_id)
    }

    pub fn list_tags(&self, kind: Option<String>) -> DbResult<Vec<TagRecord>> {
        let kind = trim_optional(kind);
        let sql = if kind.is_some() {
            r#"
            SELECT t.id, t.name, t.kind, COUNT(gt.game_id), t.created_at, t.updated_at
            FROM tags t LEFT JOIN game_tags gt ON gt.tag_id = t.id
            WHERE t.kind = ?1
            GROUP BY t.id, t.name, t.kind, t.created_at, t.updated_at
            ORDER BY COUNT(gt.game_id) DESC, t.name ASC
            "#
        } else {
            r#"
            SELECT t.id, t.name, t.kind, COUNT(gt.game_id), t.created_at, t.updated_at
            FROM tags t LEFT JOIN game_tags gt ON gt.tag_id = t.id
            GROUP BY t.id, t.name, t.kind, t.created_at, t.updated_at
            ORDER BY COUNT(gt.game_id) DESC, t.name ASC
            "#
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = if let Some(kind) = kind {
            stmt.query_map(params![kind], tag_from_row)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map([], tag_from_row)?
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok(rows)
    }

    pub fn sync_game_assets(&self, game: &Game, source: Option<&str>) -> DbResult<()> {
        for (asset_type, uri) in [
            ("cover", game.cover_image.as_deref()),
            ("banner", game.banner_image.as_deref()),
            ("background", game.background_image.as_deref()),
        ] {
            if let Some(uri) = uri.filter(|value| !value.trim().is_empty()) {
                let _ = self.upsert_game_asset(
                    game.id.clone(),
                    AssetInput {
                        asset_type: asset_type.to_string(),
                        uri: uri.to_string(),
                        source: source.map(ToString::to_string),
                        is_primary: Some(true),
                    },
                )?;
            } else {
                self.conn.execute(
                    "UPDATE game_assets SET is_primary = 0, updated_at = ?3 WHERE game_id = ?1 AND asset_type = ?2 AND source IN ('games', 'migration', 'archive_import')",
                    params![game.id, asset_type, now()],
                )?;
            }
        }
        Ok(())
    }

    pub fn sync_game_tags(&self, game: &Game) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM game_tags WHERE game_id = ?1", params![game.id])?;
        for (kind, values) in [("tag", game.tags.clone()), ("genre", game.genres.clone())] {
            for value in clean_list(values) {
                let tag_id = self.upsert_tag(&value, kind)?;
                self.conn.execute(
                    "INSERT OR IGNORE INTO game_tags (game_id, tag_id, created_at) VALUES (?1, ?2, ?3)",
                    params![game.id, tag_id, now()],
                )?;
            }
        }
        Ok(())
    }

    pub fn rename_tag(&self, id: String, name: String) -> DbResult<TagRecord> {
        let tag = self.get_tag(&id)?;
        let updated_name = trimmed_required(name, "name")?;
        let now = now();
        self.conn.execute(
            "UPDATE tags SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![tag.id, updated_name, now],
        )?;
        self.get_tag(&tag.id)
    }

    pub fn merge_tags(&self, source_ids: Vec<String>, target_id: String) -> DbResult<TagRecord> {
        let target = self.get_tag(&target_id)?;
        let source_ids = source_ids
            .into_iter()
            .filter(|id| !id.trim().is_empty() && id != &target_id)
            .collect::<Vec<_>>();
        if source_ids.is_empty() {
            return Ok(target);
        }
        for source_id in &source_ids {
            self.get_tag(source_id)?;
        }
        let tx = self.conn.unchecked_transaction()?;
        for source_id in &source_ids {
            tx.execute(
                "INSERT OR IGNORE INTO game_tags (game_id, tag_id, created_at) SELECT game_id, ?2, ?3 FROM game_tags WHERE tag_id = ?1",
                params![source_id, target_id, now()],
            )?;
            tx.execute(
                "DELETE FROM game_tags WHERE tag_id = ?1",
                params![source_id],
            )?;
            tx.execute("DELETE FROM tags WHERE id = ?1", params![source_id])?;
        }
        tx.commit()?;
        self.get_tag(&target_id)
    }

    pub fn delete_tag(&self, id: String) -> DbResult<()> {
        self.get_tag(&id)?;
        self.conn
            .execute("DELETE FROM game_tags WHERE tag_id = ?1", params![id])?;
        self.conn
            .execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }

    fn get_game_asset(&self, id: &str) -> DbResult<GameAsset> {
        self.conn
            .query_row("SELECT id, game_id, asset_type, uri, source, is_primary, created_at, updated_at FROM game_assets WHERE id = ?1", params![id], game_asset_from_row)
            .optional()?
            .ok_or_else(|| DbError::validation("asset not found"))
    }

    fn upsert_tag(&self, name: &str, kind: &str) -> DbResult<String> {
        let name = trimmed_required(name.to_string(), "tag")?;
        let kind = normalize_tag_kind(kind);
        let now = now();
        self.conn.execute(
            r#"
            INSERT INTO tags (id, name, kind, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(name, kind) DO UPDATE SET updated_at = excluded.updated_at
            "#,
            params![Uuid::new_v4().to_string(), name, kind, now, now],
        )?;
        self.conn
            .query_row(
                "SELECT id FROM tags WHERE name = ?1 AND kind = ?2",
                params![name, kind],
                |row| row.get(0),
            )
            .map_err(DbError::from)
    }

    fn sync_primary_asset_to_game(
        &self,
        game_id: &str,
        asset_type: &str,
        uri: Option<&str>,
    ) -> DbResult<()> {
        let column = match asset_type {
            "cover" => "cover_image",
            "banner" => "banner_image",
            "background" => "background_image",
            _ => return Ok(()),
        };
        let sql = format!("UPDATE games SET {column} = ?2, updated_at = ?3 WHERE id = ?1");
        self.conn.execute(&sql, params![game_id, uri, now()])?;
        Ok(())
    }

    fn get_tag(&self, id: &str) -> DbResult<TagRecord> {
        self.conn
            .query_row(
                "SELECT t.id, t.name, t.kind, COUNT(gt.game_id), t.created_at, t.updated_at FROM tags t LEFT JOIN game_tags gt ON gt.tag_id = t.id WHERE t.id = ?1 GROUP BY t.id, t.name, t.kind, t.created_at, t.updated_at",
                params![id],
                tag_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::validation("tag not found"))
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

fn normalize_asset_type(value: String) -> DbResult<String> {
    match value.trim().to_lowercase().as_str() {
        "cover" | "banner" | "background" | "screenshot" => Ok(value.trim().to_lowercase()),
        _ => Err(DbError::validation("unsupported asset type")),
    }
}

fn normalize_tag_kind(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "genre" => "genre".to_string(),
        _ => "tag".to_string(),
    }
}

fn game_asset_from_row(row: &Row<'_>) -> rusqlite::Result<GameAsset> {
    Ok(GameAsset {
        id: row.get(0)?,
        game_id: row.get(1)?,
        asset_type: row.get(2)?,
        uri: row.get(3)?,
        source: row.get(4)?,
        is_primary: row.get::<_, i64>(5)? != 0,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn tag_from_row(row: &Row<'_>) -> rusqlite::Result<TagRecord> {
    Ok(TagRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        kind: row.get(2)?,
        game_count: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}
