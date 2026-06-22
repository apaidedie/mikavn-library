use crate::db::models::{ScanCandidate, ScanConflictRow, ScanTaskStatus};
use crate::db::{Database, DbResult};

impl Database {
    pub fn list_scan_conflict_rows(&self) -> DbResult<Vec<ScanConflictRow>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, title, install_path, executable_path FROM games")?;
        let rows = stmt.query_map([], |row| {
            Ok(ScanConflictRow {
                id: row.get(0)?,
                title: row.get(1)?,
                install_path: row.get(2)?,
                executable_path: row.get(3)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

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
