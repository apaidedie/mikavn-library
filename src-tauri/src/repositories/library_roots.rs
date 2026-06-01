use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::LibraryRoot;
use crate::db::{DbError, DbResult};

pub struct LibraryRootRepository<'a> {
    conn: &'a Connection,
}

impl<'a> LibraryRootRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn add_library_root(&self, path: String) -> DbResult<LibraryRoot> {
        let id = Uuid::new_v4().to_string();
        let created_at = now();
        let clean_path = trimmed_required(path, "path")?;
        self.conn.execute(
            "INSERT OR IGNORE INTO library_roots (id, path, recursive, enabled, created_at) VALUES (?1, ?2, 1, 1, ?3)",
            params![id, clean_path, created_at],
        )?;
        self.conn
            .query_row(
                "SELECT id, path, recursive, enabled, created_at FROM library_roots WHERE path = ?1",
                params![clean_path],
                library_root_from_row,
            )
            .map_err(DbError::from)
    }

    pub fn update_library_root(
        &self,
        id: String,
        recursive: Option<bool>,
        enabled: Option<bool>,
    ) -> DbResult<LibraryRoot> {
        self.get_library_root(&id)?;
        if let Some(recursive) = recursive {
            self.conn.execute(
                "UPDATE library_roots SET recursive = ?2 WHERE id = ?1",
                params![&id, bool_int(recursive)],
            )?;
        }
        if let Some(enabled) = enabled {
            self.conn.execute(
                "UPDATE library_roots SET enabled = ?2 WHERE id = ?1",
                params![&id, bool_int(enabled)],
            )?;
        }
        self.get_library_root(&id)
    }

    pub fn remove_library_root(&self, id: String) -> DbResult<()> {
        let affected = self
            .conn
            .execute("DELETE FROM library_roots WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(DbError::path_not_found("library root not found"));
        }
        Ok(())
    }

    pub fn list_library_roots(&self) -> DbResult<Vec<LibraryRoot>> {
        let mut stmt = self.conn.prepare("SELECT id, path, recursive, enabled, created_at FROM library_roots ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], library_root_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_library_root(&self, id: &str) -> DbResult<LibraryRoot> {
        self.conn
            .query_row(
                "SELECT id, path, recursive, enabled, created_at FROM library_roots WHERE id = ?1",
                params![id],
                library_root_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::path_not_found("library root not found"))
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

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn library_root_from_row(row: &Row<'_>) -> rusqlite::Result<LibraryRoot> {
    Ok(LibraryRoot {
        id: row.get(0)?,
        path: row.get(1)?,
        recursive: row.get::<_, i64>(2)? != 0,
        enabled: row.get::<_, i64>(3)? != 0,
        created_at: row.get(4)?,
    })
}
