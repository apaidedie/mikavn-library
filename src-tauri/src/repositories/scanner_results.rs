use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use crate::db::models::ScanCandidate;
use crate::db::DbResult;

pub struct ScannerResultRepository<'a> {
    conn: &'a Connection,
}

pub struct ScanTaskResultRow {
    pub path: String,
    pub recursive: bool,
    pub candidates: Vec<ScanCandidate>,
}

impl<'a> ScannerResultRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn upsert_scan_task_result(
        &self,
        task_id: &str,
        path: &str,
        recursive: bool,
        candidates: &[ScanCandidate],
    ) -> DbResult<()> {
        let candidates_json = serde_json::to_string(candidates)?;
        self.conn.execute(
            r#"
            INSERT INTO scan_task_results (task_id, path, recursive, candidates, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(task_id) DO UPDATE SET
              path = excluded.path,
              recursive = excluded.recursive,
              candidates = excluded.candidates
            "#,
            params![task_id, path, bool_int(recursive), candidates_json, now()],
        )?;
        Ok(())
    }

    pub fn get_scan_task_result(&self, task_id: &str) -> DbResult<Option<ScanTaskResultRow>> {
        let row: Option<(String, i64, String)> = self
            .conn
            .query_row(
                "SELECT path, recursive, candidates FROM scan_task_results WHERE task_id = ?1",
                params![task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;

        Ok(row.map(|(path, recursive, candidates)| ScanTaskResultRow {
            path,
            recursive: recursive != 0,
            candidates: serde_json::from_str(&candidates).unwrap_or_default(),
        }))
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
