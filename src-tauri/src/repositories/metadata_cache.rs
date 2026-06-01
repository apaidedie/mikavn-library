use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{DbError, DbResult};

pub struct MetadataCacheRepository<'a> {
    conn: &'a Connection,
}

impl<'a> MetadataCacheRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> DbResult<Option<T>> {
        let row: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT response, expires_at FROM metadata_cache WHERE key = ?1",
                params![key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        let Some((response, expires_at)) = row else {
            return Ok(None);
        };

        let expires_at = DateTime::parse_from_rfc3339(&expires_at).map_err(|error| {
            DbError::validation(format!("invalid metadata cache expiry: {error}"))
        })?;
        if expires_at.with_timezone(&Utc) <= Utc::now() {
            self.conn
                .execute("DELETE FROM metadata_cache WHERE key = ?1", params![key])?;
            return Ok(None);
        }

        Ok(Some(serde_json::from_str(&response)?))
    }

    pub fn set<T: serde::Serialize>(
        &self,
        key: &str,
        provider: &str,
        request: &str,
        value: &T,
        ttl_seconds: i64,
    ) -> DbResult<()> {
        let created_at = now();
        let expires_at = (Utc::now() + Duration::seconds(ttl_seconds)).to_rfc3339();
        let response = serde_json::to_string(value)?;
        self.conn.execute(
            "INSERT OR REPLACE INTO metadata_cache (key, provider, request, response, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![key, provider, request, response, created_at, expires_at],
        )?;
        Ok(())
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}
