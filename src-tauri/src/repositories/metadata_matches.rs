use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{BatchMatchJob, BatchMatchResult, BatchMatchStatus, MetadataSearchResult};
use crate::db::{DbError, DbResult};

pub struct MetadataMatchRepository<'a> {
    conn: &'a Connection,
}

impl<'a> MetadataMatchRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create_match_job(
        &self,
        game_ids: &[String],
        task_id: Option<String>,
    ) -> DbResult<BatchMatchJob> {
        let now = now();
        let job = BatchMatchJob {
            id: Uuid::new_v4().to_string(),
            task_id,
            status: "running".to_string(),
            total: game_ids.len() as i64,
            completed: 0,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        self.conn.execute(
            "INSERT INTO metadata_match_jobs (id, task_id, status, total, completed, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&job.id, &job.task_id, &job.status, job.total, job.completed, &job.created_at, &job.updated_at],
        )?;
        Ok(job)
    }

    pub fn get_match_job(&self, job_id: &str) -> DbResult<BatchMatchJob> {
        self.conn
            .query_row(
                "SELECT id, task_id, status, total, completed, created_at, updated_at FROM metadata_match_jobs WHERE id = ?1",
                params![job_id],
                match_job_from_row,
            )
            .optional()?
            .ok_or_else(|| DbError::new("VALIDATION_ERROR", "metadata match job not found"))
    }

    pub fn find_match_job_by_task_id(&self, task_id: &str) -> DbResult<Option<BatchMatchJob>> {
        self.conn
            .query_row(
                "SELECT id, task_id, status, total, completed, created_at, updated_at FROM metadata_match_jobs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
                params![task_id],
                match_job_from_row,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn set_match_job_status(&self, job_id: &str, status: &str) -> DbResult<()> {
        self.conn.execute(
            "UPDATE metadata_match_jobs SET status = ?2, updated_at = ?3 WHERE id = ?1",
            params![job_id, status, now()],
        )?;
        Ok(())
    }

    pub fn insert_match_result(
        &self,
        job_id: &str,
        game_id: &str,
        original_title: &str,
        cleaned_title: &str,
        selected: Option<&MetadataSearchResult>,
        status: &str,
        reason: Option<String>,
        candidates: Vec<MetadataSearchResult>,
    ) -> DbResult<()> {
        let selected_provider = selected.map(|item| item.provider.clone());
        let selected_id = selected.map(|item| item.id.clone());
        let selected_score = selected.map(|item| item.relevance_score);
        let candidates_json = serde_json::to_string(&candidates)?;
        self.conn.execute(
            r#"
            INSERT INTO metadata_match_results (
              id, job_id, game_id, original_title, cleaned_title, selected_provider, selected_id, selected_score,
              status, reason, candidates, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                Uuid::new_v4().to_string(),
                job_id,
                game_id,
                original_title,
                cleaned_title,
                selected_provider,
                selected_id,
                selected_score,
                status,
                reason,
                candidates_json,
                now(),
            ],
        )?;
        self.conn.execute(
            "UPDATE metadata_match_jobs SET completed = completed + 1, updated_at = ?2 WHERE id = ?1",
            params![job_id, now()],
        )?;
        Ok(())
    }

    pub fn match_status(&self, job_id: String) -> DbResult<BatchMatchStatus> {
        let job = self.get_match_job(&job_id)?;
        let mut stmt = self.conn.prepare(
            "SELECT id, job_id, game_id, original_title, cleaned_title, selected_provider, selected_id, selected_score, status, reason, candidates, created_at FROM metadata_match_results WHERE job_id = ?1 ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map(params![job_id], batch_result_from_row)?;
        let results = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(BatchMatchStatus { job, results })
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn match_job_from_row(row: &Row<'_>) -> rusqlite::Result<BatchMatchJob> {
    Ok(BatchMatchJob {
        id: row.get(0)?,
        task_id: row.get(1)?,
        status: row.get(2)?,
        total: row.get(3)?,
        completed: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn batch_result_from_row(row: &Row<'_>) -> rusqlite::Result<BatchMatchResult> {
    let candidates: String = row.get(10)?;
    Ok(BatchMatchResult {
        id: row.get(0)?,
        job_id: row.get(1)?,
        game_id: row.get(2)?,
        original_title: row.get(3)?,
        cleaned_title: row.get(4)?,
        selected_provider: row.get(5)?,
        selected_id: row.get(6)?,
        selected_score: row.get(7)?,
        status: row.get(8)?,
        reason: row.get(9)?,
        candidates: serde_json::from_str(&candidates).unwrap_or_default(),
        created_at: row.get(11)?,
    })
}
