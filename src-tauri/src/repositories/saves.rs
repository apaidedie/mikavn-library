use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{SaveBackup, SavePath};
use crate::db::{DbError, DbResult};

pub struct SaveRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SaveRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn add_save_path(
        &self,
        game_id: String,
        label: String,
        path: String,
    ) -> DbResult<SavePath> {
        let label = trimmed_required(label, "label").unwrap_or_else(|_| "存档".to_string());
        let item = SavePath {
            id: Uuid::new_v4().to_string(),
            game_id,
            label,
            path,
            created_at: now(),
        };
        self.conn.execute(
            "INSERT INTO save_paths (id, game_id, label, path, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![&item.id, &item.game_id, &item.label, &item.path, &item.created_at],
        )?;
        self.get_save_path(&item.id)
    }

    pub fn list_save_paths(&self, game_id: String) -> DbResult<Vec<SavePath>> {
        let mut stmt = self.conn.prepare("SELECT id, game_id, label, path, created_at FROM save_paths WHERE game_id = ?1 ORDER BY created_at DESC")?;
        let rows = stmt.query_map(params![game_id], save_path_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_save_path(&self, id: &str) -> DbResult<SavePath> {
        self.conn
            .query_row(
                "SELECT id, game_id, label, path, created_at FROM save_paths WHERE id = ?1",
                params![id],
                save_path_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::path_not_found("save path not found"))
    }

    pub fn remove_save_path(&self, id: String) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM save_paths WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn insert_save_backup(&self, item: &SaveBackup) -> DbResult<SaveBackup> {
        self.conn.execute(
            "INSERT INTO save_backups (id, game_id, save_path_id, label, source_path, backup_path, protection, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![&item.id, &item.game_id, &item.save_path_id, &item.label, &item.source_path, &item.backup_path, bool_int(item.protection), &item.created_at],
        )?;
        self.get_save_backup(&item.id)
    }

    pub fn get_save_backup(&self, id: &str) -> DbResult<SaveBackup> {
        self.conn
            .query_row(
                "SELECT id, game_id, save_path_id, label, source_path, backup_path, protection, created_at FROM save_backups WHERE id = ?1",
                params![id],
                save_backup_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::new("VALIDATION_ERROR", "save backup not found"))
    }

    pub fn list_save_backups(&self, game_id: String) -> DbResult<Vec<SaveBackup>> {
        let mut stmt = self.conn.prepare("SELECT id, game_id, save_path_id, label, source_path, backup_path, protection, created_at FROM save_backups WHERE game_id = ?1 ORDER BY created_at DESC")?;
        let rows = stmt.query_map(params![game_id], save_backup_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn delete_save_backup_record(&self, id: String) -> DbResult<()> {
        self.conn
            .execute("DELETE FROM save_backups WHERE id = ?1", params![id])?;
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

fn trimmed_required(value: String, field: &str) -> DbResult<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(DbError::validation(format!("{field} is required")))
    } else {
        Ok(trimmed)
    }
}

fn save_path_from_row(row: &Row<'_>) -> rusqlite::Result<SavePath> {
    Ok(SavePath {
        id: row.get(0)?,
        game_id: row.get(1)?,
        label: row.get(2)?,
        path: row.get(3)?,
        created_at: row.get(4)?,
    })
}

fn save_backup_from_row(row: &Row<'_>) -> rusqlite::Result<SaveBackup> {
    Ok(SaveBackup {
        id: row.get(0)?,
        game_id: row.get(1)?,
        save_path_id: row.get(2)?,
        label: row.get(3)?,
        source_path: row.get(4)?,
        backup_path: row.get(5)?,
        protection: row.get::<_, i64>(6)? != 0,
        created_at: row.get(7)?,
    })
}
