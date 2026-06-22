use std::fs;
use std::thread;

use tauri::AppHandle;

use crate::db::models::{DashboardData, ReportSummary, TaskRecord};
use crate::db::{Database, DbError, DbResult};
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;
use crate::services::tasks;

pub fn get_dashboard(db: &Database) -> DbResult<DashboardData> {
    db.dashboard()
}

pub fn get_report_summary(db: &Database) -> DbResult<ReportSummary> {
    db.report_summary()
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
        match fs::write(&path, &content) {
            Ok(()) => {
                let _ = db.append_task_log(&task_id, "info", &report_gap_summary_log(&content));
                let _ = db.append_task_log(&task_id, "info", &report_gap_examples_log(&content));
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

fn report_gap_summary_log(content: &str) -> String {
    fn count_for(content: &str, label: &str) -> i64 {
        let prefix = format!("- {}:", label);
        content
            .lines()
            .find_map(|line| {
                line.trim()
                    .strip_prefix(&prefix)
                    .and_then(|value| value.trim().parse::<i64>().ok())
            })
            .unwrap_or(0)
    }

    format!(
        "报告缺口摘要：缺封面 {}，缺简介图片 {}，缺外部 ID {}，路径异常 {}",
        count_for(content, "缺封面"),
        count_for(content, "缺简介图片"),
        count_for(content, "缺外部 ID"),
        count_for(content, "路径异常")
    )
}

fn report_gap_examples_log(content: &str) -> String {
    fn example_for(content: &str, label: &str) -> String {
        let prefix = format!("- {}:", label);
        let mut lines = content.lines().peekable();
        while let Some(line) = lines.next() {
            if !line.trim().starts_with(&prefix) {
                continue;
            }
            if let Some(example_line) = lines.peek() {
                if let Some(value) = example_line.trim().strip_prefix("- 样例:") {
                    return value.trim().to_string();
                }
            }
            break;
        }
        "无".to_string()
    }

    format!(
        "报告缺口样例：缺封面 {}，缺简介图片 {}，缺外部 ID {}，路径异常 {}",
        example_for(content, "缺封面"),
        example_for(content, "缺简介图片"),
        example_for(content, "缺外部 ID"),
        example_for(content, "路径异常")
    )
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

    #[test]
    fn report_gap_summary_log_extracts_actionable_gaps() {
        let content = "# MikaVN Library Report\n\n## 可处理缺口\n- 缺封面: 2\n  - 样例: A / B\n- 缺简介图片: 3\n  - 样例: C\n- 缺外部 ID: 4\n  - 样例: D\n- 路径异常: 5\n  - 样例: E\n";

        assert_eq!(
            report_gap_summary_log(content),
            "报告缺口摘要：缺封面 2，缺简介图片 3，缺外部 ID 4，路径异常 5"
        );
    }

    #[test]
    fn report_gap_examples_log_extracts_actionable_examples() {
        let content = "# MikaVN Library Report\n\n## 可处理缺口\n- 缺封面: 2\n  - 样例: 天使☆騒々 RE-BOOT! / 媒体图片补全候选\n- 缺简介图片: 1\n  - 样例: 简介图片修复候选\n- 缺外部 ID: 1\n  - 样例: 天使☆騒々 RE-BOOT!\n- 路径异常: 1\n  - 样例: 天使☆騒々 RE-BOOT!\n";

        assert_eq!(
            report_gap_examples_log(content),
            "报告缺口样例：缺封面 天使☆騒々 RE-BOOT! / 媒体图片补全候选，缺简介图片 简介图片修复候选，缺外部 ID 天使☆騒々 RE-BOOT!，路径异常 天使☆騒々 RE-BOOT!"
        );
    }
}
