use std::{cmp::Reverse, fs};

use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::db::DbResult;
use crate::infrastructure::logger;
use crate::infrastructure::paths::AppPaths;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogRecord {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: Option<String>,
    pub preview: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogRetentionPolicy {
    pub retain_days: i64,
    pub max_files: i64,
}

pub fn list_diagnostic_logs(app: &AppHandle, limit: Option<i64>) -> DbResult<Vec<LogRecord>> {
    let paths = AppPaths::from_app(app)?;
    list_diagnostic_logs_from_paths(&paths, limit)
}

pub fn get_log_retention() -> LogRetentionPolicy {
    LogRetentionPolicy {
        retain_days: 30,
        max_files: 60,
    }
}

pub fn prune_diagnostic_logs(app: &AppHandle, policy: LogRetentionPolicy) -> DbResult<i64> {
    let paths = AppPaths::from_app(app)?;
    prune_diagnostic_logs_from_paths(&paths, policy)
}

fn list_diagnostic_logs_from_paths(
    paths: &AppPaths,
    limit: Option<i64>,
) -> DbResult<Vec<LogRecord>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(paths.logs())? {
        let entry = entry?;
        let path = entry.path();
        if !is_log_file(&path) {
            continue;
        }
        let metadata = entry.metadata()?;
        let modified_at = metadata
            .modified()
            .ok()
            .map(chrono::DateTime::<Utc>::from)
            .map(|value| value.to_rfc3339());
        let preview = fs::read_to_string(&path)
            .ok()
            .map(|content| tail_lines(&content, 12))
            .unwrap_or_default();
        entries.push(LogRecord {
            file_name: entry.file_name().to_string_lossy().to_string(),
            path: logger::display_path(&path),
            size_bytes: metadata.len(),
            modified_at,
            preview,
        });
    }
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    entries.truncate(limit.unwrap_or(30).clamp(1, 200) as usize);
    Ok(entries)
}

fn prune_diagnostic_logs_from_paths(paths: &AppPaths, policy: LogRetentionPolicy) -> DbResult<i64> {
    let cutoff = Utc::now() - Duration::days(policy.retain_days.max(1));
    let mut files = Vec::new();
    for entry in fs::read_dir(paths.logs())? {
        let entry = entry?;
        let path = entry.path();
        if !is_log_file(&path) {
            continue;
        }
        let modified = entry
            .metadata()?
            .modified()
            .ok()
            .map(chrono::DateTime::<Utc>::from)
            .unwrap_or_else(Utc::now);
        files.push((path, modified));
    }
    files.sort_by_key(|(_, modified)| Reverse(*modified));
    let max_files = policy.max_files.max(1) as usize;
    let mut removed = 0_i64;
    for (index, (path, modified)) in files.into_iter().enumerate() {
        if modified < cutoff || index >= max_files {
            fs::remove_file(path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

fn is_log_file(path: &std::path::Path) -> bool {
    path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("log")
}

fn tail_lines(content: &str, count: usize) -> Vec<String> {
    content
        .lines()
        .rev()
        .take(count)
        .map(logger::redact_sensitive_text)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn list_logs_ignores_non_logs_and_keeps_tail_preview() {
        let root = std::env::temp_dir().join(format!("mikavn-log-list-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::write(
            paths.logs().join("mikavn.log"),
            (1..=20)
                .map(|n| n.to_string())
                .collect::<Vec<_>>()
                .join("\n"),
        )
        .unwrap();
        fs::write(paths.logs().join("notes.txt"), "not a log").unwrap();

        let logs = list_diagnostic_logs_from_paths(&paths, Some(10)).unwrap();

        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].file_name, "mikavn.log");
        assert_eq!(logs[0].preview.first().map(String::as_str), Some("9"));
        assert_eq!(logs[0].preview.last().map(String::as_str), Some("20"));
        assert_eq!(logs[0].preview.len(), 12);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn list_logs_redacts_preview_and_path_before_returning_to_ui() {
        let root = std::env::temp_dir().join(format!("mikavn-log-redact-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::write(
            paths.logs().join("mikavn.log"),
            r"API_KEY=secret token:abc password=hunter2 C:\Users\alice\AppData\Roaming\MikaVN\mikavn.db",
        )
        .unwrap();

        let logs = list_diagnostic_logs_from_paths(&paths, Some(10)).unwrap();

        assert_eq!(logs.len(), 1);
        assert!(logs[0].path.contains("[redacted]") || !logs[0].path.contains("alice"));
        let preview = logs[0].preview.join("\n");
        assert!(preview.contains("[redacted]"));
        assert!(!preview.contains("secret"));
        assert!(!preview.contains("hunter2"));
        assert!(!preview.contains("token:abc"));
        assert!(!preview.contains("alice"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prune_logs_respects_max_files_and_ignores_non_logs() {
        let root = std::env::temp_dir().join(format!("mikavn-log-prune-{}", Uuid::new_v4()));
        let paths = AppPaths::from_root(root.clone()).unwrap();
        fs::write(paths.logs().join("a.log"), "a").unwrap();
        fs::write(paths.logs().join("b.log"), "b").unwrap();
        fs::write(paths.logs().join("notes.txt"), "keep").unwrap();

        let removed = prune_diagnostic_logs_from_paths(
            &paths,
            LogRetentionPolicy {
                retain_days: 30,
                max_files: 1,
            },
        )
        .unwrap();

        let remaining_logs = fs::read_dir(paths.logs())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| is_log_file(&entry.path()))
            .count();
        assert_eq!(removed, 1);
        assert_eq!(remaining_logs, 1);
        assert!(paths.logs().join("notes.txt").is_file());
        let _ = fs::remove_dir_all(root);
    }
}
