use crate::db::models::{TaskDetail, TaskLogEntry, TaskRecord};
use crate::db::{Database, DbResult};

impl Database {
    #[cfg(test)]
    pub fn create_task(&self, task_type: &str, message: Option<String>) -> DbResult<TaskRecord> {
        self.create_task_with_payload(task_type, message, None, false)
    }

    pub fn create_task_with_payload(
        &self,
        task_type: &str,
        message: Option<String>,
        retry_payload: Option<String>,
        retryable: bool,
    ) -> DbResult<TaskRecord> {
        self.task_repository().create_task_with_payload(
            task_type,
            message,
            retry_payload,
            retryable,
        )
    }

    pub fn get_task(&self, id: &str) -> DbResult<TaskRecord> {
        self.task_repository().get_task(id)
    }

    pub fn list_tasks(&self, limit: i64) -> DbResult<Vec<TaskRecord>> {
        self.task_repository().list_tasks(limit)
    }

    pub fn update_task(
        &self,
        id: &str,
        status: &str,
        progress: f64,
        message: Option<String>,
        error: Option<String>,
    ) -> DbResult<TaskRecord> {
        self.task_repository()
            .update_task(id, status, progress, message, error)
    }

    pub fn append_task_log(
        &self,
        task_id: &str,
        level: &str,
        message: &str,
    ) -> DbResult<TaskLogEntry> {
        self.task_repository()
            .append_task_log(task_id, level, message)
    }

    pub fn list_task_logs(&self, task_id: &str) -> DbResult<Vec<TaskLogEntry>> {
        self.task_repository().list_task_logs(task_id)
    }

    pub fn get_task_detail(&self, task_id: &str) -> DbResult<TaskDetail> {
        self.task_repository().get_task_detail(task_id)
    }
}
