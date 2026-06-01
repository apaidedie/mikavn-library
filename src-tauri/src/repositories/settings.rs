use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{DbError, DbResult};

pub struct SettingRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SettingRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_setting(&self, key: &str) -> DbResult<Option<String>> {
        self.conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .map_err(DbError::from)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> DbResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn list_settings(&self) -> DbResult<Vec<(String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM app_settings ORDER BY key ASC")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}
