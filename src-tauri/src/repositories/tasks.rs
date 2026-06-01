use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::db::models::{TaskDetail, TaskLogEntry, TaskRecord};
use crate::db::{DbError, DbResult};
use crate::infrastructure::logger;

pub struct TaskRepository<'a> {
    conn: &'a Connection,
}

impl<'a> TaskRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn create_task_with_payload(
        &self,
        task_type: &str,
        message: Option<String>,
        retry_payload: Option<String>,
        retryable: bool,
    ) -> DbResult<TaskRecord> {
        let item = TaskRecord {
            id: Uuid::new_v4().to_string(),
            task_type: task_type.to_string(),
            status: "pending".to_string(),
            progress: 0.0,
            message: message.clone(),
            error: None,
            retry_payload,
            retryable,
            created_at: now(),
            updated_at: now(),
        };
        self.conn.execute(
            "INSERT INTO tasks (id, type, status, progress, message, error, retry_payload, retryable, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![item.id, item.task_type, item.status, item.progress, item.message, item.error, item.retry_payload, bool_int(item.retryable), item.created_at, item.updated_at],
        )?;
        if let Some(message) = message.filter(|item| !item.trim().is_empty()) {
            self.append_task_log(&item.id, "info", &message)?;
        }
        self.get_task(&item.id)
    }

    pub fn get_task(&self, id: &str) -> DbResult<TaskRecord> {
        self.conn
            .query_row("SELECT id, type, status, progress, message, error, retry_payload, retryable, created_at, updated_at FROM tasks WHERE id = ?1", params![id], task_from_row)
            .optional()?
            .ok_or_else(|| DbError::new("VALIDATION_ERROR", "task not found"))
    }

    pub fn list_tasks(&self, limit: i64) -> DbResult<Vec<TaskRecord>> {
        let limit = limit.clamp(1, 200);
        let mut stmt = self.conn.prepare("SELECT id, type, status, progress, message, error, retry_payload, retryable, created_at, updated_at FROM tasks ORDER BY updated_at DESC LIMIT ?1")?;
        let rows = stmt.query_map(params![limit], task_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn update_task(
        &self,
        id: &str,
        status: &str,
        progress: f64,
        message: Option<String>,
        error: Option<String>,
    ) -> DbResult<TaskRecord> {
        let progress = progress.clamp(0.0, 1.0);
        let message = message.map(|value| logger::redact_sensitive_text(&value));
        let error = error.map(|value| logger::redact_sensitive_text(&value));
        self.conn.execute(
            "UPDATE tasks SET status = ?2, progress = ?3, message = ?4, error = ?5, updated_at = ?6 WHERE id = ?1",
            params![id, status, progress, message, error, now()],
        )?;
        if let Some(message) = message.as_deref().filter(|item| !item.trim().is_empty()) {
            self.append_task_log(
                id,
                if status == "failed" { "error" } else { "info" },
                message,
            )?;
        }
        if let Some(error) = error.as_deref().filter(|item| !item.trim().is_empty()) {
            self.append_task_log(id, "error", error)?;
        }
        self.get_task(id)
    }

    pub fn append_task_log(
        &self,
        task_id: &str,
        level: &str,
        message: &str,
    ) -> DbResult<TaskLogEntry> {
        let level = match level.trim().to_ascii_lowercase().as_str() {
            "debug" => "debug",
            "warn" | "warning" => "warn",
            "error" => "error",
            _ => "info",
        };
        let item = TaskLogEntry {
            id: Uuid::new_v4().to_string(),
            task_id: task_id.to_string(),
            level: level.to_string(),
            message: logger::redact_sensitive_text(message.trim()),
            created_at: now(),
        };
        if item.message.is_empty() {
            return Ok(item);
        }
        self.conn.execute(
            "INSERT INTO task_logs (id, task_id, level, message, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![item.id, item.task_id, item.level, item.message, item.created_at],
        )?;
        Ok(item)
    }

    pub fn list_task_logs(&self, task_id: &str) -> DbResult<Vec<TaskLogEntry>> {
        self.get_task(task_id)?;
        let mut stmt = self.conn.prepare("SELECT id, task_id, level, message, created_at FROM task_logs WHERE task_id = ?1 ORDER BY created_at ASC")?;
        let rows = stmt.query_map(params![task_id], task_log_from_row)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_task_detail(&self, task_id: &str) -> DbResult<TaskDetail> {
        Ok(TaskDetail {
            task: self.get_task(task_id)?,
            logs: self.list_task_logs(task_id)?,
        })
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

fn task_from_row(row: &Row<'_>) -> rusqlite::Result<TaskRecord> {
    Ok(TaskRecord {
        id: row.get(0)?,
        task_type: row.get(1)?,
        status: row.get(2)?,
        progress: row.get(3)?,
        message: row.get(4)?,
        error: row.get(5)?,
        retry_payload: row.get(6)?,
        retryable: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

fn task_log_from_row(row: &Row<'_>) -> rusqlite::Result<TaskLogEntry> {
    Ok(TaskLogEntry {
        id: row.get(0)?,
        task_id: row.get(1)?,
        level: row.get(2)?,
        message: row.get(3)?,
        created_at: row.get(4)?,
    })
}
