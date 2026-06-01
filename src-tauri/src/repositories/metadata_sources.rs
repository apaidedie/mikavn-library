use chrono::Utc;
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::db::models::MetadataSourceRecord;
use crate::db::DbResult;

pub struct MetadataSourceRepository<'a> {
    conn: &'a Connection,
}

impl<'a> MetadataSourceRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn seed_metadata_sources(&self) -> DbResult<()> {
        let now = now();
        for (provider, label, priority) in [
            ("vndb", "VNDB", 10),
            ("dlsite", "DLsite", 20),
            ("fanza", "FANZA", 30),
            ("bangumi", "Bangumi", 40),
            ("ymgal", "YMGal", 50),
        ] {
            self.conn.execute(
                r#"
                INSERT INTO metadata_sources (id, provider, label, enabled, priority, created_at, updated_at)
                VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)
                ON CONFLICT(provider) DO UPDATE SET label = excluded.label, priority = excluded.priority, updated_at = excluded.updated_at
                "#,
                params![Uuid::new_v4().to_string(), provider, label, priority, now, now],
            )?;
        }
        Ok(())
    }

    pub fn list_metadata_sources(&self) -> DbResult<Vec<MetadataSourceRecord>> {
        self.seed_metadata_sources()?;
        let mut stmt = self.conn.prepare("SELECT id, provider, label, enabled, priority, created_at, updated_at FROM metadata_sources ORDER BY priority ASC")?;
        let rows = stmt.query_map([], metadata_source_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn metadata_source_from_row(row: &Row<'_>) -> rusqlite::Result<MetadataSourceRecord> {
    Ok(MetadataSourceRecord {
        id: row.get(0)?,
        provider: row.get(1)?,
        label: row.get(2)?,
        enabled: row.get::<_, i64>(3)? != 0,
        priority: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}
