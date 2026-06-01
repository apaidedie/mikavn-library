use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{SavedSearch, SavedSearchInput};
use crate::db::{DbError, DbResult};

pub struct SavedSearchRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SavedSearchRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_saved_searches(&self) -> DbResult<Vec<SavedSearch>> {
        let mut stmt = self.conn.prepare("SELECT id, name, query, description, created_at, updated_at FROM saved_searches ORDER BY updated_at DESC, name ASC")?;
        let rows = stmt.query_map([], saved_search_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn create_saved_search(&self, input: SavedSearchInput) -> DbResult<SavedSearch> {
        let now = now();
        let item = SavedSearch {
            id: Uuid::new_v4().to_string(),
            name: trimmed_required(input.name, "name")?,
            query: trimmed_required(input.query, "query")?,
            description: trim_optional(input.description),
            created_at: now.clone(),
            updated_at: now,
        };
        self.conn.execute(
            "INSERT INTO saved_searches (id, name, query, description, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&item.id, &item.name, &item.query, &item.description, &item.created_at, &item.updated_at],
        )?;
        self.get_saved_search(&item.id)
    }

    pub fn update_saved_search(
        &self,
        id: String,
        input: SavedSearchInput,
    ) -> DbResult<SavedSearch> {
        let mut item = self.get_saved_search(&id)?;
        item.name = trimmed_required(input.name, "name")?;
        item.query = trimmed_required(input.query, "query")?;
        item.description = trim_optional(input.description);
        item.updated_at = now();
        self.conn.execute(
            "UPDATE saved_searches SET name = ?2, query = ?3, description = ?4, updated_at = ?5 WHERE id = ?1",
            params![&item.id, &item.name, &item.query, &item.description, &item.updated_at],
        )?;
        self.get_saved_search(&item.id)
    }

    pub fn delete_saved_search(&self, id: String) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM saved_searches WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_saved_search(&self, id: &str) -> DbResult<SavedSearch> {
        self.conn
            .query_row(
                "SELECT id, name, query, description, created_at, updated_at FROM saved_searches WHERE id = ?1",
                params![id],
                saved_search_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::validation("saved search not found"))
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

fn saved_search_from_row(row: &Row<'_>) -> rusqlite::Result<SavedSearch> {
    Ok(SavedSearch {
        id: row.get(0)?,
        name: row.get(1)?,
        query: row.get(2)?,
        description: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}
