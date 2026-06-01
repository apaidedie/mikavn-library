use crate::db::models::{ScanCandidate, ScanTaskStatus};
use crate::db::{Database, DbResult};

impl Database {
    pub fn upsert_scan_task_result(
        &self,
        task_id: &str,
        path: &str,
        recursive: bool,
        candidates: &[ScanCandidate],
    ) -> DbResult<()> {
        self.get_task(task_id)?;
        self.scanner_result_repository()
            .upsert_scan_task_result(task_id, path, recursive, candidates)
    }

    pub fn get_scan_task_status(&self, task_id: &str) -> DbResult<ScanTaskStatus> {
        let task = self.get_task(task_id)?;
        let row = self
            .scanner_result_repository()
            .get_scan_task_result(task_id)?;
        let (path, recursive, candidates) = match row {
            Some(row) => (Some(row.path), Some(row.recursive), row.candidates),
            None => (None, None, Vec::new()),
        };

        Ok(ScanTaskStatus {
            task,
            path,
            recursive,
            candidates,
        })
    }
}
