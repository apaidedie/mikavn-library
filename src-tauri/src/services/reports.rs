use std::fs;
use std::thread;

use tauri::AppHandle;

use crate::db::models::{DashboardData, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

pub fn get_dashboard(db: &Database) -> DbResult<DashboardData> {
    db.dashboard()
}

pub fn export_report_markdown(path: String, content: String) -> DbResult<()> {
    fs::write(path, content)?;
    Ok(())
}

pub fn enqueue_report_export_task(
    app: AppHandle,
    db: &Database,
    path: String,
    content: String,
) -> DbResult<TaskRecord> {
    if path.trim().is_empty() {
        return Err(DbError::validation("export path is required"));
    }

    let task = tasks::create_task_with_payload(
        &app,
        db,
        "report.export_markdown",
        Some("正在导出 Markdown 报告".to_string()),
        None,
        false,
    )?;
    let task_id = task.id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let Ok(paths) = AppPaths::from_app(&app_handle) else {
            return;
        };
        let Ok(db) = Database::new_from_path(paths.database()) else {
            return;
        };

        let _ = tasks::update_task(
            &app_handle,
            &db,
            &task_id,
            "running",
            0.2,
            Some("正在写入报告文件".to_string()),
            None,
        );
        match fs::write(&path, content) {
            Ok(()) => {
                logger::log_info(
                    &paths,
                    "report.export_markdown",
                    format!(
                        "report exported to {}",
                        logger::redact_sensitive_text(&path)
                    ),
                );
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "completed",
                    1.0,
                    Some(format!(
                        "报告已导出到 {}",
                        logger::redact_sensitive_text(&path)
                    )),
                    None,
                );
            }
            Err(error) => {
                logger::log_error(&paths, "report.export_markdown", error.to_string());
                let _ = tasks::update_task(
                    &app_handle,
                    &db,
                    &task_id,
                    "failed",
                    1.0,
                    Some("报告导出失败".to_string()),
                    Some(error.to_string()),
                );
            }
        }
    });

    Ok(task)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn export_report_markdown_writes_file() {
        let root = std::env::temp_dir().join(format!("mikavn-report-export-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("report.md");

        export_report_markdown(target.to_string_lossy().to_string(), "# Report".to_string())
            .unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "# Report");
        let _ = fs::remove_dir_all(root);
    }
}
