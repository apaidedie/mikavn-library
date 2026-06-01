use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{ExternalIdRecord, FieldLock, Game};
use crate::db::{DbError, DbResult};

pub struct MetadataIdRepository<'a> {
    conn: &'a Connection,
}

impl<'a> MetadataIdRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn list_field_locks(&self, game_id: String) -> DbResult<Vec<FieldLock>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, game_id, field_name, locked_by_user, updated_at FROM field_locks WHERE game_id = ?1 ORDER BY field_name ASC",
        )?;
        let rows = stmt.query_map(params![game_id], field_lock_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn set_field_lock(
        &self,
        game_id: String,
        field_name: String,
        locked_by_user: bool,
    ) -> DbResult<FieldLock> {
        let field_name = trimmed_required(field_name, "fieldName")?;
        let now = now();
        self.conn.execute(
            r#"
            INSERT INTO field_locks (id, game_id, field_name, locked_by_user, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(game_id, field_name) DO UPDATE SET
              locked_by_user = excluded.locked_by_user,
              updated_at = excluded.updated_at
            "#,
            params![
                Uuid::new_v4().to_string(),
                game_id,
                field_name,
                bool_int(locked_by_user),
                now
            ],
        )?;
        self.get_field_lock(&game_id, &field_name)
    }

    pub fn set_field_locks(
        &self,
        game_id: String,
        field_names: Vec<String>,
        locked_by_user: bool,
    ) -> DbResult<Vec<FieldLock>> {
        let mut locks = Vec::new();
        for field_name in clean_list(field_names) {
            locks.push(self.set_field_lock(game_id.clone(), field_name, locked_by_user)?);
        }
        Ok(locks)
    }

    pub fn locked_field_names(&self, game_id: &str) -> DbResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT field_name FROM field_locks WHERE game_id = ?1 AND locked_by_user = 1",
        )?;
        let rows = stmt.query_map(params![game_id], |row| row.get::<_, String>(0))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_external_ids(&self, game_id: String) -> DbResult<Vec<ExternalIdRecord>> {
        let mut stmt = self.conn.prepare("SELECT id, game_id, provider, external_id, source, confidence, created_at, updated_at FROM external_ids WHERE game_id = ?1 ORDER BY provider ASC")?;
        let rows = stmt.query_map(params![game_id], external_id_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_external_id(
        &self,
        game_id: &str,
        provider: &str,
        external_id: &str,
        source: Option<&str>,
        confidence: Option<f64>,
    ) -> DbResult<ExternalIdRecord> {
        let provider = provider.trim().to_lowercase();
        let external_id = external_id.trim().to_string();
        if provider.is_empty() || external_id.is_empty() {
            return Err(DbError::validation("provider and externalId are required"));
        }
        let now = now();
        self.conn.execute(
            r#"
            INSERT INTO external_ids (id, game_id, provider, external_id, source, confidence, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(game_id, provider) DO UPDATE SET
              external_id = excluded.external_id,
              source = excluded.source,
              confidence = excluded.confidence,
              updated_at = excluded.updated_at
            "#,
            params![Uuid::new_v4().to_string(), game_id, provider, external_id, source, confidence, now, now],
        )?;
        self.conn
            .query_row(
                "SELECT id, game_id, provider, external_id, source, confidence, created_at, updated_at FROM external_ids WHERE game_id = ?1 AND provider = ?2",
                params![game_id, provider],
                external_id_from_row,
            )
            .map_err(DbError::from)
    }

    pub fn sync_game_external_ids(&self, game: &Game, source: Option<&str>) -> DbResult<()> {
        if let Some(value) = game.vndb_id.as_deref() {
            self.upsert_external_id(&game.id, "vndb", value, source, None)?;
        }
        if let Some(value) = game.dlsite_id.as_deref() {
            self.upsert_external_id(&game.id, "dlsite", value, source, None)?;
        }
        if let Some(value) = game.fanza_id.as_deref() {
            self.upsert_external_id(&game.id, "fanza", value, source, None)?;
        }
        if let Some(value) = game.bangumi_id.as_deref() {
            self.upsert_external_id(&game.id, "bangumi", value, source, None)?;
        }
        if let Some(value) = game.ymgal_id.as_deref() {
            self.upsert_external_id(&game.id, "ymgal", value, source, None)?;
        }
        Ok(())
    }

    fn get_field_lock(&self, game_id: &str, field_name: &str) -> DbResult<FieldLock> {
        self.conn
            .query_row(
                "SELECT id, game_id, field_name, locked_by_user, updated_at FROM field_locks WHERE game_id = ?1 AND field_name = ?2",
                params![game_id, field_name],
                field_lock_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::validation("field lock not found"))
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

fn field_lock_from_row(row: &Row<'_>) -> rusqlite::Result<FieldLock> {
    Ok(FieldLock {
        id: row.get(0)?,
        game_id: row.get(1)?,
        field_name: row.get(2)?,
        locked_by_user: row.get::<_, i64>(3)? != 0,
        updated_at: row.get(4)?,
    })
}

fn external_id_from_row(row: &Row<'_>) -> rusqlite::Result<ExternalIdRecord> {
    Ok(ExternalIdRecord {
        id: row.get(0)?,
        game_id: row.get(1)?,
        provider: row.get(2)?,
        external_id: row.get(3)?,
        source: row.get(4)?,
        confidence: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}
