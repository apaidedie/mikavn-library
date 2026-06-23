use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{
    CollectionGameLink, CollectionInput, Game, GameCollection, UpdateCollectionInput,
};
use crate::db::{DbError, DbResult};
use crate::repositories::games::game_from_row;

pub struct CollectionRepository<'a> {
    conn: &'a Connection,
}

impl<'a> CollectionRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_collections(&self) -> DbResult<Vec<GameCollection>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT c.id, c.name, c.description, c.color, COUNT(cg.game_id) AS game_count, c.created_at, c.updated_at
            FROM collections c
            LEFT JOIN collection_games cg ON cg.collection_id = c.id
            GROUP BY c.id, c.name, c.description, c.color, c.created_at, c.updated_at
            ORDER BY c.updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map([], collection_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn create_collection(&self, input: CollectionInput) -> DbResult<GameCollection> {
        let now = now();
        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO collections (id, name, description, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, trimmed_required(input.name, "name")?, trim_optional(input.description), trim_optional(input.color), now, now],
        )?;
        self.get_collection(&id)
    }

    pub fn update_collection(
        &self,
        id: String,
        input: UpdateCollectionInput,
    ) -> DbResult<GameCollection> {
        let mut collection = self.get_collection(&id)?;
        if let Some(value) = input.name {
            collection.name = trimmed_required(value, "name")?;
        }
        if input.description.is_some() {
            collection.description = trim_optional(input.description);
        }
        if input.color.is_some() {
            collection.color = trim_optional(input.color);
        }
        collection.updated_at = now();
        self.conn.execute(
            "UPDATE collections SET name = ?2, description = ?3, color = ?4, updated_at = ?5 WHERE id = ?1",
            params![collection.id, collection.name, collection.description, collection.color, collection.updated_at],
        )?;
        self.get_collection(&id)
    }

    pub fn delete_collection(&self, id: String) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM collections WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_collection_games(&self, collection_id: String) -> DbResult<Vec<Game>> {
        self.get_collection(&collection_id)?;
        let mut stmt = self.conn.prepare(
            r#"
            SELECT g.* FROM games g
            INNER JOIN collection_games cg ON cg.game_id = g.id
            WHERE cg.collection_id = ?1
            ORDER BY cg.added_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![collection_id], game_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_game_collections(&self, game_id: String) -> DbResult<Vec<GameCollection>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT c.id, c.name, c.description, c.color, COUNT(all_cg.game_id) AS game_count, c.created_at, c.updated_at
            FROM collections c
            INNER JOIN collection_games cg ON cg.collection_id = c.id
            LEFT JOIN collection_games all_cg ON all_cg.collection_id = c.id
            WHERE cg.game_id = ?1
            GROUP BY c.id, c.name, c.description, c.color, c.created_at, c.updated_at
            ORDER BY c.updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![game_id], collection_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn add_game_to_collection(
        &self,
        collection_id: String,
        game_id: String,
    ) -> DbResult<CollectionGameLink> {
        self.get_collection(&collection_id)?;
        let added_at = now();
        self.conn.execute(
            "INSERT OR REPLACE INTO collection_games (collection_id, game_id, added_at) VALUES (?1, ?2, ?3)",
            params![collection_id, game_id, added_at],
        )?;
        self.conn.execute(
            "UPDATE collections SET updated_at = ?2 WHERE id = ?1",
            params![collection_id, added_at],
        )?;
        Ok(CollectionGameLink {
            collection_id,
            game_id,
            added_at,
        })
    }

    pub fn remove_game_from_collection(
        &self,
        collection_id: String,
        game_id: String,
    ) -> DbResult<()> {
        self.conn.execute(
            "DELETE FROM collection_games WHERE collection_id = ?1 AND game_id = ?2",
            params![collection_id, game_id],
        )?;
        self.conn.execute(
            "UPDATE collections SET updated_at = ?2 WHERE id = ?1",
            params![collection_id, now()],
        )?;
        Ok(())
    }

    pub fn collection_game_ids(&self, collection_id: &str) -> DbResult<Vec<String>> {
        self.get_collection(collection_id)?;
        let mut stmt = self
            .conn
            .prepare("SELECT game_id FROM collection_games WHERE collection_id = ?1")?;
        let rows = stmt.query_map(params![collection_id], |row| row.get::<_, String>(0))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    fn get_collection(&self, id: &str) -> DbResult<GameCollection> {
        self.conn
            .query_row(
                r#"
                SELECT c.id, c.name, c.description, c.color, COUNT(cg.game_id) AS game_count, c.created_at, c.updated_at
                FROM collections c
                LEFT JOIN collection_games cg ON cg.collection_id = c.id
                WHERE c.id = ?1
                GROUP BY c.id, c.name, c.description, c.color, c.created_at, c.updated_at
                "#,
                params![id],
                collection_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::validation("collection not found"))
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
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

fn collection_from_row(row: &Row<'_>) -> rusqlite::Result<GameCollection> {
    Ok(GameCollection {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        color: row.get(3)?,
        game_count: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}
